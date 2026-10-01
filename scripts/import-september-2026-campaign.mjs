/**
 * Clean import of September2026Campaign.xlsx onto MAS (Development)
 * Annual Fundraiser - September 2026.
 *
 * Pledges sheet:
 *   Pledge column is the commitment.
 *   Cash, Checks, and One-Time Payment are money already received.
 *   Installments means a payment plan. Nothing has been received yet,
 *   even when Balance is 0. Monthly amount is left blank.
 *
 * Donations sheet:
 *   Cash, Checks, and One-Time Payment are gifts with no pledge.
 *   Installments is the total of a recurring commitment, not money received.
 *   Those become open pledges so the balance shows. Monthly amount is blank.
 *   Ahmad Gharbieh's $250 Zelle on this sheet is the same gift as his pledge
 *   payment and is skipped.
 *
 *   node scripts/import-september-2026-campaign.mjs
 *   node scripts/import-september-2026-campaign.mjs --execute
 */
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CAMPAIGN_ID = "74fc4ba9-a7f1-4aec-af12-a62909e32afc"
const DEFAULT_FILE = "C:/Users/danan/Downloads/September2026Campaign.xlsx"
const IMPORT_TAG = "SEP2026_CAMPAIGN_V1"
const GENERAL_CATEGORY_NAME = "General Donation"
const PLEDGE_DATE = "2026-09-12"
const PAYMENT_BATCH_SIZE = 50

const GROUP_ALIASES = {
  "education dept": "Education Department",
  "quran institute": "Quran Institute for Ladies",
  "usrat al islah cyp sisters": "CYP Usrat Al-Islah",
}
const NOT_CAMPAIGN_GROUPS = new Set(["organization", "sponsor"])

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
  const args = {
    file: DEFAULT_FILE,
    orgId: DEFAULT_ORG_ID,
    campaignId: DEFAULT_CAMPAIGN_ID,
    execute: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--execute") args.execute = true
    else if (arg === "--file") args.file = argv[++index]
    else if (arg === "--org") args.orgId = argv[++index]
    else if (arg === "--campaign") args.campaignId = argv[++index]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeNameForMatch(value) {
  const withoutParens = normalizeText(value).replace(/\([^)]*\)/g, " ")
  return normalizeName(withoutParens).replace(/^(dr|mr|mrs|ms|sheikh)\s+/, "")
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase()
  return text.includes("@") ? text : ""
}

function normalizePhone(value) {
  const digits = normalizeText(value).replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits
}

function money(value) {
  if (value == null || value === "") return 0
  if (typeof value === "number") return Math.round(value * 100) / 100
  const parsed = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function campaignGroupName(sheetGroup) {
  const key = normalizeName(sheetGroup)
  if (!key || NOT_CAMPAIGN_GROUPS.has(key)) return null
  return GROUP_ALIASES[key] || normalizeText(sheetGroup)
}

function isOrganizationName(row) {
  const groupKey = normalizeName(row.sheetGroup)
  if (groupKey === "organization" || groupKey === "sponsor") return true
  return /\b(llc|inc\.?|foundation|pharmacy|labs|market|mortgage|memorial|scouts|forum)\b/i.test(
    row.name
  )
}

function rowHash(row) {
  return createHash("sha256")
    .update(
      [
        row.sheet,
        row.excelRow,
        row.name,
        row.sheetGroup,
        row.pledge.toFixed(2),
        row.install.toFixed(2),
        row.oneTime.toFixed(2),
        row.cash.toFixed(2),
        row.checks.toFixed(2),
      ].join("|")
    )
    .digest("hex")
    .slice(0, 12)
}

function isGharbiehDuplicate(row) {
  return (
    row.sheet === "Donations" &&
    normalizeNameForMatch(row.name) === "ahmad gharbieh" &&
    Math.abs(row.oneTime - 250) < 0.01 &&
    normalizeName(row.sheetGroup) === "usrat as sabiqoon cyp"
  )
}

function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Workbook has no ${sheetName} sheet`)
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  const rows = []
  for (let index = 1; index < grid.length; index += 1) {
    const cells = grid[index]
    if (!cells || !normalizeText(cells[0])) continue
    const row = {
      sheet: sheetName,
      excelRow: index + 1,
      name: normalizeText(cells[0]),
      phone: normalizePhone(cells[2]).length >= 7 ? normalizePhone(cells[2]) : null,
      email: normalizeEmail(cells[3]) || null,
      sheetGroup: normalizeText(cells[4]),
      source: normalizeText(cells[5]),
      cash: money(cells[6]),
      checks: money(cells[7]),
      oneTime: money(cells[8]),
      install: money(cells[9]),
      pledge: money(cells[10]),
      balance: money(cells[11]),
    }
    row.nameKey = normalizeNameForMatch(row.name)
    row.groupName = campaignGroupName(row.sheetGroup)
    row.hash = rowHash(row)
    row.received = Math.round((row.cash + row.checks + row.oneTime) * 100) / 100
    rows.push(row)
  }
  return rows
}

function buildContactIndexes(contacts) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() === "group") continue
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = normalizeNameForMatch(contact.full_name)
    if (email && !byEmail.has(email)) byEmail.set(email, contact)
    if (phone.length >= 7 && !byPhone.has(phone)) byPhone.set(phone, contact)
    if (nameKey) {
      const list = byName.get(nameKey) || []
      if (!list.some((item) => item.id === contact.id)) list.push(contact)
      byName.set(nameKey, list)
    }
  }
  return { byEmail, byPhone, byName }
}

function rememberContact(contact, indexes) {
  const email = normalizeEmail(contact.email)
  const phone = normalizePhone(contact.phone)
  const nameKey = normalizeNameForMatch(contact.full_name)
  if (email) indexes.byEmail.set(email, contact)
  if (phone.length >= 7) indexes.byPhone.set(phone, contact)
  if (nameKey) indexes.byName.set(nameKey, [contact])
}

function findContactMatch(row, indexes) {
  if (row.email && indexes.byEmail.has(row.email)) {
    return { contact: indexes.byEmail.get(row.email), reason: "email" }
  }
  if (row.phone && indexes.byPhone.has(row.phone)) {
    return { contact: indexes.byPhone.get(row.phone), reason: "phone" }
  }
  const matches = indexes.byName.get(row.nameKey) || []
  if (matches.length === 1) return { contact: matches[0], reason: "exact_name" }
  if (matches.length > 1) {
    const exact = matches.filter(
      (contact) => normalizeName(contact.full_name) === normalizeName(row.name)
    )
    const pool = exact.length > 0 ? exact : matches
    if (pool.length === 1) return { contact: pool[0], reason: "exact_full_name" }
    const chosen = [...pool].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))[0]
    return {
      contact: chosen,
      reason: "oldest_same_name",
      candidates: pool.map((item) => item.full_name),
    }
  }
  return null
}

function pledgeNote(row, kind) {
  const detail =
    kind === "installment"
      ? "Installment plan. Monthly amount not entered yet. No payment received."
      : kind === "recurring"
        ? "Recurring donation commitment. Monthly amount not entered yet. No payment received."
        : null
  return [IMPORT_TAG, row.hash, detail, row.groupName ? `Group: ${row.groupName}` : null, row.source ? `Source: ${row.source}` : null]
    .filter(Boolean)
    .join(" | ")
}

function paymentMemo(row, method) {
  return [IMPORT_TAG, row.hash, method, row.source || null, row.groupName || null].filter(Boolean).join("|")
}

function createPublicToken() {
  return randomUUID().replace(/-/g, "")
}

loadEnv()
const args = parseArgs(process.argv.slice(2))
if (!existsSync(args.file)) {
  console.error(`File not found: ${args.file}`)
  process.exit(1)
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, filters = []) {
  const rows = []
  let from = 0
  while (true) {
    let query = sb.from(table).select("*").range(from, from + 999)
    for (const filter of filters) query = query.eq(filter.col, filter.val)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function main() {
  const workbook = XLSX.readFile(args.file, { cellDates: false })
  const pledgeRows = readSheet(workbook, "Pledges")
  const donationRows = readSheet(workbook, "Donations")

  const report = {
    execute: args.execute,
    file: args.file,
    campaignId: args.campaignId,
    campaignName: null,
    pledgesCreated: 0,
    pledgeAmount: 0,
    installmentPledges: 0,
    installmentPledgeAmount: 0,
    recurringCommitments: 0,
    recurringCommitmentAmount: 0,
    paymentsCreated: 0,
    paymentAmount: 0,
    skippedDuplicate: [],
    sameNameChoices: [],
    contactsMatched: 0,
    contactsCreated: 0,
    donorsCreated: 0,
    campaignGroupsCreated: 0,
    affiliationsSynced: 0,
    errors: [],
    samples: [],
  }

  const { data: campaign, error: campaignError } = await sb
    .from("campaigns")
    .select("id, name, organization_id")
    .eq("id", args.campaignId)
    .eq("organization_id", args.orgId)
    .maybeSingle()
  if (campaignError) throw new Error(campaignError.message)
  if (!campaign) throw new Error("Campaign not found for this organization")
  report.campaignName = campaign.name

  const [contacts, donors, categories, subcategories, existingGroups, existingPledges, existingPayments] =
    await Promise.all([
      fetchAll("contacts", [{ col: "organization_id", val: args.orgId }]),
      fetchAll("donors", [{ col: "organization_id", val: args.orgId }]),
      fetchAll("donation_categories", [{ col: "organization_id", val: args.orgId }]),
      fetchAll("donation_subcategories", [{ col: "organization_id", val: args.orgId }]),
      fetchAll("campaign_groups", [
        { col: "organization_id", val: args.orgId },
        { col: "campaign_id", val: args.campaignId },
      ]),
      fetchAll("pledges", [
        { col: "organization_id", val: args.orgId },
        { col: "campaign_id", val: args.campaignId },
      ]),
      fetchAll("payments", [
        { col: "organization_id", val: args.orgId },
        { col: "campaign_id", val: args.campaignId },
      ]),
    ])

  if ((existingPledges.length > 0 || existingPayments.length > 0) && args.execute) {
    throw new Error(
      `Campaign already has ${existingPledges.length} pledges and ${existingPayments.length} payments. Clear it before a fresh import.`
    )
  }

  const contactIndexes = buildContactIndexes(contacts)
  const groupContactsByName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() !== "group") continue
    groupContactsByName.set(normalizeName(contact.full_name), contact)
  }
  const campaignGroupByName = new Map(
    existingGroups.map((group) => [normalizeName(group.name), group])
  )
  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )
  const importedHashes = new Set()
  for (const pledge of existingPledges) {
    const match = String(pledge.notes || "").match(new RegExp(`${IMPORT_TAG} \\| ([a-f0-9]{12})`))
    if (match) importedHashes.add(match[1])
  }
  for (const payment of existingPayments) {
    const match = String(payment.memo || "").match(new RegExp(`${IMPORT_TAG}\\|([a-f0-9]{12})`))
    if (match) importedHashes.add(`pay:${match[1]}`)
  }

  const categoryByName = new Map(categories.map((category) => [normalizeName(category.name), category]))
  const fundByName = new Map(subcategories.map((fund) => [normalizeName(fund.name), fund]))

  async function ensureCategory(name) {
    const key = normalizeName(name)
    if (categoryByName.has(key)) return categoryByName.get(key)
    if (!args.execute) {
      const placeholder = { id: `dry-run:category:${key}`, name }
      categoryByName.set(key, placeholder)
      return placeholder
    }
    const { data, error } = await sb
      .from("donation_categories")
      .insert({
        organization_id: args.orgId,
        name,
        tax_deductible: true,
        is_active: true,
        show_on_website: true,
        show_on_kiosk: true,
      })
      .select("id, name")
      .single()
    if (error) throw new Error(`category (${name}): ${error.message}`)
    categoryByName.set(key, data)
    return data
  }

  async function ensureFund(name, categoryId) {
    const key = normalizeName(name)
    if (fundByName.has(key)) return fundByName.get(key)
    if (!args.execute) {
      const placeholder = { id: `dry-run:fund:${key}`, name }
      fundByName.set(key, placeholder)
      return placeholder
    }
    const { data, error } = await sb
      .from("donation_subcategories")
      .insert({
        organization_id: args.orgId,
        category_id: categoryId,
        name,
        is_active: true,
      })
      .select("id, name")
      .single()
    if (error) throw new Error(`fund (${name}): ${error.message}`)
    fundByName.set(key, data)
    return data
  }

  async function ensureCampaignGroup(groupName) {
    const key = normalizeName(groupName)
    if (campaignGroupByName.has(key)) return campaignGroupByName.get(key)
    const groupContact = groupContactsByName.get(key)
    if (!groupContact) throw new Error(`Giving group contact not found: ${groupName}`)
    const payload = {
      organization_id: args.orgId,
      campaign_id: args.campaignId,
      name: groupContact.full_name,
      organizational_group_id: groupContact.id,
      lead_contact_id: null,
      goal_amount: null,
      description: `September 2026 campaign group`,
      public_token: createPublicToken(),
      status: "active",
      public_progress_enabled: true,
      link_active: true,
    }
    if (!args.execute) {
      report.campaignGroupsCreated += 1
      const placeholder = { id: `dry-run:campaign-group:${key}`, ...payload }
      campaignGroupByName.set(key, placeholder)
      return placeholder
    }
    const { data, error } = await sb
      .from("campaign_groups")
      .insert(payload)
      .select("id, name, organizational_group_id")
      .single()
    if (error) throw new Error(`campaign group (${groupName}): ${error.message}`)
    campaignGroupByName.set(key, data)
    report.campaignGroupsCreated += 1
    return data
  }

  const pendingContacts = new Map()

  async function ensureContact(row) {
    const pendingKey = [row.nameKey, row.email || "", row.phone || ""].join("|")
    if (pendingContacts.has(pendingKey)) return pendingContacts.get(pendingKey)
    const match = findContactMatch(row, contactIndexes)
    if (match?.reason === "oldest_same_name") {
      report.sameNameChoices.push({
        name: row.name,
        sheet: row.sheet,
        excelRow: row.excelRow,
        used: match.contact.full_name,
        email: match.contact.email || null,
      })
    }
    if (match?.contact) {
      report.contactsMatched += 1
      pendingContacts.set(pendingKey, match.contact)
      return match.contact
    }
    const contactType = isOrganizationName(row) ? "organization" : "individual"
    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = {
        id: `dry-run:contact:${pendingKey}`,
        full_name: row.name,
        email: row.email,
        phone: row.phone,
        contact_type: contactType,
      }
      rememberContact(placeholder, contactIndexes)
      pendingContacts.set(pendingKey, placeholder)
      return placeholder
    }
    const { data: contactId, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
      p_organization_id: args.orgId,
      p_full_name: row.name,
      p_email: row.email,
      p_phone: row.phone,
      p_contact_type: contactType,
    })
    if (rpcError || !contactId) throw new Error(rpcError?.message || `contact ${row.name}`)
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, contact_type")
      .eq("id", contactId)
      .single()
    if (error) throw new Error(error.message)
    rememberContact(data, contactIndexes)
    pendingContacts.set(pendingKey, data)
    report.contactsCreated += 1
    return data
  }

  async function ensureDonor(contact) {
    if (donorByContactId.has(contact.id)) return donorByContactId.get(contact.id)
    const donorType = contact.contact_type === "individual" ? "individual" : "organization"
    if (!args.execute) {
      report.donorsCreated += 1
      const placeholder = { id: `dry-run:donor:${contact.id}`, contact_id: contact.id, full_name: contact.full_name }
      donorByContactId.set(contact.id, placeholder)
      return placeholder
    }
    const { data, error } = await sb
      .from("donors")
      .insert({
        organization_id: args.orgId,
        contact_id: contact.id,
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
        donor_type: donorType,
        status: "active",
      })
      .select("id, contact_id, full_name")
      .single()
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await sb
          .from("donors")
          .select("id, contact_id, full_name")
          .eq("organization_id", args.orgId)
          .eq("contact_id", contact.id)
          .maybeSingle()
        if (existing) {
          donorByContactId.set(contact.id, existing)
          return existing
        }
      }
      throw new Error(`donor (${contact.full_name}): ${error.message}`)
    }
    donorByContactId.set(contact.id, data)
    report.donorsCreated += 1
    return data
  }

  const category = await ensureCategory(GENERAL_CATEGORY_NAME)
  const fund = await ensureFund(campaign.name, category.id)
  const paymentPayloads = []
  const affectedContactIds = new Set()
  const pledgeIdsToRefresh = []

  async function createPledge(row, amount, kind) {
    if (importedHashes.has(row.hash)) return `already:${row.hash}`
    const contact = await ensureContact(row)
    if (!contact) return null
    const donor = await ensureDonor(contact)
    const campaignGroup = row.groupName ? await ensureCampaignGroup(row.groupName) : null
    const campaignGroupId =
      campaignGroup && !String(campaignGroup.id).startsWith("dry-run:") ? campaignGroup.id : null
    if (!args.execute) {
      report.pledgesCreated += 1
      report.pledgeAmount += amount
      return `dry-run:pledge:${row.hash}`
    }
    const { data, error } = await sb
      .from("pledges")
      .insert({
        organization_id: args.orgId,
        donor_id: donor.id,
        campaign_id: args.campaignId,
        amount_pledged: amount,
        pledge_date: PLEDGE_DATE,
        pledge_type: "one_time",
        frequency: "one_time",
        status: "open",
        notes: pledgeNote(row, kind),
        category_id: category.id,
        subcategory_id: fund.id,
        campaign_group_id: campaignGroupId,
      })
      .select("id")
      .single()
    if (error) throw new Error(`pledge (${row.name}): ${error.message}`)
    report.pledgesCreated += 1
    report.pledgeAmount += amount
    importedHashes.add(row.hash)
    return data.id
  }

  function queuePayment(row, method, amount, pledgeId, contact, donor, campaignGroup) {
    if (amount < 0.01) return
    if (importedHashes.has(`pay:${row.hash}:${method}`)) return
    const campaignGroupId =
      campaignGroup && !String(campaignGroup.id).startsWith("dry-run:") ? campaignGroup.id : null
    const linkedPledgeId = pledgeId && !String(pledgeId).startsWith("dry-run:") && !String(pledgeId).startsWith("already:")
      ? pledgeId
      : null
    paymentPayloads.push({
      organization_id: args.orgId,
      donor_id: String(donor.id).startsWith("dry-run:") ? null : donor.id,
      contact_id: String(contact.id).startsWith("dry-run:") ? null : contact.id,
      amount,
      payment_date: `${PLEDGE_DATE}T12:00:00.000Z`,
      source: "import",
      source_type: "import",
      status: "unallocated",
      sender_name: row.name,
      category_id: category.id,
      subcategory_id: fund.id,
      campaign_id: args.campaignId,
      campaign_group_id: campaignGroupId,
      attributed_group_contact_id:
        campaignGroup && !String(campaignGroup.organizational_group_id || "").startsWith("dry-run:")
          ? campaignGroup.organizational_group_id
          : null,
      pledge_id: linkedPledgeId,
      memo: paymentMemo(row, method),
      is_verified: true,
    })
    report.paymentAmount += amount
    if (linkedPledgeId) pledgeIdsToRefresh.push(linkedPledgeId)
    if (contact.id && !String(contact.id).startsWith("dry-run:")) affectedContactIds.add(contact.id)
  }

  for (const row of pledgeRows) {
    try {
      const kind = row.install >= 0.01 ? "installment" : "pledge"
      const pledgeId = await createPledge(row, row.pledge, kind)
      if (!pledgeId) continue
      if (kind === "installment") {
        report.installmentPledges += 1
        report.installmentPledgeAmount += row.pledge
      }
      const contact = pendingContacts.get([row.nameKey, row.email || "", row.phone || ""].join("|"))
      const donor = contact ? donorByContactId.get(contact.id) : null
      const campaignGroup = row.groupName ? campaignGroupByName.get(normalizeName(row.groupName)) : null
      if (contact && donor) {
        queuePayment(row, "cash", row.cash, pledgeId, contact, donor, campaignGroup)
        queuePayment(row, "check", row.checks, pledgeId, contact, donor, campaignGroup)
        queuePayment(row, "one_time", row.oneTime, pledgeId, contact, donor, campaignGroup)
      }
      if (report.samples.length < 8) {
        report.samples.push({
          sheet: row.sheet,
          name: row.name,
          pledge: row.pledge,
          received: row.received,
          install: row.install,
          group: row.groupName,
        })
      }
    } catch (error) {
      report.errors.push({ sheet: row.sheet, name: row.name, excelRow: row.excelRow, error: error.message })
    }
  }

  for (const row of donationRows) {
    try {
      if (isGharbiehDuplicate(row)) {
        report.skippedDuplicate.push({ name: row.name, amount: row.oneTime, group: row.sheetGroup, excelRow: row.excelRow })
        continue
      }
      if (row.install >= 0.01) {
        const pledgeId = await createPledge(row, row.install, "recurring")
        if (!pledgeId) continue
        report.recurringCommitments += 1
        report.recurringCommitmentAmount += row.install
        continue
      }
      const contact = await ensureContact(row)
      if (!contact) continue
      const donor = await ensureDonor(contact)
      const campaignGroup = row.groupName ? await ensureCampaignGroup(row.groupName) : null
      queuePayment(row, "cash", row.cash, null, contact, donor, campaignGroup)
      queuePayment(row, "check", row.checks, null, contact, donor, campaignGroup)
      queuePayment(row, "one_time", row.oneTime, null, contact, donor, campaignGroup)
    } catch (error) {
      report.errors.push({ sheet: row.sheet, name: row.name, excelRow: row.excelRow, error: error.message })
    }
  }

  if (args.execute) {
    for (let index = 0; index < paymentPayloads.length; index += PAYMENT_BATCH_SIZE) {
      const batch = paymentPayloads.slice(index, index + PAYMENT_BATCH_SIZE)
      const { error } = await sb.from("payments").insert(batch)
      if (error) report.errors.push({ batch: `${index + 1}-${index + batch.length}`, error: error.message })
      else report.paymentsCreated += batch.length
    }
    for (const pledgeId of pledgeIdsToRefresh) {
      const { error } = await sb.rpc("refresh_pledge_status", { p_pledge_id: pledgeId })
      if (error) report.errors.push({ pledgeId, error: error.message })
    }
    for (const contactId of affectedContactIds) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: contactId,
      })
      if (error) report.errors.push({ contactId, error: error.message })
      else report.affiliationsSynced += 1
    }
  } else {
    report.paymentsCreated = paymentPayloads.length
  }

  report.pledgeAmount = Math.round(report.pledgeAmount * 100) / 100
  report.installmentPledgeAmount = Math.round(report.installmentPledgeAmount * 100) / 100
  report.recurringCommitmentAmount = Math.round(report.recurringCommitmentAmount * 100) / 100
  report.paymentAmount = Math.round(report.paymentAmount * 100) / 100

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(
    reportsDir,
    args.execute ? "september-2026-campaign-execute.json" : "september-2026-campaign-dry-run.json"
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    ...report,
    sameNameChoices: report.sameNameChoices,
    errors: report.errors.slice(0, 20),
  }, null, 2))
  console.log(`\nReport written to ${reportPath}`)
  if (!args.execute) console.log("\nDry run only. Re-run with --execute to import.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
