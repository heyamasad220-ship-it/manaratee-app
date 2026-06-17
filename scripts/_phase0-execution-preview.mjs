/**
 * Detailed pre-cleanup deletion preview (read-only counts).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  if (!process.env[k]) process.env[k] = v
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const ASAD = "95c4eb7d-b151-4aa1-a489-a3c1e1289c7e"
const RENTAL = "49ce1da2-fd1e-4f4c-9cfc-62c33e07eb9d"
const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const STRESS_TAG = "BETA_STRESS_V1"
const SEED_EMAILS = ["donations-seed-individual@dev.test", "donations-seed-org@dev.test"]

async function count(table, filters) {
  let q = sb.from(table).select("*", { count: "exact", head: true })
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "like") q = q.like(f.col, f.val)
    if (f.op === "in") q = q.in(f.col, f.val)
  }
  const { count, error } = await q
  return { count: count ?? 0, error: error?.message ?? null }
}

async function ids(table, select, filters, limit = 5000) {
  let q = sb.from(table).select(select).limit(limit)
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "like") q = q.like(f.col, f.val)
    if (f.op === "in") q = q.in(f.col, f.val)
  }
  const { data, error } = await q
  return { rows: data ?? [], error: error?.message ?? null }
}

// --- Asad seed cleanup preview (matches seed-donations-dev.mjs cleanSeed) ---
const asadSeedContacts = await ids("contacts", "id, email", [
  { op: "eq", col: "organization_id", val: ASAD },
  { op: "in", col: "email", val: SEED_EMAILS },
])
const asadSeedContactIds = asadSeedContacts.rows.map((r) => r.id)

const asadSeedDonors = asadSeedContactIds.length
  ? await ids("donors", "id", [{ op: "eq", col: "organization_id", val: ASAD }, { op: "in", col: "contact_id", val: asadSeedContactIds }])
  : { rows: [] }
const asadSeedDonorIds = asadSeedDonors.rows.map((r) => r.id)

const asadSeedPledges = asadSeedDonorIds.length
  ? await ids("pledges", "id", [{ op: "eq", col: "organization_id", val: ASAD }, { op: "in", col: "donor_id", val: asadSeedDonorIds }])
  : { rows: [] }
const asadSeedPledgeIds = asadSeedPledges.rows.map((r) => r.id)

const asadSeedPreview = {
  contacts: asadSeedContactIds.length,
  people_orphan_after_contacts: asadSeedContactIds.length,
  donors: asadSeedDonorIds.length,
  pledges: asadSeedPledgeIds.length,
  payments_on_pledges: asadSeedPledgeIds.length
    ? (await count("payments", [
        { op: "eq", col: "organization_id", val: ASAD },
        { op: "in", col: "pledge_id", val: asadSeedPledgeIds },
      ])).count
    : 0,
  payments_by_memo: (await count("payments", [
    { op: "eq", col: "organization_id", val: ASAD },
    { op: "eq", col: "memo", val: SEED_TAG },
  ])).count,
  payments_by_sender: (await count("payments", [
    { op: "eq", col: "organization_id", val: ASAD },
    { op: "like", col: "sender_name", val: "Seed Import%" },
  ])).count,
  campaign_dev_ramadan: (await count("campaigns", [
    { op: "eq", col: "organization_id", val: ASAD },
    { op: "eq", col: "code", val: "DEV-RAMADAN-2026" },
  ])).count,
  payment_import_batches: (await count("payment_import_batches", [
    { op: "eq", col: "organization_id", val: ASAD },
    { op: "like", col: "file_name", val: "donations-import-test%" },
  ])).count,
}

// --- MAS stress preview (approved target org) ---
const masStressDonors = await ids("donors", "id", [
  { op: "eq", col: "organization_id", val: MAS },
  { op: "like", col: "email", val: `${STRESS_TAG}%` },
])
const masStressDonorIds = masStressDonors.rows.map((r) => r.id)

const masStressPreview = {
  stressDonors: masStressDonorIds.length,
  stressCampaigns: (
    await count("campaigns", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "like", col: "code", val: `${STRESS_TAG}%` },
    ])
  ).count,
  paymentsLinked: masStressDonorIds.length
    ? (
        await count("payments", [
          { op: "eq", col: "organization_id", val: MAS },
          { op: "in", col: "donor_id", val: masStressDonorIds },
        ])
      ).count
    : 0,
  pledgesLinked: masStressDonorIds.length
    ? (
        await count("pledges", [
          { op: "eq", col: "organization_id", val: MAS },
          { op: "in", col: "donor_id", val: masStressDonorIds },
        ])
      ).count
    : 0,
  paymentsByStressSender: (
    await count("payments", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "like", col: "sender_name", val: `${STRESS_TAG}%` },
    ])
  ).count,
}

// --- Asad stress (actual location — NOT in current approval item 5) ---
const asadStressDonors = await ids("donors", "id", [
  { op: "eq", col: "organization_id", val: ASAD },
  { op: "like", col: "email", val: `${STRESS_TAG}%` },
])
const asadStressDonorIds = asadStressDonors.rows.map((r) => r.id)

const asadStressPreview = {
  stressDonors: asadStressDonorIds.length,
  stressCampaigns: (
    await count("campaigns", [
      { op: "eq", col: "organization_id", val: ASAD },
      { op: "like", col: "code", val: `${STRESS_TAG}%` },
    ])
  ).count,
  paymentsLinked: (
    await count("payments", [
      { op: "eq", col: "organization_id", val: ASAD },
      { op: "in", col: "donor_id", val: asadStressDonorIds },
    ])
  ).count,
  pledgesLinked: (
    await count("pledges", [
      { op: "eq", col: "organization_id", val: ASAD },
      { op: "in", col: "donor_id", val: asadStressDonorIds },
    ])
  ).count,
  paymentsByStressSender: (
    await count("payments", [
      { op: "eq", col: "organization_id", val: ASAD },
      { op: "like", col: "sender_name", val: `${STRESS_TAG}%` },
    ])
  ).count,
}

// --- MAS other approved targets ---
const masVenuePreview = {
  venue_rentals: (await count("venue_rentals", [{ op: "eq", col: "id", val: RENTAL }])).count,
  rental_reservations: (
    await count("rental_reservations", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "eq", col: "venue_rental_id", val: RENTAL },
    ])
  ).count,
  rental_payments: (
    await count("rental_payments", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "eq", col: "venue_rental_id", val: RENTAL },
    ])
  ).count,
  rental_contracts: (
    await count("rental_contracts", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "eq", col: "venue_rental_id", val: RENTAL },
    ])
  ).count,
  rental_selected_addons: (
    await count("rental_selected_addons", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "eq", col: "venue_rental_id", val: RENTAL },
    ])
  ).count,
  resource_reservations_by_reservation: 0,
  venue_bookings_mas: (await count("venue_bookings", [{ op: "eq", col: "organization_id", val: MAS }])).count,
  reservation_override_logs_preserved: (
    await count("reservation_override_logs", [{ op: "eq", col: "organization_id", val: MAS }])
  ).count,
}

const rentalRes = await ids("rental_reservations", "id", [
  { op: "eq", col: "organization_id", val: MAS },
  { op: "eq", col: "venue_rental_id", val: RENTAL },
])
if (rentalRes.rows.length) {
  masVenuePreview.resource_reservations_by_reservation = (
    await count("resource_reservations", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "eq", col: "source_type", val: "venue_rental" },
      { op: "in", col: "source_id", val: rentalRes.rows.map((r) => r.id) },
    ])
  ).count
}

const masImportStaging = (await count("contact_import_staging", [{ op: "eq", col: "organization_id", val: MAS }])).count

// MAS seed (NOT approved for cleanup — informational)
const masSeedContacts = await ids("contacts", "id, email", [
  { op: "eq", col: "organization_id", val: MAS },
  { op: "in", col: "email", val: SEED_EMAILS },
])
const masSeedContactIds = masSeedContacts.rows.map((r) => r.id)
const masSeedDonors = masSeedContactIds.length
  ? await ids("donors", "id", [{ op: "eq", col: "organization_id", val: MAS }, { op: "in", col: "contact_id", val: masSeedContactIds }])
  : { rows: [] }

const report = {
  capturedAt: new Date().toISOString(),
  approvedExecutionPreview: {
    phase1_asad_seed_only: asadSeedPreview,
    phase2_mas_stress_as_approved: masStressPreview,
    phase3_mas_import_staging: { rows: masImportStaging },
    phase4_mas_venue_rental_chain: masVenuePreview,
  },
  criticalFinding: {
    message:
      "BETA_STRESS_V1 bulk data (10,000 payments, 1,000 donors) is on ASAD REALTY, not MAS Dallas. Approved item 5 targeting MAS is currently a NO-OP for stress tags.",
    asadStressActualLocation: asadStressPreview,
  },
  outOfScopeButPresentOnMasPilotOrg: {
    masSeedContacts: masSeedContacts.rows,
    masSeedDonors: masSeedDonors.rows.length,
    masPaymentsWithSeedMemo: (
      await count("payments", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "like", col: "memo", val: `${SEED_TAG}%` },
      ])
    ).count,
    realContactPreserved: {
      email: "heyamasad220@gmail.com",
      full_name: "Heyam Asad",
    },
  },
  preserveUnchanged: {
    reservation_override_logs: masVenuePreview.reservation_override_logs_preserved,
    platform_admin_org_access_log: (await count("platform_admin_org_access_log", [])).count,
    organization_members: (await count("organization_members", [])).count,
    role_permissions: (await count("role_permissions", [])).count,
    profiles: (await count("profiles", [])).count,
    organizations: (await count("organizations", [])).count,
  },
}

const outDir = resolve(root, "scripts/reports")
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, "pilot-cleanup-execution-preview.json")
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ ok: true, outPath, report }, null, 2))
