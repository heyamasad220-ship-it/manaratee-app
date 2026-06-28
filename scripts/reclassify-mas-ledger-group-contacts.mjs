/**
 * Reclassify mis-imported ledger rows (e.g. "Wednesday Halaqa") as group contacts.
 *
 * Usage:
 *   node scripts/reclassify-mas-ledger-group-contacts.mjs
 *   node scripts/reclassify-mas-ledger-group-contacts.mjs --execute
 *   node scripts/reclassify-mas-ledger-group-contacts.mjs --org <uuid> --execute
 *
 * Requires migration 132_contact_type_group.sql applied first.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const STAMP = new Date().toISOString().slice(0, 10)

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

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isGroupLikeName(fullName) {
  const normalized = normalizeName(fullName)
  if (!normalized) return false

  const patterns = [
    "halaqa",
    "halqa",
    "halaqah",
    "committee",
    " circle",
    "youth group",
    "sisters group",
    "brothers group",
  ]

  if (patterns.some((pattern) => normalized.includes(pattern))) {
    return true
  }

  return /\bgroup\b/.test(normalized) && !/\b(inc|llc|corp|ltd|market)\b/.test(normalized)
}

function extractPrimaryContactFromNotes(notes) {
  const match = String(notes || "").match(/Primary contact:\s*(.+?)(?:\s*\||$)/i)
  return match?.[1]?.trim() || null
}

loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, select, build) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select(select).range(from, from + 999)
    q = build(q)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function main() {
  const { orgId } = parseArgs(process.argv.slice(2))

  const contacts = await fetchAll(
    "contacts",
    "id, full_name, contact_type, primary_contact_name, notes, person_id",
    (q) => q.eq("organization_id", orgId).eq("contact_type", "individual")
  )

  const candidates = contacts.filter((contact) => isGroupLikeName(contact.full_name))

  const report = {
    mode: execute ? "execute" : "preview",
    organizationId: orgId,
    candidates: candidates.map((contact) => ({
      id: contact.id,
      full_name: contact.full_name,
      primary_contact_name: contact.primary_contact_name,
    })),
    reclassified: 0,
    donorRowsUpdated: 0,
    affiliationsSynced: 0,
    errors: [],
  }

  if (!candidates.length) {
    report.message = "No group-like individual contacts found."
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (!execute) {
    console.log(JSON.stringify(report, null, 2))
    console.error("\nDry run only. Re-run with --execute after applying 132_contact_type_group.sql.")
    return
  }

  for (const contact of candidates) {
    try {
      const primaryFromNotes = extractPrimaryContactFromNotes(contact.notes)
      const primaryContactName = contact.primary_contact_name || primaryFromNotes || null

      const { error: contactError } = await sb
        .from("contacts")
        .update({
          contact_type: "group",
          primary_contact_name: primaryContactName,
          person_id: null,
        })
        .eq("organization_id", orgId)
        .eq("id", contact.id)

      if (contactError) throw new Error(contactError.message)

      const { error: donorError } = await sb
        .from("donors")
        .update({ donor_type: "organization" })
        .eq("organization_id", orgId)
        .eq("contact_id", contact.id)

      if (donorError && donorError.code !== "42P01") {
        throw new Error(donorError.message)
      } else if (!donorError) {
        report.donorRowsUpdated += 1
      }

      const { error: syncError } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: orgId,
        p_contact_id: contact.id,
      })

      if (syncError) {
        report.errors.push({
          contactId: contact.id,
          full_name: contact.full_name,
          message: syncError.message,
        })
      } else {
        report.affiliationsSynced += 1
      }

      report.reclassified += 1
    } catch (error) {
      report.errors.push({
        contactId: contact.id,
        full_name: contact.full_name,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `reclassify-mas-ledger-group-contacts-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
