/**
 * Reset contact profile timelines for an organization:
 * 1. Backup and delete contact_activities rows
 * 2. Set organizations.contact_timeline_reset_at (now)
 *
 * Requires migration 154_organization_contact_settings.sql (adds column on organizations).
 *
 * Usage:
 *   node scripts/clear-contact-timelines.mjs --org e057e00a-e4e3-4adf-9af5-f465db1894be --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const STAMP = new Date().toISOString().slice(0, 10)
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

function loadEnv() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) throw new Error(".env.local not found")
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv) {
  const args = { orgId: DEFAULT_ORG_ID, execute: false }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--execute") args.execute = true
    else if (argv[index] === "--org") args.orgId = argv[++index]
  }
  return args
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, filters = []) {
  const rows = []
  let from = 0

  while (true) {
    let query = sb.from(table).select("*").range(from, from + 999)
    for (const filter of filters) {
      if (filter.op === "eq") query = query.eq(filter.col, filter.val)
    }
    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }

  return rows
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const resetAt = new Date().toISOString()

  const { data: org, error: orgError } = await sb
    .from("organizations")
    .select("id, name")
    .eq("id", args.orgId)
    .single()

  if (orgError || !org) {
    console.error(orgError?.message || "Organization not found")
    process.exit(1)
  }

  let previousTimelineResetAt = null
  const { data: resetRow, error: resetReadError } = await sb
    .from("organizations")
    .select("contact_timeline_reset_at")
    .eq("id", args.orgId)
    .maybeSingle()

  if (!resetReadError) {
    previousTimelineResetAt = resetRow?.contact_timeline_reset_at ?? null
  }

  const activities = await fetchAll("contact_activities", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])

  const report = {
    mode: args.execute ? "execute" : "dry-run",
    organizationId: args.orgId,
    organizationName: org.name,
    contactActivitiesBefore: activities.length,
    contactActivitiesDeleted: 0,
    timelineResetAt: resetAt,
    previousTimelineResetAt,
    resetColumnUpdated: false,
  }

  console.log(`=== Clear contact timelines: ${org.name} ===\n`)
  console.log(`contact_activities rows: ${activities.length}`)
  console.log(`New timeline reset: ${resetAt}`)

  if (!args.execute) {
    console.log("\nDry run only. Pass --execute to apply.")
    return
  }

  const backupDir = resolve(root, "scripts/backups/contact-timeline-reset")
  mkdirSync(backupDir, { recursive: true })
  const backupPath = resolve(backupDir, `contact_activities-${args.orgId.slice(0, 8)}-${STAMP}.json`)
  writeFileSync(backupPath, JSON.stringify(activities, null, 2))
  console.log(`\nBackup: ${backupPath}`)

  for (let index = 0; index < activities.length; index += 500) {
    const batch = activities.slice(index, index + 500).map((row) => row.id)
    const { error } = await sb.from("contact_activities").delete().in("id", batch)
    if (error) throw new Error(`contact_activities delete: ${error.message}`)
    report.contactActivitiesDeleted += batch.length
  }

  const { error: settingsError } = await sb
    .from("organizations")
    .update({ contact_timeline_reset_at: resetAt })
    .eq("id", args.orgId)

  if (settingsError) {
    console.warn(
      `Warning: could not set contact_timeline_reset_at (${settingsError.message}).\n` +
        "Run scripts/154_organization_contact_settings.sql and re-run this script, or set the column manually."
    )
  } else {
    report.resetColumnUpdated = true
  }

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(reportDir, `contact-timeline-reset-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(`Deleted contact_activities: ${report.contactActivitiesDeleted}`)
  if (report.resetColumnUpdated) {
    console.log("Set organizations.contact_timeline_reset_at")
  }
  console.log(`Report: ${reportPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
