/**
 * Backfill Donor affiliations on contacts that have non-voided payments
 * but never ran sync_contact_affiliations (common after bulk ledger import).
 *
 * Usage:
 *   node scripts/sync-donor-affiliations.mjs
 *   node scripts/sync-donor-affiliations.mjs --execute
 *   node scripts/sync-donor-affiliations.mjs --org <uuid> --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

function parseArgs(argv) {
  const args = { orgId: DEFAULT_ORG_ID }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--org") args.orgId = argv[++index]
  }
  return args
}

function loadEnv() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
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

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function collectDonorContactIds(orgId) {
  const ids = new Set()
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await sb
      .from("payments")
      .select("contact_id")
      .eq("organization_id", orgId)
      .not("contact_id", "is", null)
      .neq("status", "voided")
      .range(from, from + pageSize - 1)

    if (error) throw error
    for (const row of data || []) {
      if (row.contact_id) ids.add(row.contact_id)
    }
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  from = 0
  while (true) {
    const { data, error } = await sb
      .from("donors")
      .select("contact_id, payments!inner(status)")
      .eq("organization_id", orgId)
      .not("contact_id", "is", null)
      .neq("payments.status", "voided")
      .range(from, from + pageSize - 1)

    if (error) throw error
    for (const row of data || []) {
      if (row.contact_id) ids.add(row.contact_id)
    }
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return [...ids]
}

async function main() {
  const { orgId } = parseArgs(process.argv.slice(2))
  const contactIds = await collectDonorContactIds(orgId)

  const report = {
    generatedAt: new Date().toISOString(),
    orgId,
    execute,
    contactIdsFound: contactIds.length,
    synced: 0,
    errors: [],
  }

  console.log(`Found ${contactIds.length} contact(s) with donor payments in org ${orgId}`)

  for (const contactId of contactIds) {
    if (!execute) continue
    const { error } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: contactId,
    })
    if (error) {
      report.errors.push({ contactId, message: error.message })
      console.warn(`sync failed ${contactId}:`, error.message)
    } else {
      report.synced += 1
    }
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(
    reportsDir,
    `sync-donor-affiliations-${new Date().toISOString().slice(0, 10)}.json`
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  if (!execute) {
    console.log("Dry run only. Re-run with --execute to sync Donor affiliations.")
  } else {
    console.log(`Synced ${report.synced} contact(s). Errors: ${report.errors.length}`)
  }
  console.log(`Report: ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
