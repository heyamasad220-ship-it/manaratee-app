/**
 * Set contacts.last_activity_at from latest Vendor Hub order/participation date
 * (payment_date, else bazaar event_date) — not the CSV import timestamp.
 *
 *   node scripts/backfill-vendor-last-activity.mjs
 *   node scripts/backfill-vendor-last-activity.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

function loadEnvLocal() {
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

function toIsoDate(value) {
  if (!value) return null
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function maxDate(a, b) {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

loadEnvLocal()
const execute = process.argv.includes("--execute")

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const { data: roleRows, error: roleError } = await sb
  .from("contact_roles")
  .select("contact_id")
  .eq("organization_id", ORG_ID)
  .eq("role", "vendor")

if (roleError) {
  console.error(roleError)
  process.exit(1)
}

const contactIds = [...new Set((roleRows || []).map((r) => r.contact_id).filter(Boolean))]

const latestByContact = new Map()

const { data: payments, error: payError } = await sb
  .from("vendor_hub_payments")
  .select("contact_id, payment_date, created_at")
  .in("contact_id", contactIds.length ? contactIds : ["00000000-0000-0000-0000-000000000000"])

if (payError) {
  console.error(payError)
  process.exit(1)
}

for (const row of payments || []) {
  const contactId = row.contact_id
  if (!contactId) continue
  const date = toIsoDate(row.payment_date) || toIsoDate(row.created_at)
  latestByContact.set(contactId, maxDate(latestByContact.get(contactId), date))
}

const { data: participants, error: partError } = await sb
  .from("vendor_hub_participant_status")
  .select("contact_id, vendor_hub_event_id")
  .eq("organization_id", ORG_ID)
  .in("contact_id", contactIds.length ? contactIds : ["00000000-0000-0000-0000-000000000000"])

if (partError) {
  console.error(partError)
  process.exit(1)
}

const eventIds = [
  ...new Set((participants || []).map((p) => p.vendor_hub_event_id).filter(Boolean)),
]

let eventsById = new Map()
if (eventIds.length > 0) {
  const { data: events, error: eventsError } = await sb
    .from("vendor_hub_events")
    .select("id, event_date")
    .in("id", eventIds)
  if (eventsError) {
    console.error(eventsError)
    process.exit(1)
  }
  eventsById = new Map((events || []).map((e) => [e.id, toIsoDate(e.event_date)]))
}

for (const row of participants || []) {
  const contactId = row.contact_id
  if (!contactId) continue
  const eventDate = eventsById.get(row.vendor_hub_event_id) || null
  latestByContact.set(contactId, maxDate(latestByContact.get(contactId), eventDate))
}

const report = {
  mode: execute ? "execute" : "dry-run",
  vendorContacts: contactIds.length,
  withActivityDate: latestByContact.size,
  updated: 0,
  skippedNoDate: 0,
  sample: [],
  errors: [],
}

for (const contactId of contactIds) {
  const date = latestByContact.get(contactId)
  if (!date) {
    report.skippedNoDate += 1
    continue
  }
  if (report.sample.length < 12) {
    report.sample.push({ contactId, last_activity_at: date })
  }
  if (!execute) continue

  const { error } = await sb
    .from("contacts")
    .update({ last_activity_at: `${date}T12:00:00.000Z` })
    .eq("id", contactId)
    .eq("organization_id", ORG_ID)

  if (error) {
    report.errors.push({ contactId, error: error.message })
  } else {
    report.updated += 1
  }
}

const outDir = resolve(root, "scripts/reports")
mkdirSync(outDir, { recursive: true })
const outPath = resolve(
  outDir,
  execute ? "backfill-vendor-last-activity-execute.json" : "backfill-vendor-last-activity-dry-run.json"
)
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`Wrote ${outPath}`)
if (!execute) {
  console.log("Dry-run only. Re-run with --execute to apply.")
}
