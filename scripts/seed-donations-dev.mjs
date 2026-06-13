/**
 * Dev-only canonical donations seed (no legacy tables).
 *
 * Usage:
 *   node scripts/seed-donations-dev.mjs --confirm-dev
 *   node scripts/seed-donations-dev.mjs --confirm-dev --clean
 *   DONATIONS_SEED_ORG_ID=<uuid> node scripts/seed-donations-dev.mjs --confirm-dev
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (dev project only).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const SEED_EMAIL_INDIVIDUAL = "donations-seed-individual@dev.test"
const SEED_EMAIL_ORG = "donations-seed-org@dev.test"
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"

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
  return {
    confirmDev: argv.includes("--confirm-dev"),
    clean: argv.includes("--clean"),
  }
}

loadEnvLocal()

const { confirmDev, clean } = parseArgs(process.argv.slice(2))

if (!confirmDev) {
  console.error("Refusing to run without --confirm-dev")
  process.exit(1)
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed when NODE_ENV=production")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function resolveOrganizationId() {
  const explicit = process.env.DONATIONS_SEED_ORG_ID
  if (explicit) return explicit

  const { data, error } = await sb.from("organizations").select("id, name").limit(1).maybeSingle()
  if (error || !data?.id) {
    throw new Error(error?.message || "No organization found to seed")
  }
  return data.id
}

async function findSeedContacts(orgId) {
  const { data } = await sb
    .from("contacts")
    .select("id, email, full_name, contact_type")
    .eq("organization_id", orgId)
    .in("email", [SEED_EMAIL_INDIVIDUAL, SEED_EMAIL_ORG])

  return data || []
}

async function cleanSeed(orgId) {
  console.log(`Cleaning seed data tagged ${SEED_TAG} for org ${orgId}...`)

  const seedContacts = await findSeedContacts(orgId)
  const contactIds = seedContacts.map((c) => c.id)

  const { data: seedDonors } = contactIds.length
    ? await sb.from("donors").select("id").eq("organization_id", orgId).in("contact_id", contactIds)
    : { data: [] }
  const donorIds = (seedDonors || []).map((d) => d.id)

  const { data: seedPledges } = donorIds.length
    ? await sb.from("pledges").select("id").eq("organization_id", orgId).in("donor_id", donorIds)
    : { data: [] }
  const pledgeIds = (seedPledges || []).map((p) => p.id)

  if (pledgeIds.length) {
    await sb.from("payments").delete().eq("organization_id", orgId).in("pledge_id", pledgeIds)
  }

  await sb.from("payments").delete().eq("organization_id", orgId).eq("memo", SEED_TAG)
  await sb
    .from("payments")
    .delete()
    .eq("organization_id", orgId)
    .like("sender_name", "Seed Import%")

  if (pledgeIds.length) {
    await sb.from("pledges").delete().in("id", pledgeIds)
  }

  const { data: batches } = await sb
    .from("payment_import_batches")
    .select("id")
    .eq("organization_id", orgId)
    .like("file_name", "donations-import-test%")

  const batchIds = (batches || []).map((b) => b.id)
  if (batchIds.length) {
    await sb.from("payment_import_rows").delete().in("batch_id", batchIds)
    await sb.from("payment_import_batches").delete().in("id", batchIds)
  }

  if (donorIds.length) {
    await sb.from("donors").delete().in("id", donorIds)
  }

  for (const contact of seedContacts) {
    if (contact.id) {
      await sb.from("contacts").delete().eq("id", contact.id)
    }
  }

  await sb.from("campaigns").delete().eq("organization_id", orgId).eq("code", SEED_CAMPAIGN_CODE)

  const categoryNames = ["Seed Zakat", "Seed Sadaqah"]
  const { data: categories } = await sb
    .from("donation_categories")
    .select("id")
    .eq("organization_id", orgId)
    .in("name", categoryNames)

  const categoryIds = (categories || []).map((c) => c.id)
  if (categoryIds.length) {
    await sb.from("donation_subcategories").delete().eq("organization_id", orgId).in("category_id", categoryIds)
    await sb.from("donation_categories").delete().in("id", categoryIds)
  }

  const methodNames = ["Seed Cash", "Seed Zelle", "Seed Venmo", "Seed Check"]
  await sb.from("payment_methods").delete().eq("organization_id", orgId).in("name", methodNames)

  console.log("Clean complete.")
}

async function ensurePerson(orgId, { firstName, lastName, email }) {
  const { data: existing } = await sb
    .from("people")
    .select("id")
    .eq("organization_id", orgId)
    .eq("email", email)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data, error } = await sb
    .from("people")
    .insert({
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      email,
      person_type: "contact",
    })
    .select("id")
    .single()

  if (error) throw new Error(`people insert: ${error.message}`)
  return data.id
}

async function ensureContact(orgId, { email, fullName, contactType, firstName, lastName }) {
  const existing = (await findSeedContacts(orgId)).find((c) => c.email === email)
  if (existing?.id) return existing.id

  const personId = await ensurePerson(orgId, { firstName, lastName, email })

  const { data, error } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      person_id: personId,
      full_name: fullName,
      email,
      contact_type: contactType,
      status: "active",
      notes: SEED_TAG,
    })
    .select("id")
    .single()

  if (error) throw new Error(`contacts insert: ${error.message}`)
  return data.id
}

async function ensureDonor(orgId, contactId, row) {
  const { data: existing } = await sb
    .from("donors")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data, error } = await sb
    .from("donors")
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      full_name: row.full_name,
      email: row.email,
      donor_type: row.donor_type,
      status: "active",
    })
    .select("id")
    .single()

  if (error) throw new Error(`donors insert: ${error.message}`)
  return data.id
}

async function seed(orgId) {
  const { data: org } = await sb.from("organizations").select("id, name").eq("id", orgId).single()
  console.log(`Seeding canonical donations for org: ${org?.name || orgId}`)

  const individualContactId = await ensureContact(orgId, {
    email: SEED_EMAIL_INDIVIDUAL,
    fullName: "Seed Individual Donor",
    contactType: "individual",
    firstName: "Seed",
    lastName: "Donor",
  })

  const orgContactId = await ensureContact(orgId, {
    email: SEED_EMAIL_ORG,
    fullName: "Seed Organization Donor",
    contactType: "organization",
    firstName: "Seed",
    lastName: "Org",
  })

  const individualDonorId = await ensureDonor(orgId, individualContactId, {
    full_name: "Seed Individual Donor",
    email: SEED_EMAIL_INDIVIDUAL,
    donor_type: "individual",
  })

  const orgDonorId = await ensureDonor(orgId, orgContactId, {
    full_name: "Seed Organization Donor",
    email: SEED_EMAIL_ORG,
    donor_type: "organization",
  })

  const { data: campaign, error: campaignError } = await sb
    .from("campaigns")
    .insert({
      organization_id: orgId,
      name: "Seed Ramadan 2026",
      code: SEED_CAMPAIGN_CODE,
      description: "Seed campaign for canonical donations analytics validation",
      goal_amount: 5000,
      start_date: "2026-03-01",
      end_date: "2026-04-30",
      status: "active",
    })
    .select("id")
    .single()

  if (campaignError) throw new Error(`campaigns insert: ${campaignError.message}`)

  const categories = []
  for (const name of ["Seed Zakat", "Seed Sadaqah"]) {
    const { data, error } = await sb
      .from("donation_categories")
      .insert({
        organization_id: orgId,
        name,
        description: SEED_TAG,
        tax_deductible: true,
      })
      .select("id, name")
      .single()
    if (error) throw new Error(`donation_categories insert: ${error.message}`)
    categories.push(data)
  }

  const zakatCategory = categories.find((c) => c.name === "Seed Zakat")
  const funds = []
  for (const fundName of ["Seed General Fund", "Seed Scholarship Fund"]) {
    const { data, error } = await sb
      .from("donation_subcategories")
      .insert({
        organization_id: orgId,
        category_id: zakatCategory.id,
        name: fundName,
      })
      .select("id, name")
      .single()
    if (error) throw new Error(`donation_subcategories insert: ${error.message}`)
    funds.push(data)
  }

  const seedAttribution = {
    campaign_id: campaign.id,
    category_id: zakatCategory.id,
    subcategory_id: funds[0].id,
  }

  const paymentMethods = []
  for (const [name, fee] of [
    ["Seed Cash", "None"],
    ["Seed Zelle", "None"],
    ["Seed Venmo", "1.9%"],
    ["Seed Check", "None"],
  ]) {
    const { data, error } = await sb
      .from("payment_methods")
      .insert({
        organization_id: orgId,
        name,
        fee,
        enabled: true,
      })
      .select("id, name")
      .single()
    if (error) throw new Error(`payment_methods insert: ${error.message}`)
    paymentMethods.push(data)
  }

  const pledgeSpecs = [
    {
      donor_id: individualDonorId,
      contact_id: individualContactId,
      amount_pledged: 1000,
      label: "partial",
      payments: [150, 100],
    },
    {
      donor_id: individualDonorId,
      contact_id: individualContactId,
      amount_pledged: 500,
      label: "fulfilled",
      payments: [300, 200],
    },
    {
      donor_id: orgDonorId,
      contact_id: orgContactId,
      amount_pledged: 300,
      label: "open",
      payments: [],
    },
  ]

  const pledgeIds = []
  for (const spec of pledgeSpecs) {
    const { data, error } = await sb
      .from("pledges")
      .insert({
        organization_id: orgId,
        donor_id: spec.donor_id,
        campaign_id: campaign.id,
        category_id: zakatCategory.id,
        subcategory_id: funds[0].id,
        amount_pledged: spec.amount_pledged,
        pledge_date: "2026-06-01",
        pledge_type: "one_time",
        frequency: "one_time",
        status: "open",
        notes: `${SEED_TAG} ${spec.label}`,
      })
      .select("id, amount_pledged")
      .single()

    if (error) throw new Error(`pledges insert: ${error.message}`)
    pledgeIds.push({ id: data.id, ...spec })

    for (const [index, amount] of spec.payments.entries()) {
      const { error: payError } = await sb.from("payments").insert({
        organization_id: orgId,
        donor_id: spec.donor_id,
        contact_id: spec.contact_id,
        pledge_id: data.id,
        sender_name: spec.contact_id === individualContactId ? "Seed Individual Donor" : "Seed Organization Donor",
        amount,
        payment_date: `2026-06-0${index + 1}T12:00:00`,
        source: index === 0 ? "zelle" : "cash",
        source_type: "manual",
        memo: `${SEED_TAG} pledge payment`,
        status: "allocated",
        is_verified: true,
        ...seedAttribution,
      })
      if (payError) throw new Error(`payments insert (pledge): ${payError.message}`)
    }
  }

  const oneTimePayments = [
    {
      donor_id: individualDonorId,
      contact_id: individualContactId,
      amount: 50,
      source: "cash",
      status: "unallocated",
      sender_name: "Seed Individual Donor",
    },
    {
      donor_id: orgDonorId,
      contact_id: orgContactId,
      amount: 200,
      source: "check",
      status: "unallocated",
      sender_name: "Seed Organization Donor",
    },
  ]

  for (const row of oneTimePayments) {
    const { error } = await sb.from("payments").insert({
      organization_id: orgId,
      donor_id: row.donor_id,
      contact_id: row.contact_id,
      pledge_id: null,
      sender_name: row.sender_name,
      amount: row.amount,
      payment_date: "2026-06-08T12:00:00",
      source: row.source,
      source_type: "manual",
      memo: SEED_TAG,
      status: row.status,
      is_verified: false,
      ...seedAttribution,
    })
    if (error) throw new Error(`payments insert (one-time): ${error.message}`)
  }

  const { data: importBatch, error: batchError } = await sb
    .from("payment_import_batches")
    .insert({
      organization_id: orgId,
      file_name: "donations-import-test.csv",
      row_count: 2,
      status: "uploaded",
    })
    .select("id")
    .single()

  if (batchError) throw new Error(`payment_import_batches insert: ${batchError.message}`)

  const importRows = [
    {
      sender_name: "Seed Import Donor",
      amount: 75,
      payment_date: "2026-06-10",
      reference: "ZELLE-SEED-001",
      campaign: "Seed Ramadan 2026",
      category: "Seed Zakat",
      fund: "Seed General Fund",
      import_status: "pending",
    },
    {
      sender_name: "Unknown Import Name",
      amount: 120.5,
      payment_date: "2026-06-11",
      reference: "CHK-SEED-002",
      import_status: "pending",
    },
  ]

  for (const row of importRows) {
    const { error } = await sb.from("payment_import_rows").insert({
      batch_id: importBatch.id,
      organization_id: orgId,
      sender_name: row.sender_name,
      amount: row.amount,
      payment_date: row.payment_date,
      reference: row.reference,
      raw_row: row,
      import_status: row.import_status,
    })
    if (error) throw new Error(`payment_import_rows insert: ${error.message}`)
  }

  const { error: importedPaymentError } = await sb.from("payments").insert({
    organization_id: orgId,
    donor_id: null,
    contact_id: null,
    pledge_id: null,
    sender_name: "Seed Import Donor",
    amount: 75,
    payment_date: "2026-06-10T12:00:00",
    source: "import",
    source_type: "import",
    memo: "ZELLE-SEED-001",
    status: "pending_review",
    is_verified: false,
    ...seedAttribution,
  })

  if (importedPaymentError) {
    throw new Error(`payments insert (import queue): ${importedPaymentError.message}`)
  }

  return {
    orgId,
    orgName: org?.name,
    individualContactId,
    orgContactId,
    individualDonorId,
    orgDonorId,
    campaignId: campaign.id,
    categoryIds: categories.map((c) => c.id),
    fundIds: funds.map((f) => f.id),
    paymentMethodIds: paymentMethods.map((m) => m.id),
    pledgeIds: pledgeIds.map((p) => p.id),
    importBatchId: importBatch.id,
    seedTag: SEED_TAG,
  }
}

try {
  const orgId = await resolveOrganizationId()
  const existing = await findSeedContacts(orgId)

  if (clean) {
    await cleanSeed(orgId)
    if (!confirmDev) {
      console.log("Clean complete.")
      process.exit(0)
    }
    // --clean --confirm-dev: reset then re-seed below
  } else if (existing.length > 0) {
    console.error(
      "Seed contacts already exist. Run with --clean --confirm-dev to reset and re-seed."
    )
    process.exit(1)
  }

  const result = await seed(orgId)
  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2))
  process.exit(1)
}
