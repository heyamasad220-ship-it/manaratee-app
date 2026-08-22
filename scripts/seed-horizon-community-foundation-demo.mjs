/**
 * Demo seed for Horizon Community Foundation only (donations + directory).
 *
 * Usage:
 *   node scripts/seed-horizon-community-foundation-demo.mjs --execute
 *   node scripts/seed-horizon-community-foundation-demo.mjs --clean --execute
 *   node scripts/seed-horizon-community-foundation-demo.mjs --wishlist-only --execute
 *
 * Safety: refuses any org that is not named Horizon Community Foundation.
 */
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const SEED_TAG = "HORIZON_DEMO_SEED_V1"
const ORG_NAME = "Horizon Community Foundation"
const EMAIL_DOMAIN = "horizon-demo.example"
const CAMPAIGN_ANNUAL_CODE = "HCF-ANNUAL-2026"
const CAMPAIGN_SCHOLAR_CODE = "HCF-SCHOLAR-2026"

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
    execute: argv.includes("--execute"),
    clean: argv.includes("--clean") || argv.includes("--clean-only"),
    cleanOnly: argv.includes("--clean-only"),
    wishlistOnly: argv.includes("--wishlist-only"),
  }
}

function emailFor(firstName, lastName) {
  return `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${EMAIL_DOMAIN}`
}

function publicToken() {
  return randomBytes(12).toString("hex")
}

function throwIfError(label, error) {
  if (error) throw new Error(`${label}: ${error.message}`)
}

loadEnvLocal()

const { execute, clean, cleanOnly, wishlistOnly } = parseArgs(process.argv.slice(2))

if (!execute) {
  console.error("Refusing to run without --execute")
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

const PEOPLE = [
  {
    firstName: "James",
    lastName: "Whitaker",
    phone: "512-555-0142",
    city: "Austin, TX",
    donor: true,
  },
  {
    firstName: "Emily",
    lastName: "Chen",
    phone: "415-555-0198",
    city: "San Francisco, CA",
    donor: true,
  },
  {
    firstName: "Michael",
    lastName: "Brooks",
    phone: "312-555-0174",
    city: "Chicago, IL",
    donor: false,
  },
  {
    firstName: "Priya",
    lastName: "Sharma",
    phone: "469-555-0116",
    city: "Plano, TX",
    donor: true,
  },
  {
    firstName: "Rajesh",
    lastName: "Iyer",
    phone: "206-555-0133",
    city: "Seattle, WA",
    donor: false,
  },
  {
    firstName: "Sofia",
    lastName: "Alvarez",
    phone: "305-555-0187",
    city: "Miami, FL",
    donor: true,
  },
  {
    firstName: "David",
    lastName: "Okonkwo",
    phone: "713-555-0160",
    city: "Houston, TX",
    donor: true,
  },
  {
    firstName: "Hannah",
    lastName: "Kim",
    phone: "734-555-0129",
    city: "Ann Arbor, MI",
    donor: false,
  },
  {
    firstName: "Layla",
    lastName: "Haddad",
    phone: "214-555-0104",
    city: "Dallas, TX",
    donor: false,
  },
  {
    firstName: "Grace",
    lastName: "Thompson",
    phone: "720-555-0155",
    city: "Denver, CO",
    donor: false,
  },
]

const ORG_CONTACT = {
  name: "Lakeside Family Fund",
  email: `lakeside.family.fund@${EMAIL_DOMAIN}`,
  phone: "612-555-0190",
  city: "Minneapolis, MN",
}

async function resolveHorizonOrg() {
  const { data, error } = await sb
    .from("organizations")
    .select("id, name, slug")
    .ilike("name", ORG_NAME)
    .maybeSingle()

  throwIfError("find organization", error)
  if (!data?.id) {
    throw new Error(`Organization "${ORG_NAME}" was not found.`)
  }
  if (data.name.trim().toLowerCase() !== ORG_NAME.toLowerCase()) {
    throw new Error(`Refusing to seed org "${data.name}". Expected "${ORG_NAME}".`)
  }
  return data
}

async function findSeedContacts(orgId) {
  const { data, error } = await sb
    .from("contacts")
    .select("id, email, full_name, contact_type")
    .eq("organization_id", orgId)
    .or(`notes.eq.${SEED_TAG},email.ilike.%@${EMAIL_DOMAIN}`)

  throwIfError("find seed contacts", error)
  return data || []
}

async function cleanSeed(orgId) {
  console.log(`Cleaning ${SEED_TAG} from ${ORG_NAME}...`)
  const seedContacts = await findSeedContacts(orgId)
  const contactIds = seedContacts.map((row) => row.id)

  const { data: seedCampaigns } = await sb
    .from("campaigns")
    .select("id")
    .eq("organization_id", orgId)
    .in("code", [CAMPAIGN_ANNUAL_CODE, CAMPAIGN_SCHOLAR_CODE])
  const campaignIds = (seedCampaigns || []).map((row) => row.id)

  await sb.from("payments").delete().eq("organization_id", orgId).ilike("memo", `%${SEED_TAG}%`)

  if (contactIds.length) {
    await sb.from("payments").delete().eq("organization_id", orgId).in("contact_id", contactIds)
  }

  const { data: seedDonors } = contactIds.length
    ? await sb.from("donors").select("id").eq("organization_id", orgId).in("contact_id", contactIds)
    : { data: [] }
  const donorIds = (seedDonors || []).map((row) => row.id)

  if (donorIds.length) {
    await sb.from("pledges").delete().eq("organization_id", orgId).in("donor_id", donorIds)
    await sb.from("donors").delete().in("id", donorIds)
  }

  await sb.from("pledges").delete().eq("organization_id", orgId).ilike("notes", `%${SEED_TAG}%`)

  if (campaignIds.length) {
    await sb.from("campaign_prospects").delete().eq("organization_id", orgId).in("campaign_id", campaignIds)
    await sb.from("campaign_wishlist_items").delete().eq("organization_id", orgId).in("campaign_id", campaignIds)
    await sb.from("campaign_ask_levels").delete().eq("organization_id", orgId).in("campaign_id", campaignIds)
    await sb.from("campaigns").delete().eq("organization_id", orgId).in("id", campaignIds)
  }

  if (contactIds.length) {
    await sb.from("contact_roles").delete().eq("organization_id", orgId).in("contact_id", contactIds)
    await sb.from("contacts").delete().eq("organization_id", orgId).in("id", contactIds)
  }

  const { data: people } = await sb
    .from("people")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("email", `%@${EMAIL_DOMAIN}`)
  const peopleIds = (people || []).map((row) => row.id)
  if (peopleIds.length) {
    await sb.from("people").delete().eq("organization_id", orgId).in("id", peopleIds)
  }

  const { data: categories } = await sb
    .from("donation_categories")
    .select("id")
    .eq("organization_id", orgId)
    .eq("description", SEED_TAG)
  const categoryIds = (categories || []).map((row) => row.id)
  if (categoryIds.length) {
    await sb.from("donation_subcategories").delete().eq("organization_id", orgId).in("category_id", categoryIds)
    await sb.from("donation_categories").delete().in("id", categoryIds)
  }

  console.log("Clean complete.")
}

async function ensurePerson(orgId, { firstName, lastName, email, phone }) {
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
      phone,
      person_type: "contact",
    })
    .select("id")
    .single()

  throwIfError("people insert", error)
  return data.id
}

async function ensureContact(orgId, input) {
  const { data: existing } = await sb
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("email", input.email)
    .maybeSingle()
  if (existing?.id) return existing.id

  const personId =
    input.contactType === "individual"
      ? await ensurePerson(orgId, input)
      : null

  const payload = {
    organization_id: orgId,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    contact_type: input.contactType,
    status: "active",
    notes: SEED_TAG,
    address: input.city,
  }
  if (personId) payload.person_id = personId
  if (input.primaryContactName) payload.primary_contact_name = input.primaryContactName

  const { data, error } = await sb.from("contacts").insert(payload).select("id").single()
  throwIfError("contacts insert", error)
  return data.id
}

async function ensureDonor(orgId, contactId, { fullName, email, phone, donorType }) {
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
      full_name: fullName,
      email,
      phone,
      donor_type: donorType,
      status: "active",
    })
    .select("id")
    .single()
  throwIfError("donors insert", error)
  return data.id
}

async function ensureNamedRow(table, orgId, name, insertPayload) {
  const { data: existing } = await sb
    .from(table)
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("name", name)
    .maybeSingle()
  if (existing?.id) return existing

  const { data, error } = await sb
    .from(table)
    .insert(insertPayload)
    .select("id, name")
    .single()
  throwIfError(`${table} insert`, error)
  return data
}

async function insertWishlistItems(orgId, campaignId, items) {
  const { data: existing } = await sb
    .from("campaign_wishlist_items")
    .select("name")
    .eq("organization_id", orgId)
    .eq("campaign_id", campaignId)
    .is("archived_at", null)
  const existingNames = new Set((existing || []).map((row) => String(row.name)))

  for (const item of items) {
    if (existingNames.has(item.name)) continue
    const { error } = await sb.from("campaign_wishlist_items").insert({
      organization_id: orgId,
      campaign_id: campaignId,
      public_token: publicToken(),
      public_visible: true,
      link_active: true,
      ...item,
    })
    throwIfError("wishlist", error)
  }
}

const ANNUAL_WISHLIST = [
  {
    name: "Neighborhood Mini-Grants",
    item_type: "community_services",
    description: "Small grants for park cleanups, after-school clubs, and local volunteer projects.",
    target_amount: 12000,
    priority: "high",
    project_status: "in_progress",
    sort_order: 1,
  },
  {
    name: "Family Resource Nights",
    item_type: "programming",
    description: "Quarterly dinners with childcare, financial coaching, and school-readiness kits.",
    target_amount: 4000,
    priority: "medium",
    project_status: "planned",
    sort_order: 2,
  },
]

const SCHOLAR_WISHLIST = [
  {
    name: "Summer Tutoring Stipends",
    item_type: "education",
    target_amount: 8000,
    priority: "high",
    project_status: "in_progress",
    sort_order: 1,
  },
  {
    name: "Laptop Library",
    item_type: "technology",
    target_amount: 5000,
    priority: "medium",
    project_status: "planned",
    sort_order: 2,
  },
]

async function seed(orgId) {
  console.log(`Seeding demo data for ${ORG_NAME} (${orgId})`)

  const unrestricted = await ensureNamedRow("donation_categories", orgId, "Unrestricted Giving", {
    organization_id: orgId,
    name: "Unrestricted Giving",
    description: SEED_TAG,
    tax_deductible: true,
  })
  const education = await ensureNamedRow("donation_categories", orgId, "Education & Scholarships", {
    organization_id: orgId,
    name: "Education & Scholarships",
    description: SEED_TAG,
    tax_deductible: true,
  })

  const impactFund = await ensureNamedRow("donation_subcategories", orgId, "Community Impact Fund", {
    organization_id: orgId,
    category_id: unrestricted.id,
    name: "Community Impact Fund",
    is_active: true,
  })
  const scholarshipFund = await ensureNamedRow(
    "donation_subcategories",
    orgId,
    "Youth Scholarships",
    {
      organization_id: orgId,
      category_id: education.id,
      name: "Youth Scholarships",
      is_active: true,
    }
  )

  for (const [name, fee] of [
    ["Check", "None"],
    ["Zelle", "None"],
    ["ACH", "None"],
    ["Card", "2.9%"],
  ]) {
    await ensureNamedRow("payment_methods", orgId, name, {
      organization_id: orgId,
      name,
      fee,
      enabled: true,
    })
  }

  const { data: existingAnnual } = await sb
    .from("campaigns")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", CAMPAIGN_ANNUAL_CODE)
    .maybeSingle()
  if (existingAnnual?.id) {
    throw new Error("Demo campaigns already exist. Run with --clean --execute to reset.")
  }

  const { data: annual, error: annualError } = await sb
    .from("campaigns")
    .insert({
      organization_id: orgId,
      name: "Annual Community Impact 2026",
      code: CAMPAIGN_ANNUAL_CODE,
      description:
        "Unrestricted support for neighborhood grants, family programs, and year-round community services.",
      goal_amount: 50000,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      status: "active",
      goal_breakdown_enabled: false,
    })
    .select("id")
    .single()
  throwIfError("annual campaign", annualError)

  const { data: scholar, error: scholarError } = await sb
    .from("campaigns")
    .insert({
      organization_id: orgId,
      name: "Youth Scholarship Drive",
      code: CAMPAIGN_SCHOLAR_CODE,
      description:
        "Need-based scholarships and tutoring stipends for local high school and first-generation college students.",
      goal_amount: 15000,
      start_date: "2026-06-01",
      end_date: "2026-09-30",
      status: "active",
      goal_breakdown_enabled: false,
    })
    .select("id")
    .single()
  throwIfError("scholarship campaign", scholarError)

  const askLevels = [
    { ask_amount: 1000, target_count: 8, sort_order: 1 },
    { ask_amount: 2500, target_count: 4, sort_order: 2 },
    { ask_amount: 5000, target_count: 2, sort_order: 3 },
  ]
  const askIds = {}
  for (const level of askLevels) {
    const { data, error } = await sb
      .from("campaign_ask_levels")
      .insert({
        organization_id: orgId,
        campaign_id: annual.id,
        ...level,
      })
      .select("id, ask_amount")
      .single()
    throwIfError("ask levels", error)
    askIds[level.ask_amount] = data.id
  }

  await insertWishlistItems(orgId, scholar.id, SCHOLAR_WISHLIST.map((item) => ({
    ...item,
    fund_id: scholarshipFund.id,
  })))
  await insertWishlistItems(orgId, annual.id, ANNUAL_WISHLIST.map((item) => ({
    ...item,
    fund_id: impactFund.id,
  })))

  const contactsByKey = {}
  for (const person of PEOPLE) {
    const email = emailFor(person.firstName, person.lastName)
    const fullName = `${person.firstName} ${person.lastName}`
    const contactId = await ensureContact(orgId, {
      firstName: person.firstName,
      lastName: person.lastName,
      fullName,
      email,
      phone: person.phone,
      city: person.city,
      contactType: "individual",
    })
    contactsByKey[person.lastName] = {
      ...person,
      email,
      fullName,
      contactId,
    }
  }

  const lakesideId = await ensureContact(orgId, {
    firstName: "Lakeside",
    lastName: "Fund",
    fullName: ORG_CONTACT.name,
    email: ORG_CONTACT.email,
    phone: ORG_CONTACT.phone,
    city: ORG_CONTACT.city,
    contactType: "organization",
    primaryContactName: "Patricia Nolan",
  })

  const donorContacts = {
    Whitaker: await ensureDonor(orgId, contactsByKey.Whitaker.contactId, {
      fullName: contactsByKey.Whitaker.fullName,
      email: contactsByKey.Whitaker.email,
      phone: contactsByKey.Whitaker.phone,
      donorType: "individual",
    }),
    Chen: await ensureDonor(orgId, contactsByKey.Chen.contactId, {
      fullName: contactsByKey.Chen.fullName,
      email: contactsByKey.Chen.email,
      phone: contactsByKey.Chen.phone,
      donorType: "individual",
    }),
    Sharma: await ensureDonor(orgId, contactsByKey.Sharma.contactId, {
      fullName: contactsByKey.Sharma.fullName,
      email: contactsByKey.Sharma.email,
      phone: contactsByKey.Sharma.phone,
      donorType: "individual",
    }),
    Alvarez: await ensureDonor(orgId, contactsByKey.Alvarez.contactId, {
      fullName: contactsByKey.Alvarez.fullName,
      email: contactsByKey.Alvarez.email,
      phone: contactsByKey.Alvarez.phone,
      donorType: "individual",
    }),
    Okonkwo: await ensureDonor(orgId, contactsByKey.Okonkwo.contactId, {
      fullName: contactsByKey.Okonkwo.fullName,
      email: contactsByKey.Okonkwo.email,
      phone: contactsByKey.Okonkwo.phone,
      donorType: "individual",
    }),
    Lakeside: await ensureDonor(orgId, lakesideId, {
      fullName: ORG_CONTACT.name,
      email: ORG_CONTACT.email,
      phone: ORG_CONTACT.phone,
      donorType: "organization",
    }),
  }

  async function insertPledge(row) {
    const { data, error } = await sb
      .from("pledges")
      .insert({
        organization_id: orgId,
        donor_id: row.donorId,
        campaign_id: row.campaignId,
        category_id: row.categoryId,
        subcategory_id: row.fundId,
        amount_pledged: row.amount,
        pledge_date: row.pledgeDate,
        pledge_type: "one_time",
        frequency: "one_time",
        status: "open",
        notes: `${SEED_TAG} ${row.label}`,
        ask_level_id: row.askLevelId || null,
      })
      .select("id")
      .single()
    throwIfError("pledges insert", error)
    return data.id
  }

  async function insertPayment(row) {
    const { error } = await sb.from("payments").insert({
      organization_id: orgId,
      donor_id: row.donorId,
      contact_id: row.contactId,
      pledge_id: row.pledgeId || null,
      campaign_id: row.campaignId,
      category_id: row.categoryId,
      subcategory_id: row.fundId,
      sender_name: row.senderName,
      amount: row.amount,
      payment_date: row.paymentDate,
      source: row.source,
      source_type: "manual",
      memo: `${SEED_TAG} ${row.label}`,
      status: row.pledgeId ? "allocated" : "allocated",
      is_verified: true,
    })
    throwIfError("payments insert", error)
  }

  const whitakerPledge = await insertPledge({
    donorId: donorContacts.Whitaker,
    campaignId: annual.id,
    categoryId: unrestricted.id,
    fundId: impactFund.id,
    amount: 10000,
    pledgeDate: "2026-02-12",
    label: "whitaker-annual",
    askLevelId: askIds[5000],
  })
  await insertPayment({
    donorId: donorContacts.Whitaker,
    contactId: contactsByKey.Whitaker.contactId,
    pledgeId: whitakerPledge,
    campaignId: annual.id,
    categoryId: unrestricted.id,
    fundId: impactFund.id,
    senderName: contactsByKey.Whitaker.fullName,
    amount: 2500,
    paymentDate: "2026-03-01T12:00:00",
    source: "check",
    label: "whitaker-1",
  })
  await insertPayment({
    donorId: donorContacts.Whitaker,
    contactId: contactsByKey.Whitaker.contactId,
    pledgeId: whitakerPledge,
    campaignId: annual.id,
    categoryId: unrestricted.id,
    fundId: impactFund.id,
    senderName: contactsByKey.Whitaker.fullName,
    amount: 1500,
    paymentDate: "2026-06-15T12:00:00",
    source: "check",
    label: "whitaker-2",
  })
  await insertPayment({
    donorId: donorContacts.Whitaker,
    contactId: contactsByKey.Whitaker.contactId,
    campaignId: scholar.id,
    categoryId: education.id,
    fundId: scholarshipFund.id,
    senderName: contactsByKey.Whitaker.fullName,
    amount: 500,
    paymentDate: "2026-07-08T12:00:00",
    source: "zelle",
    label: "whitaker-scholarship",
  })

  const sharmaPledge = await insertPledge({
    donorId: donorContacts.Sharma,
    campaignId: scholar.id,
    categoryId: education.id,
    fundId: scholarshipFund.id,
    amount: 2500,
    pledgeDate: "2026-06-20",
    label: "sharma-scholarship",
  })
  await insertPayment({
    donorId: donorContacts.Sharma,
    contactId: contactsByKey.Sharma.contactId,
    pledgeId: sharmaPledge,
    campaignId: scholar.id,
    categoryId: education.id,
    fundId: scholarshipFund.id,
    senderName: contactsByKey.Sharma.fullName,
    amount: 1000,
    paymentDate: "2026-07-01T12:00:00",
    source: "zelle",
    label: "sharma-1",
  })

  await insertPayment({
    donorId: donorContacts.Chen,
    contactId: contactsByKey.Chen.contactId,
    campaignId: annual.id,
    categoryId: unrestricted.id,
    fundId: impactFund.id,
    senderName: contactsByKey.Chen.fullName,
    amount: 1200,
    paymentDate: "2026-04-18T12:00:00",
    source: "check",
    label: "chen",
  })
  await insertPayment({
    donorId: donorContacts.Alvarez,
    contactId: contactsByKey.Alvarez.contactId,
    campaignId: annual.id,
    categoryId: unrestricted.id,
    fundId: impactFund.id,
    senderName: contactsByKey.Alvarez.fullName,
    amount: 350,
    paymentDate: "2026-05-09T12:00:00",
    source: "zelle",
    label: "alvarez",
  })
  await insertPayment({
    donorId: donorContacts.Okonkwo,
    contactId: contactsByKey.Okonkwo.contactId,
    campaignId: scholar.id,
    categoryId: education.id,
    fundId: scholarshipFund.id,
    senderName: contactsByKey.Okonkwo.fullName,
    amount: 750,
    paymentDate: "2026-07-22T12:00:00",
    source: "check",
    label: "okonkwo",
  })
  await insertPayment({
    donorId: donorContacts.Lakeside,
    contactId: lakesideId,
    campaignId: annual.id,
    categoryId: unrestricted.id,
    fundId: impactFund.id,
    senderName: ORG_CONTACT.name,
    amount: 5000,
    paymentDate: "2026-03-28T12:00:00",
    source: "check",
    label: "lakeside",
  })

  const prospects = [
    {
      contactId: contactsByKey.Brooks.contactId,
      campaignId: annual.id,
      ask_level_id: askIds[2500],
      suggested_ask_amount: 2500,
      stage: "identified",
      priority: "high",
      notes: `${SEED_TAG} Board introduction pending.`,
    },
    {
      contactId: contactsByKey.Kim.contactId,
      campaignId: annual.id,
      ask_level_id: askIds[1000],
      suggested_ask_amount: 1000,
      stage: "contacted",
      priority: "medium",
      notes: `${SEED_TAG} Interested in neighborhood grants.`,
    },
    {
      contactId: contactsByKey.Iyer.contactId,
      campaignId: scholar.id,
      suggested_ask_amount: 1500,
      stage: "identified",
      priority: "medium",
      notes: `${SEED_TAG} Alumni of the tutoring program.`,
    },
  ]

  for (const prospect of prospects) {
    const { error } = await sb.from("campaign_prospects").insert({
      organization_id: orgId,
      campaign_id: prospect.campaignId,
      contact_id: prospect.contactId,
      ask_level_id: prospect.ask_level_id || null,
      suggested_ask_amount: prospect.suggested_ask_amount,
      stage: prospect.stage,
      priority: prospect.priority,
      notes: prospect.notes,
    })
    throwIfError("prospects insert", error)
  }

  const affiliationIds = [
    contactsByKey.Whitaker.contactId,
    contactsByKey.Chen.contactId,
    contactsByKey.Sharma.contactId,
    contactsByKey.Alvarez.contactId,
    contactsByKey.Okonkwo.contactId,
    lakesideId,
  ]
  for (const contactId of affiliationIds) {
    const { error } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: contactId,
    })
    if (error) {
      console.warn(`sync_contact_affiliations ${contactId}: ${error.message}`)
    }
  }

  return {
    contacts: PEOPLE.length + 1,
    donors: 6,
    campaigns: 2,
    annualCampaignId: annual.id,
    scholarshipCampaignId: scholar.id,
  }
}

async function addMissingWishlists(orgId) {
  const { data: campaigns, error: campaignError } = await sb
    .from("campaigns")
    .select("id, code")
    .eq("organization_id", orgId)
    .in("code", [CAMPAIGN_ANNUAL_CODE, CAMPAIGN_SCHOLAR_CODE])
  throwIfError("load campaigns", campaignError)

  const annual = (campaigns || []).find((row) => row.code === CAMPAIGN_ANNUAL_CODE)
  const scholar = (campaigns || []).find((row) => row.code === CAMPAIGN_SCHOLAR_CODE)
  if (!annual || !scholar) {
    throw new Error("Demo campaigns were not found. Run the full seed first.")
  }

  const { data: funds, error: fundError } = await sb
    .from("donation_subcategories")
    .select("id, name")
    .eq("organization_id", orgId)
    .in("name", ["Community Impact Fund", "Youth Scholarships"])
  throwIfError("load funds", fundError)

  const impactFund = (funds || []).find((row) => row.name === "Community Impact Fund")
  const scholarshipFund = (funds || []).find((row) => row.name === "Youth Scholarships")

  await insertWishlistItems(
    orgId,
    scholar.id,
    SCHOLAR_WISHLIST.map((item) => ({
      ...item,
      fund_id: scholarshipFund?.id || null,
    }))
  )
  await insertWishlistItems(
    orgId,
    annual.id,
    ANNUAL_WISHLIST.map((item) => ({
      ...item,
      fund_id: impactFund?.id || null,
    }))
  )

  const { data: items } = await sb
    .from("campaign_wishlist_items")
    .select("name, campaign_id, target_amount")
    .eq("organization_id", orgId)
    .in("campaign_id", [annual.id, scholar.id])
    .is("archived_at", null)

  return items || []
}

try {
  const org = await resolveHorizonOrg()

  if (wishlistOnly) {
    const items = await addMissingWishlists(org.id)
    console.log(JSON.stringify({ ok: true, org: org.name, wishlist: items }, null, 2))
    process.exit(0)
  }

  const existing = await findSeedContacts(org.id)

  if (clean) {
    await cleanSeed(org.id)
    if (cleanOnly) {
      process.exit(0)
    }
  } else if (existing.length > 0) {
    console.error(
      "Demo contacts already exist. Run with --clean --execute to reset and re-seed."
    )
    process.exit(1)
  }

  const result = await seed(org.id)
  console.log(JSON.stringify({ ok: true, org: org.name, ...result }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
