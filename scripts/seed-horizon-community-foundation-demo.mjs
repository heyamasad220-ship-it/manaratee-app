/**
 * Demo seed for Horizon Community Foundation only
 * (directory, fund development, departments, programs/offerings, events).
 *
 * Usage:
 *   node scripts/seed-horizon-community-foundation-demo.mjs --execute
 *   node scripts/seed-horizon-community-foundation-demo.mjs --clean --execute
 *   node scripts/seed-horizon-community-foundation-demo.mjs --wishlist-only --execute
 *   node scripts/seed-horizon-community-foundation-demo.mjs --programs --execute
 *   node scripts/seed-horizon-community-foundation-demo.mjs --programs --clean --execute
 *
 * Safety: refuses any org that is not named Horizon Community Foundation.
 * Does not write to MAS Dallas or any other tenant.
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
    programsOnly: argv.includes("--programs") || argv.includes("--programs-only"),
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

const { execute, clean, cleanOnly, wishlistOnly, programsOnly } = parseArgs(
  process.argv.slice(2)
)

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

  await cleanProgramsSeed(orgId)

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
      status: row.pledgeId ? "allocated" : "unallocated",
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

function taggedDescription(text) {
  return `${text}\n\n${SEED_TAG}`
}

function unknownColumnFromError(message) {
  const match =
    message.match(/Could not find the '([^']+)' column/i) ||
    message.match(/column [^.\s]+\.(\w+) does not exist/i)
  return match?.[1] || null
}

async function insertIgnoringUnknownColumns(table, payload, label) {
  const current = { ...payload }
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await sb.from(table).insert(current).select("id").single()
    if (!error) return data
    const column = unknownColumnFromError(error.message || "")
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      delete current[column]
      continue
    }
    throwIfError(label, error)
  }
  throw new Error(`${label}: too many unknown columns`)
}

async function idsByTaggedDescription(table, orgId) {
  const { data, error } = await sb
    .from(table)
    .select("id")
    .eq("organization_id", orgId)
    .ilike("description", `%${SEED_TAG}%`)
  throwIfError(`find tagged ${table}`, error)
  return (data || []).map((row) => row.id)
}

async function deleteByIds(table, orgId, ids, label) {
  if (!ids.length) return
  const { error } = await sb.from(table).delete().eq("organization_id", orgId).in("id", ids)
  throwIfError(label, error)
}

async function cleanProgramsSeed(orgId) {
  console.log(`Cleaning ${SEED_TAG} departments, programs, and events from ${ORG_NAME}...`)

  const eventIds = await idsByTaggedDescription("internal_events", orgId)
  await deleteByIds("internal_events", orgId, eventIds, "delete seed events")

  const eventTypeIds = await idsByTaggedDescription("event_types", orgId)
  await deleteByIds("event_types", orgId, eventTypeIds, "delete seed event types")

  const programIds = await idsByTaggedDescription("programs", orgId)
  if (programIds.length) {
    const { data: offerings, error: offeringError } = await sb
      .from("program_offerings")
      .select("id")
      .eq("organization_id", orgId)
      .in("program_id", programIds)
    throwIfError("find seed offerings", offeringError)
    const offeringIds = (offerings || []).map((row) => row.id)

    if (offeringIds.length) {
      await sb
        .from("program_registration_options")
        .delete()
        .eq("organization_id", orgId)
        .in("offering_id", offeringIds)
      await sb
        .from("program_offerings")
        .delete()
        .eq("organization_id", orgId)
        .in("id", offeringIds)
    }

    await sb.from("programs").delete().eq("organization_id", orgId).in("id", programIds)
  }

  const departmentIds = await idsByTaggedDescription("departments", orgId)
  await deleteByIds("departments", orgId, departmentIds, "delete seed departments")
}

async function ensureDepartment(orgId, { name, description, color }) {
  const { data: existing } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("name", name)
    .maybeSingle()
  if (existing?.id) return existing

  return insertIgnoringUnknownColumns(
    "departments",
    {
      organization_id: orgId,
      name,
      description: taggedDescription(description),
      color,
    },
    `department ${name}`
  )
}

async function ensureProgram(orgId, payload) {
  const { data: existing } = await sb
    .from("programs")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("name", payload.name)
    .maybeSingle()
  if (existing?.id) return existing

  return insertIgnoringUnknownColumns("programs", payload, `program ${payload.name}`)
}

async function ensureOffering(orgId, programId, payload) {
  const { data: existing } = await sb
    .from("program_offerings")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("program_id", programId)
    .eq("name", payload.name)
    .maybeSingle()
  if (existing?.id) return existing

  return insertIgnoringUnknownColumns(
    "program_offerings",
    payload,
    `offering ${payload.name}`
  )
}

async function ensureRegistrationOption(orgId, programId, offeringId) {
  const { data: existing } = await sb
    .from("program_registration_options")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("option_type", "full_program")
    .maybeSingle()
  if (existing?.id) return existing

  const { error } = await sb.from("program_registration_options").insert({
    organization_id: orgId,
    program_id: programId,
    offering_id: offeringId,
    name: "Full Program",
    option_type: "full_program",
    is_active: true,
    priority_rank: 10,
  })
  if (error && !/duplicate|unique/i.test(error.message || "")) {
    throwIfError("registration option", error)
  }
}

async function ensureEventType(orgId, { name, slug, description }) {
  const { data: existing } = await sb
    .from("event_types")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .maybeSingle()
  if (existing?.id) return existing

  return insertIgnoringUnknownColumns(
    "event_types",
    {
      organization_id: orgId,
      name,
      slug,
      description: taggedDescription(description),
      is_active: true,
      sort_order: 10,
    },
    `event type ${name}`
  )
}

async function ensureEvent(orgId, payload) {
  const { data: existing } = await sb
    .from("internal_events")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("name", payload.name)
    .maybeSingle()
  if (existing?.id) return existing

  return insertIgnoringUnknownColumns("internal_events", payload, `event ${payload.name}`)
}

function offeringAttributes({ applicationRequired }) {
  return {
    audience_type: "youth",
    min_age: 6,
    max_age: 14,
    gender: "All",
    require_guardian: true,
    require_grade: false,
    require_emergency_contact: true,
    capacity_mode: "unlimited",
    capacity: null,
    enable_waitlist: false,
    registration_mode: "required",
    application_required: applicationRequired,
    attendance_tracked: false,
    care_enabled: false,
    delivery_format: "in_person",
    inherit_dates: false,
    inherit_eligibility: true,
    inherit_enrollment: true,
  }
}

async function seedPrograms(orgId) {
  console.log(`Seeding departments, programs, and events for ${ORG_NAME} (${orgId})`)

  const youth = await ensureDepartment(orgId, {
    name: "Youth Programs",
    description:
      "After-school tutoring, STEM labs, and seasonal camps for children and teens.",
    color: "#2563eb",
  })
  const community = await ensureDepartment(orgId, {
    name: "Community Engagement",
    description: "Volunteer days, family nights, and neighborhood gatherings.",
    color: "#059669",
  })

  const scholars = await ensureProgram(orgId, {
    organization_id: orgId,
    department_id: youth.id,
    name: "Horizon Scholars 2026–27",
    subtitle: "Year-round academic enrichment",
    description: taggedDescription(
      "Tutoring and STEM labs for elementary and middle school students."
    ),
    program_kind: "academic",
    program_type: "youth",
    status: "active",
    visibility: "public",
    start_date: "2026-08-17",
    end_date: "2027-05-28",
    gender: "All",
    min_age: 6,
    max_age: 14,
    require_guardian: true,
    require_emergency_contact: true,
    full_program_registration_enabled: true,
    session_registration_enabled: false,
    capacity: 0,
    enrolled: 0,
    waitlist: 0,
  })

  const fallOffering = await ensureOffering(orgId, scholars.id, {
    organization_id: orgId,
    program_id: scholars.id,
    name: "Fall Tutoring Circle",
    is_default: true,
    offering_type: "academic_year",
    start_date: "2026-09-08",
    end_date: "2026-12-18",
    status: "active",
    sort_order: 10,
    ...offeringAttributes({ applicationRequired: true }),
  })
  const springOffering = await ensureOffering(orgId, scholars.id, {
    organization_id: orgId,
    program_id: scholars.id,
    name: "Spring STEM Lab",
    is_default: false,
    offering_type: "academic_year",
    start_date: "2027-01-12",
    end_date: "2027-05-21",
    status: "active",
    sort_order: 20,
    ...offeringAttributes({ applicationRequired: true }),
  })

  const summer = await ensureProgram(orgId, {
    organization_id: orgId,
    department_id: youth.id,
    name: "Summer Adventure Camp",
    subtitle: "Outdoor weeks for ages 6–14",
    description: taggedDescription(
      "A day camp with hiking, crafts, and neighborhood field trips."
    ),
    program_kind: "seasonal",
    program_type: "youth",
    status: "active",
    visibility: "public",
    start_date: "2027-06-08",
    end_date: "2027-07-31",
    gender: "All",
    min_age: 6,
    max_age: 14,
    require_guardian: true,
    require_emergency_contact: true,
    full_program_registration_enabled: true,
    session_registration_enabled: true,
    capacity: 0,
    enrolled: 0,
    waitlist: 0,
  })
  const summerOffering = await ensureOffering(orgId, summer.id, {
    organization_id: orgId,
    program_id: summer.id,
    name: "Summer Adventure Camp",
    is_default: true,
    offering_type: "summer",
    start_date: "2027-06-08",
    end_date: "2027-07-31",
    status: "active",
    sort_order: 10,
    ...offeringAttributes({ applicationRequired: false }),
  })

  const winter = await ensureProgram(orgId, {
    organization_id: orgId,
    department_id: youth.id,
    name: "Winter Break Camp",
    subtitle: "Holiday week for ages 6–12",
    description: taggedDescription(
      "Indoor games, cooking, and community service during winter break."
    ),
    program_kind: "seasonal",
    program_type: "youth",
    status: "active",
    visibility: "public",
    start_date: "2026-12-21",
    end_date: "2027-01-02",
    gender: "All",
    min_age: 6,
    max_age: 12,
    require_guardian: true,
    require_emergency_contact: true,
    full_program_registration_enabled: true,
    session_registration_enabled: false,
    capacity: 0,
    enrolled: 0,
    waitlist: 0,
  })
  const winterOffering = await ensureOffering(orgId, winter.id, {
    organization_id: orgId,
    program_id: winter.id,
    name: "Winter Break Camp",
    is_default: true,
    offering_type: "season",
    start_date: "2026-12-21",
    end_date: "2027-01-02",
    status: "active",
    sort_order: 10,
    ...offeringAttributes({ applicationRequired: false }),
  })

  for (const row of [
    [scholars.id, fallOffering.id],
    [scholars.id, springOffering.id],
    [summer.id, summerOffering.id],
    [winter.id, winterOffering.id],
  ]) {
    await ensureRegistrationOption(orgId, row[0], row[1])
  }

  const eventType = await ensureEventType(orgId, {
    name: "Community Gathering",
    slug: "community-gathering",
    description: "Public-facing community events for Horizon demo data.",
  })

  const volunteerDay = await ensureEvent(orgId, {
    organization_id: orgId,
    department_id: community.id,
    event_type_id: eventType.id,
    name: "Horizon Volunteer Day",
    description: taggedDescription(
      "Neighbors help with park cleanup, donation sorting, and welcome tables."
    ),
    status: "scheduled",
    start_at: "2026-09-12T14:00:00.000Z",
    end_at: "2026-09-12T18:00:00.000Z",
    timezone: "America/Chicago",
    location_type: "external",
    location_label: "Riverside Park Pavilion",
    location_address: "1400 Lakeshore Blvd, Austin, TX 78701",
    requires_volunteers: true,
  })
  const familyNight = await ensureEvent(orgId, {
    organization_id: orgId,
    department_id: youth.id,
    event_type_id: eventType.id,
    name: "Family Welcome Night",
    description: taggedDescription(
      "Meet Youth Programs staff and preview fall tutoring and STEM lab offerings."
    ),
    status: "scheduled",
    start_at: "2026-10-02T23:00:00.000Z",
    end_at: "2026-10-03T01:00:00.000Z",
    timezone: "America/Chicago",
    location_type: "online",
    location_label: "Online",
    requires_childcare: false,
  })

  return {
    departments: [youth.name, community.name],
    programs: [scholars.name, summer.name, winter.name],
    offerings: [
      fallOffering.name,
      springOffering.name,
      summerOffering.name,
      winterOffering.name,
    ],
    events: [volunteerDay.name, familyNight.name],
  }
}

try {
  const org = await resolveHorizonOrg()

  if (wishlistOnly) {
    const items = await addMissingWishlists(org.id)
    console.log(JSON.stringify({ ok: true, org: org.name, wishlist: items }, null, 2))
    process.exit(0)
  }

  if (programsOnly) {
    if (clean) {
      await cleanProgramsSeed(org.id)
      if (cleanOnly) {
        process.exit(0)
      }
    }
    const programs = await seedPrograms(org.id)
    console.log(JSON.stringify({ ok: true, org: org.name, ...programs }, null, 2))
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
      "Demo contacts already exist. Run with --clean --execute to reset and re-seed, or --programs --execute to add departments/programs/events only."
    )
    process.exit(1)
  }

  const result = await seed(org.id)
  const programs = await seedPrograms(org.id)
  console.log(JSON.stringify({ ok: true, org: org.name, ...result, ...programs }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
