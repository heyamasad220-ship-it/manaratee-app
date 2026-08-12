/**
 * Backfill vendor application submitted_at to FIRST activity date.
 * Reports how many rows would change / did change.
 *
 *   node scripts/fix-vendor-application-submitted-dates.mjs
 *   node scripts/fix-vendor-application-submitted-dates.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

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

function parseArgs(argv) {
  const args = { execute: false, orgId: DEFAULT_ORG_ID }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function toTime(value) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

function earliestIso(candidates) {
  let bestMs = null
  let best = null
  for (const value of candidates) {
    const ms = toTime(value)
    if (ms == null) continue
    if (bestMs == null || ms < bestMs) {
      bestMs = ms
      const raw = String(value).trim()
      best = raw.length === 10 ? `${raw}T12:00:00.000Z` : raw
    }
  }
  return best
}

function sameDay(a, b) {
  if (!a || !b) return false
  return String(a).slice(0, 10) === String(b).slice(0, 10)
}

loadEnvLocal()
const args = parseArgs(process.argv.slice(2))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: apps, error: appsError } = await sb
  .from("applications")
  .select("id, contact_id, submitted_at, reviewed_at, reviewed_by, notes, form_data")
  .eq("organization_id", args.orgId)
  .eq("application_type", "vendor")
  .eq("module_owner", "vendor_hub")

if (appsError) {
  console.error(appsError)
  process.exit(1)
}

const contactIds = [
  ...new Set((apps || []).map((row) => row.contact_id).filter(Boolean)),
]

const contactById = new Map()
const firstByContact = new Map()

for (let i = 0; i < contactIds.length; i += 200) {
  const chunk = contactIds.slice(i, i + 200)

  const [{ data: contacts }, { data: payments }, { data: participants }, { data: assignments }] =
    await Promise.all([
      sb
        .from("contacts")
        .select("id, created_at, last_activity_at")
        .in("id", chunk),
      sb
        .from("vendor_hub_payments")
        .select("contact_id, payment_date, created_at")
        .in("contact_id", chunk),
      sb
        .from("vendor_hub_participant_status")
        .select("contact_id, vendor_hub_event_id")
        .in("contact_id", chunk),
      sb
        .from("vendor_hub_booth_assignments")
        .select("contact_id, event_id")
        .in("contact_id", chunk),
    ])

  for (const contact of contacts || []) {
    contactById.set(contact.id, contact)
  }

  const eventIds = [
    ...new Set([
      ...(participants || []).map((row) => row.vendor_hub_event_id).filter(Boolean),
      ...(assignments || []).map((row) => row.event_id).filter(Boolean),
    ]),
  ]

  const eventDateById = new Map()
  if (eventIds.length > 0) {
    for (let j = 0; j < eventIds.length; j += 200) {
      const eventChunk = eventIds.slice(j, j + 200)
      const { data: events } = await sb
        .from("vendor_hub_events")
        .select("id, event_date")
        .in("id", eventChunk)
      for (const event of events || []) {
        eventDateById.set(event.id, event.event_date)
      }
    }
  }

  const candidatesByContact = new Map()
  const push = (contactId, value) => {
    if (!contactId || !value) return
    const list = candidatesByContact.get(contactId) || []
    list.push(value)
    candidatesByContact.set(contactId, list)
  }

  for (const payment of payments || []) {
    push(payment.contact_id, payment.payment_date || payment.created_at)
  }
  for (const row of participants || []) {
    push(row.contact_id, eventDateById.get(row.vendor_hub_event_id))
  }
  for (const row of assignments || []) {
    push(row.contact_id, eventDateById.get(row.event_id))
  }

  for (const contactId of chunk) {
    const contact = contactById.get(contactId)
    const participationFirst = earliestIso(candidatesByContact.get(contactId) || [])
    const fallback =
      participationFirst ||
      (contact?.last_activity_at &&
      (!contact.created_at ||
        toTime(contact.last_activity_at) < toTime(contact.created_at))
        ? contact.last_activity_at
        : null) ||
      contact?.last_activity_at ||
      contact?.created_at ||
      null
    firstByContact.set(contactId, participationFirst || fallback)
  }
}

const report = {
  mode: args.execute ? "execute" : "dry-run",
  orgId: args.orgId,
  applications: (apps || []).length,
  wouldUpdate: 0,
  updated: 0,
  skippedNoContact: 0,
  skippedNoChange: 0,
  skippedNoFirstActivity: 0,
  sample: [],
  errors: [],
}

for (const app of apps || []) {
  if (!app.contact_id) {
    report.skippedNoContact += 1
    continue
  }

  const firstActivity = firstByContact.get(app.contact_id)
  if (!firstActivity) {
    report.skippedNoFirstActivity += 1
    continue
  }

  if (sameDay(app.submitted_at, firstActivity)) {
    report.skippedNoChange += 1
    continue
  }

  const clearReviewed =
    !app.reviewed_by &&
    (sameDay(app.reviewed_at, app.submitted_at) ||
      (app.form_data && app.form_data.import_tag) ||
      String(app.notes || "").includes("VENDOR_UPDATE_CSV") ||
      String(app.notes || "").includes("BAZAAR_VENDORS_CSV"))

  report.wouldUpdate += 1
  if (report.sample.length < 15) {
    report.sample.push({
      applicationId: app.id,
      contactId: app.contact_id,
      from: app.submitted_at,
      to: firstActivity,
      clearReviewed,
    })
  }

  if (!args.execute) continue

  const patch = {
    submitted_at: firstActivity,
    updated_at: new Date().toISOString(),
  }
  if (clearReviewed) {
    patch.reviewed_at = null
    patch.reviewed_by = null
  }

  const { error } = await sb.from("applications").update(patch).eq("id", app.id)
  if (error) {
    report.errors.push({ applicationId: app.id, error: error.message })
  } else {
    report.updated += 1
  }
}

const outDir = resolve(root, "scripts/reports")
mkdirSync(outDir, { recursive: true })
const outPath = resolve(
  outDir,
  args.execute
    ? "fix-vendor-application-submitted-dates-execute.json"
    : "fix-vendor-application-submitted-dates-dry-run.json"
)
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`Wrote ${outPath}`)
if (!args.execute) {
  console.log("Dry-run only. Re-run with --execute to apply.")
}
