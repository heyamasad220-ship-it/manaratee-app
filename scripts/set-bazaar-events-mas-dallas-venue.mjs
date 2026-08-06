/**
 * Set venue on all Vendor Hub events to "MAS Dallas Islamic Center".
 * Finds or creates the Facilities venue, then updates venue_id + location.
 *
 *   node scripts/set-bazaar-events-mas-dallas-venue.mjs
 *   node scripts/set-bazaar-events-mas-dallas-venue.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const VENUE_NAME = "MAS Dallas Islamic Center"

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

loadEnvLocal()
const execute = process.argv.includes("--execute")

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
  mode: execute ? "execute" : "dry-run",
  orgId: ORG_ID,
  venueName: VENUE_NAME,
  venueId: null,
  venueCreated: false,
  eventsTotal: 0,
  eventsUpdated: 0,
  sample: [],
}

const { data: venues, error: venuesError } = await sb
  .from("venues")
  .select("id, name")
  .eq("organization_id", ORG_ID)
  .ilike("name", VENUE_NAME)

if (venuesError) {
  console.error(venuesError)
  process.exit(1)
}

let venue = venues?.[0] ?? null

if (!venue) {
  const { data: allVenues } = await sb
    .from("venues")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .order("name")
  report.availableVenues = (allVenues || []).map((v) => v.name)
}

const { data: events, error: eventsError } = await sb
  .from("vendor_hub_events")
  .select("id, name, event_date, venue_id, location")
  .eq("organization_id", ORG_ID)
  .order("event_date", { ascending: false })

if (eventsError) {
  console.error(eventsError)
  process.exit(1)
}

report.eventsTotal = events?.length || 0
report.sample = (events || []).slice(0, 8).map((e) => ({
  id: e.id,
  name: e.name,
  venue_id: e.venue_id,
  location: e.location,
}))

if (!execute) {
  report.note = venue
    ? `Would link all ${report.eventsTotal} events to existing venue ${venue.id}`
    : `Would create venue "${VENUE_NAME}" then link all ${report.eventsTotal} events`
  report.venueId = venue?.id ?? null
  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "set-bazaar-events-mas-dallas-venue-dry-run.json")
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outPath}`)
  console.log("Dry-run only. Re-run with --execute to apply.")
  process.exit(0)
}

if (!venue) {
  const { data: created, error: createError } = await sb
    .from("venues")
    .insert({
      organization_id: ORG_ID,
      name: VENUE_NAME,
      status: "active",
    })
    .select("id, name")
    .single()

  if (createError) {
    // Retry without status if column missing
    const { data: created2, error: createError2 } = await sb
      .from("venues")
      .insert({
        organization_id: ORG_ID,
        name: VENUE_NAME,
      })
      .select("id, name")
      .single()
    if (createError2) {
      console.error("Create venue failed:", createError.message, createError2.message)
      process.exit(1)
    }
    venue = created2
  } else {
    venue = created
  }
  report.venueCreated = true
}

report.venueId = venue.id

const { data: updated, error: updateError } = await sb
  .from("vendor_hub_events")
  .update({
    venue_id: venue.id,
    location: VENUE_NAME,
  })
  .eq("organization_id", ORG_ID)
  .select("id")

if (updateError) {
  console.error(updateError)
  process.exit(1)
}

report.eventsUpdated = updated?.length || 0

const outDir = resolve(root, "scripts/reports")
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, "set-bazaar-events-mas-dallas-venue-execute.json")
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`\nWrote ${outPath}`)
