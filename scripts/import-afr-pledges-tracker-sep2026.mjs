/**
 * Import AFR Pledges Tracker (Sept 12, 2026) Master sheet onto
 * Annual Fundraiser - September 2026.
 *
 * - Full pledge amounts, including group totals and member pledges
 * - Cash and check amounts become payments (linked to the row's pledge)
 * - Card amounts on a pledge row are not recorded (Square gifts may already exist)
 * - Card / cash / check gifts with no pledge amount are imported as payments
 * - Card gifts that match an existing campaign payment (name + amount) are skipped
 * - Islamic Relief USA, Islamic Services Foundation, and Mercy without Limits
 *   pledges already on the campaign are not created again
 * - Baitulmaal's existing pledge gets the $20,000 check (status follows the payment)
 *
 *   node scripts/import-afr-pledges-tracker-sep2026.mjs
 *   node scripts/import-afr-pledges-tracker-sep2026.mjs --execute
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
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
const DEFAULT_FILE = "C:/Users/danan/Downloads/AFR Pledges Tracker - Sept 12, 2026.xlsx"
const IMPORT_TAG = "AFR_PLEDGES_TRACKER_SEP2026_V1"
const GENERAL_CATEGORY_NAME = "General Donation"
const DEFAULT_PLEDGE_DATE = "2026-09-12"
const PAYMENT_BATCH_SIZE = 50

/** Sheet group label → existing campaign group name. */
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

function emailList(value) {
  return normalizeText(value)
    .split(/[,;\n]/)
    .map((part) => normalizeEmail(part))
    .filter(Boolean)
}

function normalizePhone(value) {
  const digits = normalizeText(value).replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits
}

function phoneList(value) {
  return normalizeText(value)
    .split(/[,;\n]/)
    .map((part) => normalizePhone(part))
    .filter((digits) => digits.length >= 7)
}

function money(value) {
  if (value == null || value === "") return 0
  if (typeof value === "number") return Math.round(value * 100) / 100
  const parsed = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function parseSheetDate(value) {
  if (value == null || value === "") return DEFAULT_PLEDGE_DATE
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    return utc.toISOString().slice(0, 10)
  }
  const text = normalizeText(value)
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (match) {
    let year = Number(match[3])
    if (year < 100) year += 2000
    const month = String(match[1]).padStart(2, "0")
    const day = String(match[2]).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return DEFAULT_PLEDGE_DATE
}

function campaignGroupName(sheetGroup) {
  const key = normalizeName(sheetGroup)
  if (!key || NOT_CAMPAIGN_GROUPS.has(key)) return null
  return GROUP_ALIASES[key] || normalizeText(sheetGroup)
}

function isOrganizationRow(row) {
  const groupKey = normalizeName(row.sheetGroup)
  if (groupKey === "organization" || groupKey === "sponsor") return true
  return /\b(llc|inc\.?|foundation|incorporated)\b/i.test(row.name)
}

function rowHash(row) {
  const payload = [
    row.excelRow,
    row.name,
    row.sheetGroup,
    row.pledge.toFixed(2),
    row.cash.toFixed(2),
    row.checks.toFixed(2),
    row.cc1.toFixed(2),
    row.ccPlus.toFixed(2),
  ].join("|")
  return createHash("sha256").update(payload).digest("hex").slice(0, 12)
}

function readMasterRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheet = workbook.Sheets.Master
  if (!sheet) throw new Error("Workbook has no Master sheet")
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  const rows = []
  for (let index = 2; index < grid.length; index += 1) {
    const cells = grid[index]
    if (!cells) continue
    const name = normalizeText(cells[1])
    if (!name || /^total$/i.test(name)) continue
    const row = {
      excelRow: index + 1,
      name,
      poc: normalizeText(cells[3]),
      solicitor: normalizeText(cells[4]),
      phoneRaw: cells[5],
      emailRaw: cells[6],
      sheetGroup: normalizeText(cells[8]),
      date: parseSheetDate(cells[9]),
      notes: normalizeText(cells[12]),
      cash: money(cells[14]),
      checks: money(cells[15]),
      cc1: money(cells[16]),
      ccPlus: money(cells[17]),
      pledge: money(cells[18]),
      balance: money(cells[19]),
    }
    row.emails = emailList(row.emailRaw)
    row.phones = phoneList(row.phoneRaw)
    row.email = row.emails[0] || null
    row.phone = row.phones[0] || null
    row.nameKey = normalizeNameForMatch(row.name)
    row.groupName = campaignGroupName(row.sheetGroup)
    row.isGroupTotal =
      Boolean(row.sheetGroup) && normalizeName(row.name) === normalizeName(row.sheetGroup)
    row.hash = rowHash(row)
    const hasMoney =
      row.pledge >= 0.01 ||
      row.cash >= 0.01 ||
      row.checks >= 0.01 ||
      row.cc1 >= 0.01 ||
      row.ccPlus >= 0.01
    if (!hasMoney) continue
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
  for (const email of row.emails) {
    if (indexes.byEmail.has(email)) {
      return { contact: indexes.byEmail.get(email), reason: "email" }
    }
  }
  for (const phone of row.phones) {
    if (indexes.byPhone.has(phone)) {
      return { contact: indexes.byPhone.get(phone), reason: "phone" }
    }
  }
  const exactNameMatches = indexes.byName.get(row.nameKey) || []
  if (exactNameMatches.length === 1) {
    return { contact: exactNameMatches[0], reason: "exact_name" }
  }
  if (row.phones.length > 0 && exactNameMatches.length > 1) {
    const phoneMatch = exactNameMatches.find((contact) =>
      row.phones.includes(normalizePhone(contact.phone))
    )
    if (phoneMatch) return { contact: phoneMatch, reason: "name+phone" }
  }
  return null
}

function pledgeNote(row) {
  const parts = [
    IMPORT_TAG,
    row.hash,
    row.groupName ? `Group: ${row.groupName}` : null,
    row.solicitor ? `Solicitor: ${row.solicitor}` : null,
    row.poc ? `POC: ${row.poc}` : null,
    row.notes || null,
    `Sheet balance: ${row.balance.toFixed(2)}`,
  ].filter(Boolean)
  return parts.join(" | ")
}

function paymentMemo(row, method) {
  const parts = [
    IMPORT_TAG,
    row.hash,
    method,
    row.groupName || row.sheetGroup || null,
    row.notes || null,
  ].filter(Boolean)
  return parts.join("|")
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
    for (const filter of filters) {
      if (filter.op === "eq") query = query.eq(filter.col, filter.val)
    }
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
  const sheetRows = readMasterRows(args.file)
  const report = {
    execute: args.execute,
    file: args.file,
    organizationId: args.orgId,
    campaignId: args.campaignId,
    campaignName: null,
    sheetRows: sheetRows.length,
    pledgesCreated: 0,
    pledgeAmount: 0,
    pledgesSkippedExisting: [],
    paymentsCreated: 0,
    cashAmount: 0,
    checkAmount: 0,
    cardGiftAmount: 0,
    cardGiftsSkippedDuplicate: [],
    cardOnPledgeSkippedAmount: 0,
    cardOnPledgeSkippedCount: 0,
    groupsCreated: 0,
    campaignGroupsCreated: 0,
    contactsMatched: 0,
    contactsCreated: 0,
    donorsCreated: 0,
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
  if (campaignError) throw new Error(`campaign: ${campaignError.message}`)
  if (!campaign) throw new Error(`Campaign ${args.campaignId} not found for this organization`)
  report.campaignName = campaign.name

  const [contacts, donors, categories, subcategories, existingCampaignGroups, existingPledges, existingPayments] =
    await Promise.all([
      fetchAll("contacts", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("donors", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("donation_categories", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("donation_subcategories", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("campaign_groups", [
        { op: "eq", col: "organization_id", val: args.orgId },
        { op: "eq", col: "campaign_id", val: args.campaignId },
      ]),
      fetchAll("pledges", [
        { op: "eq", col: "organization_id", val: args.orgId },
        { op: "eq", col: "campaign_id", val: args.campaignId },
      ]),
      fetchAll("payments", [
        { op: "eq", col: "organization_id", val: args.orgId },
        { op: "eq", col: "campaign_id", val: args.campaignId },
      ]),
    ])

  const contactIndexes = buildContactIndexes(contacts)
  const groupContactsByName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() !== "group") continue
    groupContactsByName.set(normalizeName(contact.full_name), contact)
  }

  const campaignGroupByName = new Map()
  for (const group of existingCampaignGroups) {
    campaignGroupByName.set(normalizeName(group.name), group)
  }

  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )
  const donorById = new Map(donors.map((donor) => [donor.id, donor]))

  const importedPledgeHashes = new Set()
  const availableExistingPledges = []
  for (const pledge of existingPledges) {
    const notes = String(pledge.notes || "")
    const hashMatch = notes.match(new RegExp(`${IMPORT_TAG}\\s*\\|\\s*([a-f0-9]{12})`))
    if (hashMatch) importedPledgeHashes.add(hashMatch[1])
    const donor = donorById.get(pledge.donor_id)
    availableExistingPledges.push({
      id: pledge.id,
      amount: money(pledge.amount_pledged),
      nameKey: normalizeNameForMatch(donor?.full_name || ""),
      consumed: false,
      hash: hashMatch?.[1] || null,
    })
  }

  const importedPaymentKeys = new Set()
  const cardPool = []
  for (const payment of existingPayments) {
    const memo = String(payment.memo || "")
    const hashMatch = memo.match(new RegExp(`${IMPORT_TAG}\\|([a-f0-9]{12})\\|([a-z0-9+]+)`))
    if (hashMatch) importedPaymentKeys.add(`${hashMatch[1]}|${hashMatch[2]}`)
    if (memo.includes(IMPORT_TAG)) continue
    const donor = donorById.get(payment.donor_id)
    const nameKey = normalizeNameForMatch(payment.sender_name || donor?.full_name || "")
    if (!nameKey) continue
    cardPool.push({
      nameKey,
      compact: nameKey.replace(/\s+/g, ""),
      amount: money(payment.amount),
      used: false,
    })
  }

  const categoryByName = new Map(
    categories.map((category) => [normalizeName(category.name), category])
  )
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
    if (error) throw new Error(`category insert (${name}): ${error.message}`)
    categoryByName.set(key, data)
    return data
  }

  async function ensureFund(name, categoryId) {
    const key = normalizeName(name)
    if (fundByName.has(key)) return fundByName.get(key)
    if (!args.execute) {
      const placeholder = { id: `dry-run:fund:${key}`, name, category_id: categoryId }
      fundByName.set(key, placeholder)
      return placeholder
    }
    const { data, error } = await sb
      .from("donation_subcategories")
      .insert({
        organization_id: args.orgId,
        category_id: String(categoryId).startsWith("dry-run:") ? null : categoryId,
        name,
        is_active: true,
      })
      .select("id, name, category_id")
      .single()
    if (error) throw new Error(`fund insert (${name}): ${error.message}`)
    fundByName.set(key, data)
    return data
  }

  async function ensureGroupContact(groupName) {
    const key = normalizeName(groupName)
    if (groupContactsByName.has(key)) return groupContactsByName.get(key)
    const payload = {
      organization_id: args.orgId,
      full_name: groupName,
      contact_type: "group",
      status: "active",
      giving_group_kind: "group_donation",
    }
    if (!args.execute) {
      report.groupsCreated += 1
      const placeholder = { id: `dry-run:group:${key}`, ...payload }
      groupContactsByName.set(key, placeholder)
      return placeholder
    }
    const { data, error } = await sb
      .from("contacts")
      .insert(payload)
      .select("id, full_name, contact_type, email, phone")
      .single()
    if (error) throw new Error(`group contact insert (${groupName}): ${error.message}`)
    groupContactsByName.set(key, data)
    report.groupsCreated += 1
    return data
  }

  async function ensureCampaignGroup(groupName) {
    const key = normalizeName(groupName)
    if (campaignGroupByName.has(key)) return campaignGroupByName.get(key)
    const groupContact = await ensureGroupContact(groupName)
    const payload = {
      organization_id: args.orgId,
      campaign_id: args.campaignId,
      name: groupName,
      organizational_group_id: String(groupContact.id).startsWith("dry-run:")
        ? null
        : groupContact.id,
      lead_contact_id: null,
      goal_amount: null,
      description: `AFR pledges tracker group for ${campaign.name}`,
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
    if (error) throw new Error(`campaign_groups insert (${groupName}): ${error.message}`)
    campaignGroupByName.set(key, data)
    report.campaignGroupsCreated += 1
    return data
  }

  const pendingContacts = new Map()

  async function ensurePersonContact(row) {
    const pendingKey = [row.nameKey, row.email || "", row.phone || "", row.isGroupTotal ? "group" : "person"].join("|")
    if (pendingContacts.has(pendingKey)) return pendingContacts.get(pendingKey)

    if (row.isGroupTotal && row.groupName) {
      const groupContact = await ensureGroupContact(row.groupName)
      pendingContacts.set(pendingKey, groupContact)
      return groupContact
    }

    const match = findContactMatch(row, contactIndexes)
    if (match) {
      report.contactsMatched += 1
      pendingContacts.set(pendingKey, match.contact)
      return match.contact
    }

    const contactType = isOrganizationRow(row) ? "organization" : "individual"
    const payload = {
      organization_id: args.orgId,
      full_name: row.name,
      email: row.email,
      phone: row.phone,
      contact_type: contactType,
      status: "active",
    }

    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = { id: `dry-run:contact:${pendingKey}`, ...payload }
      rememberContact(placeholder, contactIndexes)
      pendingContacts.set(pendingKey, placeholder)
      return placeholder
    }

    const { data: contactId, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
      p_organization_id: args.orgId,
      p_full_name: payload.full_name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_contact_type: payload.contact_type,
    })
    if (rpcError || !contactId) {
      throw new Error(rpcError?.message || `Could not create contact for ${payload.full_name}`)
    }
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, contact_type, status")
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
    const donorType =
      contact.contact_type === "individual" ? "individual" : "organization"
    if (!args.execute) {
      report.donorsCreated += 1
      const placeholder = {
        id: `dry-run:donor:${contact.id}`,
        contact_id: contact.id,
        full_name: contact.full_name,
      }
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
      throw new Error(`donor insert (${contact.full_name}): ${error.message}`)
    }
    donorByContactId.set(contact.id, data)
    report.donorsCreated += 1
    return data
  }

  function claimExistingPledge(row) {
    if (importedPledgeHashes.has(row.hash)) {
      const hashed = availableExistingPledges.find((pledge) => pledge.hash === row.hash)
      return hashed || { id: `already:${row.hash}`, amount: row.pledge, consumed: true }
    }
    const match = availableExistingPledges.find(
      (pledge) =>
        !pledge.consumed &&
        pledge.nameKey === row.nameKey &&
        Math.abs(pledge.amount - row.pledge) < 0.01
    )
    if (!match) return null
    match.consumed = true
    return match
  }

  function claimExistingCard(row, amount) {
    const amountMatches = cardPool.filter(
      (item) => !item.used && Math.abs(item.amount - amount) < 0.01
    )
    const exact = amountMatches.find((item) => item.nameKey === row.nameKey)
    if (exact) {
      exact.used = true
      return true
    }

    const compact = row.nameKey.replace(/\s+/g, "")
    const compactHits = amountMatches.filter((item) => item.compact === compact)
    if (compactHits.length === 1) {
      compactHits[0].used = true
      return true
    }

    const rowTokens = row.nameKey.split(" ").filter((token) => token.length > 1)
    const tokenHits = amountMatches.filter((item) => {
      const itemTokens = item.nameKey.split(" ").filter((token) => token.length > 1)
      const shorter = rowTokens.length <= itemTokens.length ? rowTokens : itemTokens
      const longer = rowTokens.length <= itemTokens.length ? itemTokens : rowTokens
      if (shorter.length < 2) return false
      return shorter.every((token) => longer.includes(token))
    })
    if (tokenHits.length === 1) {
      tokenHits[0].used = true
      return true
    }

    return false
  }

  const category = await ensureCategory(GENERAL_CATEGORY_NAME)
  const fund = await ensureFund(campaign.name, category.id)
  const paymentPayloads = []
  const affectedContactIds = new Set()
  const pledgeIdsToRefresh = new Set()

  for (const row of sheetRows) {
    try {
      const campaignGroup = row.groupName ? await ensureCampaignGroup(row.groupName) : null
      const contact = await ensurePersonContact(row)
      const donor = await ensureDonor(contact)
      const campaignGroupId =
        campaignGroup && !String(campaignGroup.id).startsWith("dry-run:") ? campaignGroup.id : null
      const groupContactId =
        row.isGroupTotal && contact && !String(contact.id).startsWith("dry-run:")
          ? contact.id
          : campaignGroup && !String(campaignGroup.organizational_group_id || "").startsWith("dry-run:")
            ? campaignGroup.organizational_group_id
            : null

      let pledgeId = null
      if (row.pledge >= 0.01) {
        const existing = claimExistingPledge(row)
        if (existing) {
          pledgeId = existing.id
          if (!String(existing.id).startsWith("already:")) {
            report.pledgesSkippedExisting.push({
              name: row.name,
              amount: row.pledge,
              pledgeId: existing.id,
            })
          }
        } else if (!args.execute) {
          pledgeId = `dry-run:pledge:${row.hash}`
          report.pledgesCreated += 1
          report.pledgeAmount += row.pledge
        } else {
          const { data, error } = await sb
            .from("pledges")
            .insert({
              organization_id: args.orgId,
              donor_id: donor.id,
              campaign_id: args.campaignId,
              amount_pledged: row.pledge,
              pledge_date: row.date,
              pledge_type: "one_time",
              frequency: "one_time",
              status: "open",
              notes: pledgeNote(row),
              category_id: String(category.id).startsWith("dry-run:") ? null : category.id,
              subcategory_id: String(fund.id).startsWith("dry-run:") ? null : fund.id,
              campaign_group_id: campaignGroupId,
            })
            .select("id")
            .single()
          if (error) throw new Error(`pledge insert (${row.name}): ${error.message}`)
          pledgeId = data.id
          importedPledgeHashes.add(row.hash)
          availableExistingPledges.push({
            id: data.id,
            amount: row.pledge,
            nameKey: row.nameKey,
            consumed: true,
            hash: row.hash,
          })
          report.pledgesCreated += 1
          report.pledgeAmount += row.pledge
        }
      }

      const methods = [
        ["cash", row.cash],
        ["check", row.checks],
      ]
      if (row.pledge < 0.01) {
        methods.push(["cc1", row.cc1], ["ccplus", row.ccPlus])
      } else {
        if (row.cc1 >= 0.01) {
          report.cardOnPledgeSkippedCount += 1
          report.cardOnPledgeSkippedAmount += row.cc1
        }
        if (row.ccPlus >= 0.01) {
          report.cardOnPledgeSkippedCount += 1
          report.cardOnPledgeSkippedAmount += row.ccPlus
        }
      }

      for (const [method, amount] of methods) {
        if (amount < 0.01) continue
        const paymentKey = `${row.hash}|${method}`
        if (importedPaymentKeys.has(paymentKey)) continue
        if ((method === "cc1" || method === "ccplus") && claimExistingCard(row, amount)) {
          report.cardGiftsSkippedDuplicate.push({ name: row.name, amount, method, excelRow: row.excelRow })
          continue
        }
        const linkedPledgeId =
          pledgeId && !String(pledgeId).startsWith("dry-run:") && !String(pledgeId).startsWith("already:")
            ? pledgeId
            : null
        paymentPayloads.push({
          organization_id: args.orgId,
          donor_id: String(donor.id).startsWith("dry-run:") ? null : donor.id,
          contact_id: String(contact.id).startsWith("dry-run:") ? null : contact.id,
          amount,
          payment_date: `${row.date}T12:00:00.000Z`,
          source: "import",
          source_type: "import",
          status: "unallocated",
          sender_name: row.name,
          category_id: String(category.id).startsWith("dry-run:") ? null : category.id,
          subcategory_id: String(fund.id).startsWith("dry-run:") ? null : fund.id,
          campaign_id: args.campaignId,
          campaign_group_id: campaignGroupId,
          attributed_group_contact_id: groupContactId,
          pledge_id: linkedPledgeId,
          memo: paymentMemo(row, method),
          is_verified: true,
          _method: method,
          _rowName: row.name,
        })
        if (method === "cash") report.cashAmount += amount
        else if (method === "check") report.checkAmount += amount
        else report.cardGiftAmount += amount
        if (linkedPledgeId) pledgeIdsToRefresh.add(linkedPledgeId)
        if (contact.id && !String(contact.id).startsWith("dry-run:")) {
          affectedContactIds.add(contact.id)
        }
      }

      if (report.samples.length < 12 && row.pledge >= 0.01) {
        report.samples.push({
          name: row.name,
          group: row.groupName,
          pledge: row.pledge,
          cash: row.cash,
          checks: row.checks,
          balance: row.balance,
          skippedExisting: report.pledgesSkippedExisting.some(
            (item) => item.name === row.name && item.amount === row.pledge
          ),
        })
      }
    } catch (error) {
      report.errors.push({
        name: row.name,
        excelRow: row.excelRow,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (args.execute) {
    const cleanPayloads = paymentPayloads.map((payment) => {
      const { _method, _rowName, ...rest } = payment
      return rest
    })
    for (let index = 0; index < cleanPayloads.length; index += PAYMENT_BATCH_SIZE) {
      const batch = cleanPayloads.slice(index, index + PAYMENT_BATCH_SIZE)
      const { error } = await sb.from("payments").insert(batch)
      if (error) {
        report.errors.push({
          batch: `${index + 1}-${index + batch.length}`,
          error: error.message,
        })
      } else {
        report.paymentsCreated += batch.length
      }
    }

    for (const pledgeId of pledgeIdsToRefresh) {
      const { error } = await sb.rpc("refresh_pledge_status", { p_pledge_id: pledgeId })
      if (error) {
        report.errors.push({ pledgeId, error: `refresh_pledge_status: ${error.message}` })
      }
    }

    for (const contactId of affectedContactIds) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: contactId,
      })
      if (error) {
        report.errors.push({ contactId, error: `sync_contact_affiliations: ${error.message}` })
      } else {
        report.affiliationsSynced += 1
      }
    }
  } else {
    report.paymentsCreated = paymentPayloads.length
  }

  report.pledgeAmount = Math.round(report.pledgeAmount * 100) / 100
  report.cashAmount = Math.round(report.cashAmount * 100) / 100
  report.checkAmount = Math.round(report.checkAmount * 100) / 100
  report.cardGiftAmount = Math.round(report.cardGiftAmount * 100) / 100
  report.cardOnPledgeSkippedAmount = Math.round(report.cardOnPledgeSkippedAmount * 100) / 100

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportName = args.execute
    ? "afr-pledges-tracker-sep2026-execute.json"
    : "afr-pledges-tracker-sep2026-dry-run.json"
  const reportPath = resolve(reportsDir, reportName)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)
  if (!args.execute) console.log("\nDry run only. Re-run with --execute to import.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
