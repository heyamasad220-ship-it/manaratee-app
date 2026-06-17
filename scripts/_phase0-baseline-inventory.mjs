/**
 * Phase 0 read-only baseline inventory for pilot cleanup.
 * Does not modify any data.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const MAS_DALLAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const ASAD_REALTY = "95c4eb7d-b151-4aa1-a489-a3c1e1289c7e"
const EXPERIMENTAL_RENTAL_ID = "49ce1da2-fd1e-4f4c-9cfc-62c33e07eb9d"

const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const STRESS_TAG = "BETA_STRESS_V1"
const SEED_EMAILS = [
  "donations-seed-individual@dev.test",
  "donations-seed-org@dev.test",
]
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"

function loadEnvLocal() {
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

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Missing Supabase credentials")

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function count(table, filters = []) {
  let q = sb.from(table).select("*", { count: "exact", head: true })
  for (const [op, ...args] of filters) {
    if (op === "eq") q = q.eq(args[0], args[1])
    else if (op === "like") q = q.like(args[0], args[1])
    else if (op === "in") q = q.in(args[0], args[1])
    else if (op === "or") q = q.or(args[0])
  }
  const { count: n, error } = await q
  if (error) return { count: null, error: error.message }
  return { count: n ?? 0, error: null }
}

async function listIds(table, select, filters = [], limit = 5000) {
  let q = sb.from(table).select(select).limit(limit)
  for (const [op, ...args] of filters) {
    if (op === "eq") q = q.eq(args[0], args[1])
    else if (op === "like") q = q.like(args[0], args[1])
    else if (op === "in") q = q.in(args[0], args[1])
  }
  const { data, error } = await q
  if (error) return { rows: [], error: error.message }
  return { rows: data ?? [], error: null }
}

async function main() {
  const report = {
    capturedAt: new Date().toISOString(),
    phase: "phase0-baseline",
    organizations: {
      masDallas: MAS_DALLAS,
      asadRealty: ASAD_REALTY,
    },
    preserveCounts: {},
    asadSeedTargets: {},
    masStressTargets: {},
    masImportStaging: {},
    masVenueRentalChain: {},
    contactsInventory: {},
    authSummary: {},
    backupTables: {},
  }

  const preserveTables = [
    "organizations",
    "profiles",
    "organization_members",
    "organization_users",
    "organization_roles",
    "role_permissions",
    "platform_admins",
    "platform_settings",
    "organization_modules",
    "organization_sidebar_modules",
    "modules",
    "plans",
    "plan_modules",
    "plan_limits",
    "platform_admin_org_access_log",
    "reservation_override_logs",
  ]

  for (const table of preserveTables) {
    report.preserveCounts[table] = await count(table)
  }

  const inviteCount = await count("organization_invites")
  report.preserveCounts.organization_invites = inviteCount

  for (const table of [
    "backup_donors_2026_05_24",
    "backup_payments_2026_05_24",
    "backup_donation_pledges_2026_05_24",
    "backup_donation_payments_2026_05_24",
    "backup_pledges_2026_05_24",
  ]) {
    report.backupTables[table] = await count(table)
  }

  // Asad seed targets
  const seedContacts = await listIds(
    "contacts",
    "id, email, full_name, notes, organization_id",
    [["eq", "organization_id", ASAD_REALTY]]
  )
  report.contactsInventory.asadAll = seedContacts.rows
  report.asadSeedTargets.seedContactsByEmail = seedContacts.rows.filter((c) =>
    SEED_EMAILS.includes(c.email)
  )
  report.asadSeedTargets.seedContactsByNotes = seedContacts.rows.filter((c) =>
    (c.notes || "").includes(SEED_TAG)
  )

  report.asadSeedTargets.campaignDevRamadan = await count("campaigns", [
    ["eq", "organization_id", ASAD_REALTY],
    ["eq", "code", SEED_CAMPAIGN_CODE],
  ])

  const asadDonorsAll = await count("donors", [["eq", "organization_id", ASAD_REALTY]])
  report.asadSeedTargets.donorsTotal = asadDonorsAll

  report.asadSeedTargets.paymentsByMemo = await count("payments", [
    ["eq", "organization_id", ASAD_REALTY],
    ["eq", "memo", SEED_TAG],
  ])
  report.asadSeedTargets.paymentsBySender = await count("payments", [
    ["eq", "organization_id", ASAD_REALTY],
    ["like", "sender_name", "Seed Import%"],
  ])
  report.asadSeedTargets.paymentImportBatches = await count("payment_import_batches", [
    ["eq", "organization_id", ASAD_REALTY],
    ["like", "file_name", "donations-import-test%"],
  ])

  // MAS stress targets
  report.masStressTargets.stressDonors = await count("donors", [
    ["eq", "organization_id", MAS_DALLAS],
    ["like", "email", `${STRESS_TAG}%`],
  ])
  report.masStressTargets.stressCampaigns = await count("campaigns", [
    ["eq", "organization_id", MAS_DALLAS],
    ["like", "code", `${STRESS_TAG}%`],
  ])

  const stressDonorIds = await listIds(
    "donors",
    "id",
    [
      ["eq", "organization_id", MAS_DALLAS],
      ["like", "email", `${STRESS_TAG}%`],
    ],
    2000
  )
  const ids = stressDonorIds.rows.map((r) => r.id)
  report.masStressTargets.stressDonorIdCount = ids.length

  if (ids.length > 0) {
    report.masStressTargets.paymentsLinkedToStressDonors = await count("payments", [
      ["eq", "organization_id", MAS_DALLAS],
      ["in", "donor_id", ids],
    ])
    report.masStressTargets.pledgesLinkedToStressDonors = await count("pledges", [
      ["eq", "organization_id", MAS_DALLAS],
      ["in", "donor_id", ids],
    ])
  } else {
    report.masStressTargets.paymentsLinkedToStressDonors = { count: 0, error: null }
    report.masStressTargets.pledgesLinkedToStressDonors = { count: 0, error: null }
  }

  report.masStressTargets.donorsTotal = await count("donors", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.paymentsTotal = await count("payments", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.pledgesTotal = await count("pledges", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.campaignsTotal = await count("campaigns", [
    ["eq", "organization_id", MAS_DALLAS],
  ])

  report.masStressTargets.recurringPlans = await count("recurring_donation_plans", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.donationReceipts = await count("donation_receipts", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.pledgeReminders = await count("pledge_reminders", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.checkoutSessions = await count("donation_checkout_sessions", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.processorEvents = await count("payment_processor_events", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.transactionalEmailLog = await count("transactional_email_log", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.paymentImportBatches = await count("payment_import_batches", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.paymentImportRows = await count("payment_import_rows", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masStressTargets.donorImportBatches = await count("donor_import_batches", [
    ["eq", "organization_id", MAS_DALLAS],
  ])

  report.masImportStaging.total = await count("contact_import_staging", [
    ["eq", "organization_id", MAS_DALLAS],
  ])

  // Venue rental chain
  report.masVenueRentalChain.rental = await listIds(
    "venue_rentals",
    "id, status, organization_id",
    [
      ["eq", "id", EXPERIMENTAL_RENTAL_ID],
      ["eq", "organization_id", MAS_DALLAS],
    ],
    1
  )
  report.masVenueRentalChain.rentalReservations = await count("rental_reservations", [
    ["eq", "organization_id", MAS_DALLAS],
    ["eq", "venue_rental_id", EXPERIMENTAL_RENTAL_ID],
  ])
  report.masVenueRentalChain.rentalPayments = await count("rental_payments", [
    ["eq", "organization_id", MAS_DALLAS],
    ["eq", "venue_rental_id", EXPERIMENTAL_RENTAL_ID],
  ])
  report.masVenueRentalChain.rentalContracts = await count("rental_contracts", [
    ["eq", "organization_id", MAS_DALLAS],
    ["eq", "venue_rental_id", EXPERIMENTAL_RENTAL_ID],
  ])
  report.masVenueRentalChain.rentalSelectedAddons = await count("rental_selected_addons", [
    ["eq", "organization_id", MAS_DALLAS],
    ["eq", "venue_rental_id", EXPERIMENTAL_RENTAL_ID],
  ])

  const { rows: reservations } = await listIds(
    "rental_reservations",
    "id",
    [
      ["eq", "organization_id", MAS_DALLAS],
      ["eq", "venue_rental_id", EXPERIMENTAL_RENTAL_ID],
    ],
    10
  )
  const reservationIds = reservations.map((r) => r.id)
  if (reservationIds.length) {
    report.masVenueRentalChain.resourceReservations = await count(
      "resource_reservations",
      [
        ["eq", "organization_id", MAS_DALLAS],
        ["in", "source_id", reservationIds],
      ]
    )
  } else {
    report.masVenueRentalChain.resourceReservations = { count: 0, error: null }
  }

  report.masVenueRentalChain.venueBookings = await count("venue_bookings", [
    ["eq", "organization_id", MAS_DALLAS],
  ])
  report.masVenueRentalChain.overrideLogsPreserved = await count(
    "reservation_override_logs",
    [["eq", "organization_id", MAS_DALLAS]]
  )

  // Contacts inventory
  const masContacts = await listIds(
    "contacts",
    "id, email, full_name, notes, organization_id, person_id",
    [["eq", "organization_id", MAS_DALLAS]],
    100
  )
  report.contactsInventory.masAll = masContacts.rows

  const authUsers = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  report.authSummary.authUsersTotal = authUsers.data?.users?.length ?? null
  report.authSummary.authUsersError = authUsers.error?.message ?? null
  report.authSummary.profileCount = (await count("profiles")).count

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "pilot-cleanup-phase0-baseline.json")
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ok: true, reportPath: outPath, summary: report }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
