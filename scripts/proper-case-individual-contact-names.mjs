/**
 * Proper-case individual contact names (people only).
 * Leaves organizations and groups unchanged.
 *
 * Updates:
 *   - contacts.full_name
 *   - people.first_name / people.last_name (when person_id is set)
 *   - donors.full_name (linked individual donors)
 *
 * Only rewrites names that are ALL CAPS or all lowercase
 * (e.g. "ABEER ZOUBI" → "Abeer Zoubi"). Mixed-case names are left alone.
 *
 * Usage:
 *   node scripts/proper-case-individual-contact-names.mjs
 *   node scripts/proper-case-individual-contact-names.mjs --org=<uuid>
 *   node scripts/proper-case-individual-contact-names.mjs --execute
 *   node scripts/proper-case-individual-contact-names.mjs --org=<uuid> --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const STAMP = new Date().toISOString().slice(0, 10)
const PAGE_SIZE = 500

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

function parseArgs(argv) {
  let orgId = DEFAULT_ORG_ID
  let execute = false
  for (const arg of argv) {
    if (arg === "--execute") execute = true
    else if (arg.startsWith("--org=")) orgId = arg.slice("--org=".length).trim()
  }
  return { orgId, execute }
}

function toProperPersonName(value) {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ")
  if (!trimmed) return ""
  return trimmed
    .split(" ")
    .map((word) => properCaseWord(word))
    .join(" ")
}

function shouldProperCasePersonName(value) {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return false
  const letters = trimmed.replace(/[^A-Za-z]/g, "")
  if (letters.length < 2) return false
  return letters === letters.toUpperCase() || letters === letters.toLowerCase()
}

function properCaseWord(word) {
  if (!word) return word
  if (word.includes("-")) {
    return word.split("-").map((part) => properCaseWord(part)).join("-")
  }
  const apostropheMatch = word.match(/^([A-Za-z]+)'([A-Za-z]+)$/)
  if (apostropheMatch) {
    return `${capitalizeSegment(apostropheMatch[1])}'${capitalizeSegment(apostropheMatch[2])}`
  }
  return capitalizeSegment(word)
}

function capitalizeSegment(segment) {
  if (!segment) return segment
  const lower = segment.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function shouldSkipBusinessLikeName(value) {
  return /\b(llc|l\.l\.c|inc|corp|ltd|co|company|foundation|masjid|mosque|center|centre|school|academy|association|committee|halaqa|institute|nonprofit|non-profit)\b/i.test(
    value
  )
}

function splitFullName(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: "Unknown", last_name: "" }
  if (parts.length === 1) return { first_name: parts[0], last_name: "" }
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
}

loadEnv()
const { orgId, execute } = parseArgs(process.argv.slice(2))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const report = {
  mode: execute ? "execute" : "preview",
  organizationId: orgId,
  scanned: 0,
  toUpdate: 0,
  contactsUpdated: 0,
  peopleUpdated: 0,
  donorsUpdated: 0,
  samples: [],
  errors: [],
}

async function fetchAllIndividualContacts() {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, person_id, contact_type, donors!inner(id, full_name, donor_type)")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .eq("donors.donor_type", "individual")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const batch = data || []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

const contacts = await fetchAllIndividualContacts()
report.scanned = contacts.length

const changes = []
for (const contact of contacts) {
  const current = String(contact.full_name || "").trim()
  if (!shouldProperCasePersonName(current)) continue
  if (shouldSkipBusinessLikeName(current)) continue
  const next = toProperPersonName(current)
  if (!next || next === current) continue
  changes.push({
    contactId: contact.id,
    personId: contact.person_id || null,
    from: current,
    to: next,
  })
}

report.toUpdate = changes.length
report.samples = changes.slice(0, 40).map((row) => ({
  contactId: row.contactId,
  from: row.from,
  to: row.to,
}))

console.log(
  `[${report.mode}] scanned ${report.scanned} individual contacts; ${report.toUpdate} need proper casing`
)
for (const sample of report.samples.slice(0, 15)) {
  console.log(`  "${sample.from}" → "${sample.to}"`)
}
if (report.toUpdate > 15) {
  console.log(`  … and ${report.toUpdate - 15} more`)
}

if (!execute) {
  console.log("\nDry run only. Re-run with --execute to apply updates.")
} else {
  for (const change of changes) {
    const { error: contactError } = await sb
      .from("contacts")
      .update({ full_name: change.to })
      .eq("id", change.contactId)
      .eq("organization_id", orgId)

    if (contactError) {
      report.errors.push({ contactId: change.contactId, step: "contact", error: contactError.message })
      continue
    }
    report.contactsUpdated += 1

    if (change.personId) {
      const { first_name, last_name } = splitFullName(change.to)
      const { error: personError } = await sb
        .from("people")
        .update({ first_name, last_name })
        .eq("id", change.personId)

      if (personError) {
        report.errors.push({
          contactId: change.contactId,
          personId: change.personId,
          step: "people",
          error: personError.message,
        })
      } else {
        report.peopleUpdated += 1
      }
    }

    const { data: donors, error: donorLookupError } = await sb
      .from("donors")
      .select("id, full_name, donor_type")
      .eq("organization_id", orgId)
      .eq("contact_id", change.contactId)
      .eq("donor_type", "individual")

    if (donorLookupError) {
      report.errors.push({
        contactId: change.contactId,
        step: "donor-lookup",
        error: donorLookupError.message,
      })
      continue
    }

    for (const donor of donors || []) {
      if (!shouldProperCasePersonName(donor.full_name) && donor.full_name === change.to) {
        continue
      }
      const donorNext = toProperPersonName(donor.full_name || change.to)
      if (!donorNext || donorNext === donor.full_name) continue

      const { error: donorError } = await sb
        .from("donors")
        .update({ full_name: donorNext })
        .eq("id", donor.id)
        .eq("organization_id", orgId)

      if (donorError) {
        report.errors.push({
          contactId: change.contactId,
          donorId: donor.id,
          step: "donor",
          error: donorError.message,
        })
      } else {
        report.donorsUpdated += 1
      }
    }
  }

  console.log(
    `\nUpdated contacts=${report.contactsUpdated}, people=${report.peopleUpdated}, donors=${report.donorsUpdated}, errors=${report.errors.length}`
  )
}

const reportDir = resolve(root, "scripts/reports")
mkdirSync(reportDir, { recursive: true })
const reportPath = resolve(reportDir, `proper-case-individual-names-${STAMP}.json`)
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(`Report: ${reportPath}`)
