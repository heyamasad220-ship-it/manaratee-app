/**
 * Import September2026Pledges.xlsx onto MAS DFW
 * Annual Fundraiser - September 2026.
 *
 * Each row is an open pledge for the Pledge amount. Transaction #, solicitor,
 * and point of contact are stored on the pledge note. No payment is created:
 * the sheet has no received-money columns (CC+ is empty).
 *
 * Group "Organization" and "Sponsor" mark the donor as an organization.
 * Other Group values become giving groups on this campaign.
 *
 *   node scripts/import-september-2026-pledges.mjs
 *   node scripts/import-september-2026-pledges.mjs --execute
 */
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "54f5db10-02fe-433a-b91a-f90c16882a97"
const DEFAULT_CAMPAIGN_ID = "fa15246a-e80d-4d65-9bf4-a5af4051b821"
const DEFAULT_FILE = "C:/Users/danan/Downloads/September2026Pledges.xlsx"
const IMPORT_TAG_V1 = "SEP2026_PLEDGES_DFW_V1"
const IMPORT_TAG_V2 = "SEP2026_PLEDGES_DFW_V2"
const GENERAL_CATEGORY_NAME = "General Donation"
const PLEDGE_DATE = "2026-09-01"
const NOT_CAMPAIGN_GROUPS = new Set(["organization", "sponsor"])

/** Pledge payoff schedules stay off this import. Staff handle those on the pledge. */
const PAYOFF_PLANS = new Map()

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

function stripMarks(value) {
  return String(value ?? "").replace(/[\u200e\u200f\u202a-\u202e]/g, "")
}

function normalizeText(value) {
  return stripMarks(value).trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseEmails(value) {
  return normalizeText(value)
    .split(/[,;]/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.includes("@"))
}

function parsePhone(value) {
  const text = normalizeText(value)
  if (!text || text.includes("@")) return null
  const digits = text.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits.length >= 7 ? digits : null
}

function money(value) {
  if (value == null || value === "") return 0
  if (typeof value === "number") return Math.round(value * 100) / 100
  const parsed = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function isOrganizationRow(row) {
  const groupKey = normalizeName(row.sheetGroup)
  if (groupKey === "organization" || groupKey === "sponsor") return true
  return /\b(llc|inc\.?|foundation|pharmacy|labs|market|mortgage|memorial|scouts|forum|society|association)\b/i.test(
    row.name
  )
}

function campaignGroupName(sheetGroup) {
  const key = normalizeName(sheetGroup)
  if (!key || NOT_CAMPAIGN_GROUPS.has(key)) return null
  return normalizeText(sheetGroup)
}

function rowHash(row) {
  return createHash("sha256")
    .update([row.excelRow, row.name, row.sheetGroup, row.pledge.toFixed(2), row.transaction || ""].join("|"))
    .digest("hex")
    .slice(0, 12)
}

function pledgeNote(row, importTag) {
  const plan = row.plan
    ? `Plan: $${row.plan.installment} monthly x ${row.plan.count} starting ${row.plan.first}`
    : null
  return [
    importTag,
    row.hash,
    row.solicitor ? `Solicitor: ${row.solicitor}` : null,
    row.poc ? `POC: ${row.poc}` : null,
    row.transaction ? `Txn: ${row.transaction}` : null,
    row.groupName ? `Group: ${row.groupName}` : null,
    row.sheetGroup && !row.groupName ? `Sheet group: ${row.sheetGroup}` : null,
    row.extraEmails.length ? `Also: ${row.extraEmails.join(", ")}` : null,
    plan,
    row.sheetNotes || null,
  ]
    .filter(Boolean)
    .join(" | ")
}

function payoffPlanFor(row) {
  const plan = PAYOFF_PLANS.get(normalizeName(row.name))
  if (!plan) return null
  const plannedTotal = Math.round(plan.installment * plan.count * 100) / 100
  if (Math.abs(plannedTotal - row.pledge) > 0.05) return null
  return plan
}

function createPublicToken() {
  return randomUUID().replace(/-/g, "")
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("Workbook has no sheet")
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  const header = (grid[0] || []).map((cell) => normalizeText(cell).toLowerCase())
  const v1 = ["name", "poc", "solicitor", "cell#", "email", "group", "transaction #", "cc+", "pledge"]
  const v2 = ["name", "poc", "solicitor", "cell#", "email", "group", "date", "transaction #", "notes", "pledge"]
  const format = v2.every((label, index) => header[index] === label)
    ? "v2"
    : v1.every((label, index) => header[index] === label)
      ? "v1"
      : null
  if (!format) throw new Error(`Unexpected header: ${header.join(", ")}`)
  const rows = []
  for (let index = 1; index < grid.length; index += 1) {
    const cells = grid[index]
    if (!cells || !normalizeText(cells[0])) continue
    const phoneCell = normalizeText(cells[3])
    const emails = [...parseEmails(cells[4]), ...parseEmails(phoneCell)]
    const row = {
      excelRow: index + 1,
      name: normalizeText(cells[0]),
      poc: normalizeText(cells[1]) || null,
      solicitor: normalizeText(cells[2]) || null,
      phone: parsePhone(cells[3]),
      email: emails[0] || null,
      extraEmails: emails.slice(1),
      sheetGroup: normalizeText(cells[5]),
      transaction: normalizeText(format === "v2" ? cells[7] : cells[6]) || null,
      sheetNotes: format === "v2" ? normalizeText(cells[8]) || null : null,
      pledge: money(format === "v2" ? cells[9] : cells[8]),
    }
    row.groupName = campaignGroupName(row.sheetGroup)
    row.organization = isOrganizationRow(row)
    row.plan = format === "v2" ? payoffPlanFor(row) : null
    row.hash = rowHash(row)
    if (row.pledge < 0.01) continue
    rows.push(row)
  }
  return { rows, format }
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
  const { rows, format } = readRows(args.file)
  const importTag = format === "v2" ? IMPORT_TAG_V2 : IMPORT_TAG_V1
  const report = {
    execute: args.execute,
    file: args.file,
    orgId: args.orgId,
    campaignId: args.campaignId,
    campaignName: null,
    rows: rows.length,
    pledgesCreated: 0,
    pledgesSkipped: 0,
    pledgeAmount: 0,
    contactsCreated: 0,
    contactsMatched: 0,
    donorsCreated: 0,
    groupsCreated: 0,
    campaignGroupsCreated: 0,
    affiliationsSynced: 0,
    organizationDonors: rows.filter((row) => row.organization).length,
    groupedPledges: rows.filter((row) => row.groupName).length,
    withTransactionRef: rows.filter((row) => row.transaction).length,
    plansApplied: [],
    errors: [],
    groups: [...new Set(rows.map((row) => row.groupName).filter(Boolean))].sort(),
  }

  const { data: campaign, error: campaignError } = await sb
    .from("campaigns")
    .select("id, name, organization_id")
    .eq("id", args.campaignId)
    .eq("organization_id", args.orgId)
    .maybeSingle()
  if (campaignError) throw new Error(campaignError.message)
  if (!campaign) throw new Error("Campaign not found for MAS DFW")
  report.campaignName = campaign.name

  const [contacts, donors, categories, subcategories, existingGroups, existingPledges] = await Promise.all([
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
  ])

  const importedHashes = new Set()
  for (const pledge of existingPledges) {
    const match = String(pledge.notes || "").match(new RegExp(`${importTag} \\| ([a-f0-9]{12})`))
    if (match) importedHashes.add(match[1])
  }

  const contactsByName = new Map()
  const contactsByEmail = new Map()
  const contactsByPhone = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() === "group") continue
    const nameKey = normalizeName(contact.full_name)
    if (nameKey && !contactsByName.has(nameKey)) contactsByName.set(nameKey, contact)
    const email = normalizeText(contact.email).toLowerCase()
    if (email && !contactsByEmail.has(email)) contactsByEmail.set(email, contact)
    const phone = parsePhone(contact.phone)
    if (phone && !contactsByPhone.has(phone)) contactsByPhone.set(phone, contact)
  }
  const groupContactsByName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() !== "group") continue
    groupContactsByName.set(normalizeName(contact.full_name), contact)
  }
  const campaignGroupByName = new Map(existingGroups.map((group) => [normalizeName(group.name), group]))
  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )
  const category = categories.find((item) => normalizeName(item.name) === normalizeName(GENERAL_CATEGORY_NAME))
  if (!category) throw new Error("General Donation category is missing")
  const fund = subcategories.find((item) => normalizeName(item.name) === normalizeName(campaign.name))
  if (!fund) throw new Error(`Fund ${campaign.name} is missing`)

  function rememberContact(contact) {
    const nameKey = normalizeName(contact.full_name)
    if (nameKey) contactsByName.set(nameKey, contact)
    const email = normalizeText(contact.email).toLowerCase()
    if (email) contactsByEmail.set(email, contact)
    const phone = parsePhone(contact.phone)
    if (phone) contactsByPhone.set(phone, contact)
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
      .select("id, full_name, contact_type")
      .single()
    if (error) throw new Error(`group (${groupName}): ${error.message}`)
    groupContactsByName.set(key, data)
    report.groupsCreated += 1
    return data
  }

  async function ensureCampaignGroup(groupContact) {
    const key = normalizeName(groupContact.full_name)
    if (campaignGroupByName.has(key)) return campaignGroupByName.get(key)
    const payload = {
      organization_id: args.orgId,
      campaign_id: args.campaignId,
      name: groupContact.full_name,
      organizational_group_id: String(groupContact.id).startsWith("dry-run:") ? null : groupContact.id,
      lead_contact_id: null,
      goal_amount: null,
      description: "September 2026 pledge import",
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
    if (error) throw new Error(`campaign group (${groupContact.full_name}): ${error.message}`)
    campaignGroupByName.set(key, data)
    report.campaignGroupsCreated += 1
    return data
  }

  async function ensureContact(row) {
    const nameKey = normalizeName(row.name)
    const existing =
      (row.email && contactsByEmail.get(row.email)) ||
      (row.phone && contactsByPhone.get(row.phone)) ||
      contactsByName.get(nameKey) ||
      null
    if (existing) {
      report.contactsMatched += 1
      return existing
    }
    const contactType = row.organization ? "organization" : "individual"
    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = {
        id: `dry-run:contact:${nameKey}`,
        full_name: row.name,
        email: row.email,
        phone: row.phone,
        contact_type: contactType,
      }
      rememberContact(placeholder)
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
    rememberContact(data)
    report.contactsCreated += 1
    return data
  }

  async function ensureDonor(contact) {
    if (donorByContactId.has(contact.id)) return donorByContactId.get(contact.id)
    const donorType = contact.contact_type === "organization" ? "organization" : "individual"
    if (!args.execute) {
      report.donorsCreated += 1
      const placeholder = { id: `dry-run:donor:${contact.id}`, contact_id: contact.id }
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

  const affectedContactIds = new Set()

  for (const row of rows) {
    try {
      if (importedHashes.has(row.hash)) {
        report.pledgesSkipped += 1
        continue
      }
      const contact = await ensureContact(row)
      const donor = await ensureDonor(contact)
      const groupContact = row.groupName ? await ensureGroupContact(row.groupName) : null
      const campaignGroup = groupContact ? await ensureCampaignGroup(groupContact) : null
      const campaignGroupId =
        campaignGroup && !String(campaignGroup.id).startsWith("dry-run:") ? campaignGroup.id : null
      if (row.plan) {
        report.plansApplied.push({
          name: row.name,
          amount: row.pledge,
          installment: row.plan.installment,
          count: row.plan.count,
          first: row.plan.first,
        })
      }
      if (!args.execute) {
        report.pledgesCreated += 1
        report.pledgeAmount += row.pledge
        importedHashes.add(row.hash)
        continue
      }
      const { error } = await sb.from("pledges").insert({
        organization_id: args.orgId,
        donor_id: donor.id,
        campaign_id: args.campaignId,
        amount_pledged: row.pledge,
        pledge_date: PLEDGE_DATE,
        pledge_type: row.plan ? "monthly" : "one_time",
        frequency: row.plan ? "monthly" : "one_time",
        status: "open",
        notes: pledgeNote(row, importTag),
        category_id: category.id,
        subcategory_id: fund.id,
        campaign_group_id: campaignGroupId,
        installment_amount: row.plan ? row.plan.installment : null,
        total_payments: row.plan ? row.plan.count : null,
        first_payment_date: row.plan ? row.plan.first : null,
        next_payment_date: row.plan ? row.plan.first : null,
      })
      if (error) throw new Error(error.message)
      report.pledgesCreated += 1
      report.pledgeAmount += row.pledge
      importedHashes.add(row.hash)
      if (!String(contact.id).startsWith("dry-run:")) affectedContactIds.add(contact.id)
    } catch (error) {
      report.errors.push({ excelRow: row.excelRow, name: row.name, error: error.message })
    }
  }

  if (args.execute) {
    for (const contactId of affectedContactIds) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: contactId,
      })
      if (error) report.errors.push({ contactId, error: error.message })
      else report.affiliationsSynced += 1
    }
  }

  report.pledgeAmount = Math.round(report.pledgeAmount * 100) / 100
  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportStem = format === "v2" ? "september-2026-pledges2-dfw" : "september-2026-pledges-dfw"
  const reportPath = resolve(
    reportsDir,
    args.execute ? `${reportStem}-execute.json` : `${reportStem}-dry-run.json`
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)
  if (!args.execute) console.log("\nDry run only. Re-run with --execute to import.")
  if (report.errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
