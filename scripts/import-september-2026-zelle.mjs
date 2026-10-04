/**
 * Zelle donations → MAS DFW Annual Fundraiser - September 2026.
 *
 * An open campaign pledge is paid when the sender matches that pledge, or
 * when the Zelle note names it. A payment that covers several of the same
 * donor's open pledges is split across them. Anything left over is a
 * one-time campaign gift.
 *
 *   node scripts/import-september-2026-zelle.mjs
 *   node scripts/import-september-2026-zelle.mjs --execute
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
const DEFAULT_FILE = "C:/Users/danan/Downloads/ZelleDonationsSept2026.xlsx"
const IMPORT_TAG = "SEP2026_ZELLE_DFW_V1"
const CAMPAIGN_FUND = "Annual Fundraiser - September 2026"
const GENERAL_CATEGORY = "General Donation"
const PAYMENT_BATCH_SIZE = 50

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
  return String(value ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(dr|mr|mrs|ms|sheikh)\s+/, "")
}

function legalName(value) {
  return normalizeName(value)
    .replace(/\b(llc|inc|incorporated|corp|corporation|ltd|limited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function nameTokens(value) {
  return legalName(value).split(" ").filter(Boolean)
}

function tokensMatch(left, right) {
  return left === right || left === `al${right}` || right === `al${left}`
}

function namesMatch(leftName, rightName) {
  const left = nameTokens(leftName)
  const right = nameTokens(rightName)
  if (!left.length || left.length !== right.length) return false
  return left.every((token, index) => tokensMatch(token, right[index]))
}

function displayName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bLlc\b/g, "LLC")
    .replace(/\bInc\b/g, "Inc")
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase()
  return text.includes("@") ? text : ""
}

function money(value) {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function parseDate(value) {
  const text = normalizeText(value)
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!us) return null
  const year = us[3].length === 2 ? `20${us[3]}` : us[3]
  return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
}

function isOrganizationName(name) {
  return /\b(llc|inc\.?|incorporated|corp|corporation)\b/i.test(name)
}

function mapNote(note) {
  const text = normalizeText(note)
  const key = text.toLowerCase()
  const email = key.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0] || ""
  if (key.includes("wednesday halaqa")) return { kind: "group", groupName: "Wednesday Halaqa", email }
  if (key.includes("thursday hala") || key.includes("thursday halaka")) {
    return { kind: "group", groupName: "Thursday Halaqa", email }
  }
  if (key.includes("al-islah") || key.includes("al islah")) {
    return { kind: "group", groupName: "CYP Usrat Al-Islah", email }
  }
  if (key.includes("muhajira") || key.includes("almuhajira")) {
    return { kind: "group", groupName: "Usrat Al-Muhajira", email }
  }
  if (key.includes("sabiqoon") || key.includes("sabiqun")) {
    return { kind: "group", groupName: "Usrat As-Sabiqoon CYP", email }
  }
  if (key.includes("quran institute")) return { kind: "group", groupName: "Quran Institute for Ladies", email }
  if (key.includes("tarbiya")) return { kind: "group", groupName: "Tarbiya", email }
  if (key.includes("sadaqah") || key.includes("sdqh")) {
    return { kind: "fund", category: GENERAL_CATEGORY, fund: "Sadaqah", email }
  }
  if (key === "youth") return { kind: "fund", category: GENERAL_CATEGORY, fund: "Youth", email }
  return { kind: "fund", category: GENERAL_CATEGORY, fund: CAMPAIGN_FUND, email }
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false })
  const rows = []
  grid.forEach((cells, index) => {
    const sender = normalizeText(cells.Sender)
    const note = normalizeText(cells.Note)
    const amount = money(cells.Amount)
    const paymentDate = parseDate(cells.Date)
    if (!sender || amount < 0.01 || !paymentDate) return
    const mapping = mapNote(note)
    const hash = createHash("sha256")
      .update([sender, paymentDate, amount.toFixed(2), note, String(index + 2)].join("|"))
      .digest("hex")
      .slice(0, 12)
    rows.push({
      excelRow: index + 2,
      name: displayName(sender),
      rawName: sender,
      email: mapping.email || null,
      note,
      amount,
      paymentDate,
      mapping,
      hash,
    })
  })
  rows.sort((left, right) => left.paymentDate.localeCompare(right.paymentDate) || left.excelRow - right.excelRow)
  return rows
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

async function fetchAll(table, filters = [], select = "*") {
  const rows = []
  let from = 0
  while (true) {
    let query = sb.from(table).select(select).range(from, from + 999)
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

function pledgePersonMatches(row, pledge) {
  if (row.email && pledge.email && row.email === pledge.email) return "email"
  if (pledge.name && namesMatch(row.name, pledge.name)) return "name"
  return null
}

function allocate(row, pledges) {
  const note = normalizeName(row.note)
  const open = () => pledges.filter((pledge) => pledge.remaining > 0.009)

  if (note.includes("adam aly") && note.includes("family")) {
    const pledge = open().find((item) => namesMatch(item.name, "Adam Aly & Family"))
    if (pledge) return [{ kind: "pledge", pledge, amount: row.amount, how: "note" }]
  }

  if (namesMatch(row.name, "Aly Taha") && note.includes("sabiqoon")) {
    const matches = open().filter(
      (pledge) =>
        normalizeName(pledge.groupName).includes("sabiqoon") && nameTokens(pledge.name).includes("taha")
    )
    if (matches.length === 1) return [{ kind: "pledge", pledge: matches[0], amount: row.amount, how: "note" }]
  }

  if (namesMatch(row.name, "Ahmad Gharbieh") && note.includes("zahra") && note.includes("gharbieh")) {
    const pieces = []
    let left = row.amount
    for (const groupKey of ["zahra family", "gharbieh family"]) {
      const pledge = open().find(
        (item) => namesMatch(item.name, row.name) && normalizeName(item.groupName) === groupKey
      )
      if (!pledge || left < 0.01) continue
      const take = roundMoney(Math.min(left, pledge.remaining))
      pieces.push({ kind: "pledge", pledge, amount: take, how: "note-split" })
      left = roundMoney(left - take)
    }
    if (left > 0.009) {
      pieces.push({
        kind: "one_time",
        amount: left,
        groupName: note.includes("sabiqoon") ? "Usrat As-Sabiqoon CYP" : null,
        how: "note-remainder",
      })
    }
    return pieces
  }

  const matches = open().filter((pledge) => pledgePersonMatches(row, pledge))
  if (matches.length === 1) return [{ kind: "pledge", pledge: matches[0], amount: row.amount, how: "name" }]
  if (matches.length > 1) {
    const sum = roundMoney(matches.reduce((total, pledge) => total + pledge.remaining, 0))
    if (Math.abs(sum - row.amount) < 0.02) {
      return matches.map((pledge) => ({
        kind: "pledge",
        pledge,
        amount: pledge.remaining,
        how: "split-remaining",
      }))
    }
    return [
      {
        kind: "one_time",
        amount: row.amount,
        how: "ambiguous",
        options: matches.map((pledge) => pledge.nameAmount),
      },
    ]
  }
  return [{ kind: "one_time", amount: row.amount, how: "no-pledge" }]
}

async function main() {
  const rows = readRows(args.file)
  const report = {
    mode: args.execute ? "execute" : "dry-run",
    file: args.file,
    fileRows: rows.length,
    fileAmount: roundMoney(rows.reduce((total, row) => total + row.amount, 0)),
    paymentsCreated: 0,
    oneTime: 0,
    oneTimeAmount: 0,
    pledgePayments: 0,
    pledgeAmount: 0,
    contactsCreated: 0,
    contactsMatched: 0,
    donorsCreated: 0,
    groupsCreated: 0,
    fundsCreated: 0,
    alreadyImported: 0,
    pledgeApplications: [],
    oneTimeGifts: [],
    unmatchedPledgeNotes: [],
    ambiguous: [],
    pledgesFulfilled: [],
    errors: [],
  }

  const [campaign, pledgesRaw, groups, categories, funds, contacts, donors, existingPayments] = await Promise.all([
    sb.from("campaigns").select("id, name, organization_id").eq("id", args.campaignId).single(),
    fetchAll("pledges", [{ col: "campaign_id", val: args.campaignId }]),
    fetchAll("campaign_groups", [{ col: "campaign_id", val: args.campaignId }]),
    fetchAll("donation_categories", [{ col: "organization_id", val: args.orgId }]),
    fetchAll("donation_subcategories", [{ col: "organization_id", val: args.orgId }]),
    fetchAll("contacts", [{ col: "organization_id", val: args.orgId }], "id, full_name, email, phone, contact_type"),
    fetchAll("donors", [{ col: "organization_id", val: args.orgId }], "id, contact_id, full_name, email, phone, donor_type"),
    fetchAll("payments", [{ col: "organization_id", val: args.orgId }], "id, memo, amount"),
  ])
  if (campaign.error || !campaign.data) throw new Error(campaign.error?.message || "Campaign not found")
  if (campaign.data.organization_id !== args.orgId) {
    throw new Error("Campaign is not in the MAS DFW organization")
  }

  const importedHashes = new Set()
  for (const payment of existingPayments) {
    if (!String(payment.memo || "").includes(IMPORT_TAG)) continue
    const hash = String(payment.memo).split("|").map((part) => part.trim())[1]
    if (hash) importedHashes.add(hash)
  }

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]))
  const donorById = new Map(donors.map((donor) => [donor.id, donor]))
  const donorByContactId = new Map(donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor]))
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const categoryByName = new Map(categories.map((category) => [normalizeName(category.name), category]))
  const fundByName = new Map(funds.map((fund) => [normalizeName(fund.name), fund]))
  const groupContactsByName = new Map(
    contacts
      .filter((contact) => String(contact.contact_type || "").toLowerCase() === "group")
      .map((contact) => [normalizeName(contact.full_name), contact])
  )
  const campaignGroupByName = new Map(groups.map((group) => [normalizeName(group.name), group]))

  const pledges = pledgesRaw
    .filter((pledge) => String(pledge.status || "").toLowerCase() !== "cancelled")
    .map((pledge) => {
      const donor = donorById.get(pledge.donor_id)
      const contact = donor?.contact_id ? contactById.get(donor.contact_id) : null
      const group = pledge.campaign_group_id ? groupById.get(pledge.campaign_group_id) : null
      const name = contact?.full_name || donor?.full_name || "Unknown"
      return {
        id: pledge.id,
        donorId: pledge.donor_id,
        contactId: donor?.contact_id || null,
        name,
        email: normalizeEmail(contact?.email || donor?.email),
        groupName: group?.name || null,
        groupId: group?.id || null,
        groupContactId: group?.organizational_group_id || null,
        amount: money(pledge.amount_pledged),
        remaining: money(pledge.amount_pledged),
        nameAmount: `${name} $${money(pledge.amount_pledged)}${group?.name ? ` (${group.name})` : ""}`,
      }
    })

  const pledgePayments = existingPayments.filter((payment) => payment.memo || true)
  const paidByPledge = new Map()
  const { data: applied, error: appliedError } = await sb
    .from("payments")
    .select("pledge_id, amount, status")
    .eq("organization_id", args.orgId)
    .not("pledge_id", "is", null)
  if (appliedError) throw new Error(appliedError.message)
  for (const payment of applied || []) {
    if (String(payment.status || "").toLowerCase() === "voided") continue
    paidByPledge.set(payment.pledge_id, roundMoney((paidByPledge.get(payment.pledge_id) || 0) + money(payment.amount)))
  }
  for (const pledge of pledges) {
    pledge.remaining = roundMoney(pledge.amount - (paidByPledge.get(pledge.id) || 0))
  }
  void pledgePayments

  function rememberContact(contact) {
    contactById.set(contact.id, contact)
    if (String(contact.contact_type || "").toLowerCase() === "group") {
      groupContactsByName.set(normalizeName(contact.full_name), contact)
    }
  }

  async function ensureContact(row) {
    const existing =
      contacts.find(
        (contact) =>
          String(contact.contact_type || "").toLowerCase() !== "group" && namesMatch(contact.full_name, row.name)
      ) ||
      [...contactById.values()].find(
        (contact) =>
          String(contact.contact_type || "").toLowerCase() !== "group" && namesMatch(contact.full_name, row.name)
      ) ||
      null
    if (existing) {
      report.contactsMatched += 1
      return existing
    }
    const contactType = isOrganizationName(row.name) ? "organization" : "individual"
    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = {
        id: `dry-run:contact:${row.hash}`,
        full_name: row.name,
        email: row.email,
        contact_type: contactType,
      }
      rememberContact(placeholder)
      contacts.push(placeholder)
      return placeholder
    }
    const { data: contactId, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
      p_organization_id: args.orgId,
      p_full_name: row.name,
      p_email: row.email,
      p_phone: null,
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
    contacts.push(data)
    report.contactsCreated += 1
    return data
  }

  async function ensureDonor(contact) {
    if (donorByContactId.has(contact.id)) return donorByContactId.get(contact.id)
    const donorType = contact.contact_type === "organization" ? "organization" : "individual"
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
        email: contact.email || null,
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

  async function ensureCategory(name) {
    const key = normalizeName(name)
    if (categoryByName.has(key)) return categoryByName.get(key)
    throw new Error(`Missing donation category ${name}`)
  }

  async function ensureFund(name, categoryId) {
    const key = normalizeName(name)
    if (fundByName.has(key)) return fundByName.get(key)
    if (!args.execute) {
      report.fundsCreated += 1
      const placeholder = { id: `dry-run:fund:${key}`, name, category_id: categoryId }
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
      .select("id, name, category_id")
      .single()
    if (error) throw new Error(`fund (${name}): ${error.message}`)
    fundByName.set(key, data)
    report.fundsCreated += 1
    return data
  }

  async function ensureGroup(groupName) {
    const key = normalizeName(groupName)
    let groupContact = groupContactsByName.get(key)
    if (!groupContact) {
      if (!args.execute) {
        report.groupsCreated += 1
        groupContact = { id: `dry-run:group:${key}`, full_name: groupName, contact_type: "group" }
      } else {
        const { data, error } = await sb
          .from("contacts")
          .insert({
            organization_id: args.orgId,
            full_name: groupName,
            contact_type: "group",
            status: "active",
            giving_group_kind: "group_donation",
          })
          .select("id, full_name, contact_type")
          .single()
        if (error) throw new Error(`group (${groupName}): ${error.message}`)
        groupContact = data
        report.groupsCreated += 1
      }
      groupContactsByName.set(key, groupContact)
    }
    let campaignGroup = campaignGroupByName.get(key)
    if (!campaignGroup) {
      if (!args.execute || String(groupContact.id).startsWith("dry-run:")) {
        campaignGroup = {
          id: `dry-run:campaign-group:${key}`,
          name: groupName,
          organizational_group_id: groupContact.id,
        }
      } else {
        const { data, error } = await sb
          .from("campaign_groups")
          .insert({
            organization_id: args.orgId,
            campaign_id: args.campaignId,
            name: groupName,
            organizational_group_id: groupContact.id,
            lead_contact_id: null,
            goal_amount: null,
            description: "September 2026 Zelle import",
            public_token: randomUUID().replace(/-/g, ""),
            status: "active",
            public_progress_enabled: true,
            link_active: true,
          })
          .select("id, name, organizational_group_id")
          .single()
        if (error) throw new Error(`campaign group (${groupName}): ${error.message}`)
        campaignGroup = data
      }
      campaignGroupByName.set(key, campaignGroup)
    }
    return campaignGroup
  }

  const paymentPayloads = []
  const affectedContactIds = new Set()
  const pledgeIdsToRefresh = new Set()

  for (const row of rows) {
    try {
      if (importedHashes.has(row.hash)) {
        report.alreadyImported += 1
        continue
      }
      if (/\bpledge\b/i.test(row.note) && !namesMatch(row.name, "Aly Taha") && !namesMatch(row.name, "Ahmad Gharbieh") && !normalizeName(row.note).includes("adam aly")) {
        report.unmatchedPledgeNotes.push({ name: row.name, amount: row.amount, note: row.note })
      }
      const pieces = allocate(row, pledges)
      if (pieces.some((piece) => piece.how === "ambiguous")) {
        report.ambiguous.push({ name: row.name, amount: row.amount, options: pieces[0].options })
      }
      const contactForGift = pieces.some((piece) => piece.kind === "one_time") ? await ensureContact(row) : null
      const donorForGift = contactForGift ? await ensureDonor(contactForGift) : null

      for (const piece of pieces) {
        const mapping = piece.groupName ? { kind: "group", groupName: piece.groupName } : row.mapping
        const categoryName = mapping.kind === "group" ? GENERAL_CATEGORY : mapping.category
        const fundName = mapping.kind === "group" ? CAMPAIGN_FUND : mapping.fund
        const category = await ensureCategory(categoryName)
        const fund = await ensureFund(fundName, category.id)
        let campaignGroup = null
        if (mapping.kind === "group") campaignGroup = await ensureGroup(mapping.groupName)
        else if (piece.pledge?.groupId) {
          campaignGroup = {
            id: piece.pledge.groupId,
            organizational_group_id: piece.pledge.groupContactId,
            name: piece.pledge.groupName,
          }
        }

        let contact
        let donor
        if (piece.kind === "pledge") {
          contact = { id: piece.pledge.contactId, full_name: piece.pledge.name }
          donor = { id: piece.pledge.donorId, contact_id: piece.pledge.contactId }
          piece.pledge.remaining = roundMoney(piece.pledge.remaining - piece.amount)
          report.pledgePayments += 1
          report.pledgeAmount += piece.amount
          report.pledgeApplications.push({
            name: row.name,
            amount: piece.amount,
            date: row.paymentDate,
            note: row.note,
            pledge: piece.pledge.nameAmount,
            how: piece.how,
            remainingAfter: piece.pledge.remaining,
          })
          if (piece.pledge.remaining <= 0.009 && !report.pledgesFulfilled.includes(piece.pledge.nameAmount)) {
            report.pledgesFulfilled.push(piece.pledge.nameAmount)
          }
          pledgeIdsToRefresh.add(piece.pledge.id)
        } else {
          contact = contactForGift
          donor = donorForGift
          report.oneTime += 1
          report.oneTimeAmount += piece.amount
          report.oneTimeGifts.push({
            name: row.name,
            amount: piece.amount,
            date: row.paymentDate,
            note: row.note,
            fund: mapping.kind === "group" ? mapping.groupName : mapping.fund,
            how: piece.how,
          })
        }

        const realContactId = contact?.id && !String(contact.id).startsWith("dry-run:") ? contact.id : null
        const realDonorId = donor?.id && !String(donor.id).startsWith("dry-run:") ? donor.id : null
        if (realContactId) affectedContactIds.add(realContactId)
        const groupId = campaignGroup && !String(campaignGroup.id).startsWith("dry-run:") ? campaignGroup.id : null
        const groupContactId =
          campaignGroup?.organizational_group_id &&
          !String(campaignGroup.organizational_group_id).startsWith("dry-run:")
            ? campaignGroup.organizational_group_id
            : null
        const paidBy =
          piece.kind === "pledge" && !namesMatch(row.name, piece.pledge.name) ? `Paid by ${row.name}` : null
        paymentPayloads.push({
          organization_id: args.orgId,
          donor_id: realDonorId,
          contact_id: realContactId,
          amount: piece.amount,
          payment_date: `${row.paymentDate}T12:00:00.000Z`,
          source: "zelle",
          source_type: "import",
          status: "unallocated",
          sender_name: row.name,
          category_id: String(category.id).startsWith("dry-run:") ? null : category.id,
          subcategory_id: String(fund.id).startsWith("dry-run:") ? null : fund.id,
          campaign_id: args.campaignId,
          campaign_group_id: groupId,
          attributed_group_contact_id: groupContactId,
          pledge_id: piece.pledge && !String(piece.pledge.id).startsWith("dry-run:") ? piece.pledge.id : null,
          external_id: null,
          import_email: row.email,
          memo: [IMPORT_TAG, row.hash, row.note, piece.how, paidBy].filter(Boolean).join(" | "),
          is_verified: true,
        })
      }
      importedHashes.add(row.hash)
    } catch (error) {
      report.errors.push({ excelRow: row.excelRow, name: row.name, error: error.message })
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
    }
  } else {
    report.paymentsCreated = paymentPayloads.length
  }

  report.oneTimeAmount = roundMoney(report.oneTimeAmount)
  report.pledgeAmount = roundMoney(report.pledgeAmount)
  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(
    reportsDir,
    args.execute ? "september-2026-zelle-dfw-execute.json" : "september-2026-zelle-dfw-dry-run.json"
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {
        fileRows: report.fileRows,
        fileAmount: report.fileAmount,
        paymentsCreated: report.paymentsCreated,
        oneTime: report.oneTime,
        oneTimeAmount: report.oneTimeAmount,
        pledgePayments: report.pledgePayments,
        pledgeAmount: report.pledgeAmount,
        pledgesFulfilled: report.pledgesFulfilled,
        pledgeApplications: report.pledgeApplications,
        oneTimeGifts: report.oneTimeGifts,
        unmatchedPledgeNotes: report.unmatchedPledgeNotes,
        ambiguous: report.ambiguous,
        fundsCreated: report.fundsCreated,
        contactsCreated: report.contactsCreated,
        errors: report.errors,
      },
      null,
      2
    )
  )
  console.log(`\nReport written to ${reportPath}`)
  if (!args.execute) console.log("\nDry run only. Re-run with --execute to import.")
  if (report.errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
