/**
 * Square machine payments → MAS DFW Annual Fundraiser - September 2026.
 *
 * Named charges apply to an open campaign pledge when the payer's name
 * matches that pledge. Otherwise they are one-time campaign gifts. The
 * unnamed miscellaneous total is one gift under the name Misc.
 * Every payment is on the campaign, so it shows on All Transactions.
 *
 *   node scripts/import-september-2026-square-machine.mjs
 *   node scripts/import-september-2026-square-machine.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "54f5db10-02fe-433a-b91a-f90c16882a97"
const DEFAULT_CAMPAIGN_ID = "fa15246a-e80d-4d65-9bf4-a5af4051b821"
const IMPORT_TAG = "SEP2026_SQUARE_MACHINE_DFW_V1"
const CAMPAIGN_FUND = "Annual Fundraiser - September 2026"
const GENERAL_CATEGORY = "General Donation"

const ROWS = [
  { date: "2026-09-11", amount: 550, name: "Adam Aly" },
  { date: "2026-09-12", amount: 500, name: "Ahmad Nabizadah" },
  { date: "2026-09-04", amount: 20, name: "Aihab Hassan" },
  { date: "2026-09-11", amount: 1000, name: "Aihab Hassan" },
  { date: "2026-09-11", amount: 20, name: "Aihab Hassan" },
  { date: "2026-09-12", amount: 1500, name: "Amina Gomaa" },
  { date: "2026-09-12", amount: 500, name: "Eman Shehata" },
  { date: "2026-09-11", amount: 500, name: "Hani LLC" },
  { date: "2026-09-12", amount: 500, name: "Hisham Morgan" },
  { date: "2026-09-12", amount: 10000, name: "Nader Ahmad" },
  { date: "2026-09-12", amount: 200, name: "Sara Kenana" },
  { date: "2026-09-11", amount: 25, name: "Teyseer Elashyi" },
  {
    date: "2026-09-12",
    amount: 6721,
    name: "Misc",
    note: "Square machine miscellaneous total, no customer names",
  },
]

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

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(dr|mr|mrs|ms|sheikh)\s+/, "")
    .replace(/\b(llc|inc|incorporated|corp|corporation|ltd|limited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function nameTokens(value) {
  return normalizeName(value).split(" ").filter(Boolean)
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

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function isOrganizationName(name) {
  return /\b(llc|inc\.?|incorporated|corp|corporation)\b/i.test(name)
}

loadEnv()
const execute = process.argv.includes("--execute")
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

async function main() {
  const rows = ROWS.map((row, index) => ({
    ...row,
    excelRow: index + 1,
    hash: createHash("sha256")
      .update([row.name, row.date, row.amount.toFixed(2), String(index + 1)].join("|"))
      .digest("hex")
      .slice(0, 12),
  })).sort((left, right) => left.date.localeCompare(right.date) || left.excelRow - right.excelRow)

  const report = {
    mode: execute ? "execute" : "dry-run",
    fileRows: rows.length,
    fileAmount: roundMoney(rows.reduce((total, row) => total + row.amount, 0)),
    paymentsCreated: 0,
    oneTime: 0,
    oneTimeAmount: 0,
    pledgePayments: 0,
    pledgeAmount: 0,
    contactsCreated: 0,
    donorsCreated: 0,
    alreadyImported: 0,
    pledgeApplications: [],
    oneTimeGifts: [],
    pledgesFulfilled: [],
    errors: [],
  }

  const [campaign, pledgesRaw, categories, funds, contacts, donors, existingPayments, appliedPayments] =
    await Promise.all([
      sb.from("campaigns").select("id, name, organization_id").eq("id", DEFAULT_CAMPAIGN_ID).single(),
      fetchAll("pledges", [{ col: "campaign_id", val: DEFAULT_CAMPAIGN_ID }]),
      fetchAll("donation_categories", [{ col: "organization_id", val: DEFAULT_ORG_ID }]),
      fetchAll("donation_subcategories", [{ col: "organization_id", val: DEFAULT_ORG_ID }]),
      fetchAll("contacts", [{ col: "organization_id", val: DEFAULT_ORG_ID }], "id, full_name, email, phone, contact_type"),
      fetchAll("donors", [{ col: "organization_id", val: DEFAULT_ORG_ID }], "id, contact_id, full_name"),
      fetchAll("payments", [{ col: "organization_id", val: DEFAULT_ORG_ID }], "id, memo"),
      sb
        .from("payments")
        .select("pledge_id, amount, status")
        .eq("organization_id", DEFAULT_ORG_ID)
        .not("pledge_id", "is", null),
    ])
  if (campaign.error || !campaign.data) throw new Error(campaign.error?.message || "Campaign not found")
  if (campaign.data.organization_id !== DEFAULT_ORG_ID) {
    throw new Error("Campaign is not in the MAS DFW organization")
  }
  if (appliedPayments.error) throw new Error(appliedPayments.error.message)

  const importedHashes = new Set()
  for (const payment of existingPayments) {
    if (!String(payment.memo || "").includes(IMPORT_TAG)) continue
    const hash = String(payment.memo).split("|").map((part) => part.trim())[1]
    if (hash) importedHashes.add(hash)
  }

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]))
  const donorById = new Map(donors.map((donor) => [donor.id, donor]))
  const donorByContactId = new Map(donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor]))
  const category = categories.find((item) => normalizeName(item.name) === normalizeName(GENERAL_CATEGORY))
  const fund = funds.find((item) => normalizeName(item.name) === normalizeName(CAMPAIGN_FUND))
  if (!category || !fund) throw new Error("Campaign fund was not found")

  const paidByPledge = new Map()
  for (const payment of appliedPayments.data || []) {
    if (String(payment.status || "").toLowerCase() === "voided") continue
    paidByPledge.set(
      payment.pledge_id,
      roundMoney((paidByPledge.get(payment.pledge_id) || 0) + Number(payment.amount))
    )
  }

  const pledges = pledgesRaw
    .filter((pledge) => String(pledge.status || "").toLowerCase() !== "cancelled")
    .map((pledge) => {
      const donor = donorById.get(pledge.donor_id)
      const contact = donor?.contact_id ? contactById.get(donor.contact_id) : null
      const name = contact?.full_name || donor?.full_name || "Unknown"
      const amount = roundMoney(pledge.amount_pledged)
      return {
        id: pledge.id,
        donorId: pledge.donor_id,
        contactId: donor?.contact_id || null,
        name,
        groupId: pledge.campaign_group_id || null,
        amount,
        remaining: roundMoney(amount - (paidByPledge.get(pledge.id) || 0)),
        nameAmount: `${name} $${amount}`,
      }
    })

  async function ensureContact(row) {
    const existing = contacts.find(
      (contact) =>
        String(contact.contact_type || "").toLowerCase() !== "group" && namesMatch(contact.full_name, row.name)
    )
    if (existing) return existing
    const contactType = isOrganizationName(row.name) ? "organization" : "individual"
    if (!execute) {
      report.contactsCreated += 1
      const placeholder = { id: `dry-run:contact:${row.hash}`, full_name: row.name, contact_type: contactType }
      contacts.push(placeholder)
      return placeholder
    }
    const { data: contactId, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
      p_organization_id: DEFAULT_ORG_ID,
      p_full_name: row.name,
      p_email: null,
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
    contacts.push(data)
    report.contactsCreated += 1
    return data
  }

  async function ensureDonor(contact) {
    if (donorByContactId.has(contact.id)) return donorByContactId.get(contact.id)
    if (!execute) {
      report.donorsCreated += 1
      const placeholder = { id: `dry-run:donor:${contact.id}`, contact_id: contact.id, full_name: contact.full_name }
      donorByContactId.set(contact.id, placeholder)
      return placeholder
    }
    const { data, error } = await sb
      .from("donors")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        contact_id: contact.id,
        full_name: contact.full_name,
        donor_type: contact.contact_type === "organization" ? "organization" : "individual",
        status: "active",
      })
      .select("id, contact_id, full_name")
      .single()
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await sb
          .from("donors")
          .select("id, contact_id, full_name")
          .eq("organization_id", DEFAULT_ORG_ID)
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

  const paymentPayloads = []
  const affectedContactIds = new Set()
  const pledgeIdsToRefresh = new Set()

  for (const row of rows) {
    try {
      if (importedHashes.has(row.hash)) {
        report.alreadyImported += 1
        continue
      }
      const matches = pledges.filter((pledge) => pledge.remaining > 0.009 && namesMatch(row.name, pledge.name))
      const pledge = matches.length === 1 ? matches[0] : null
      if (matches.length > 1) {
        throw new Error(`Ambiguous pledges for ${row.name}: ${matches.map((item) => item.nameAmount).join(", ")}`)
      }

      let contact
      let donor
      if (pledge) {
        contact = { id: pledge.contactId, full_name: pledge.name }
        donor = { id: pledge.donorId, contact_id: pledge.contactId }
        pledge.remaining = roundMoney(pledge.remaining - row.amount)
        report.pledgePayments += 1
        report.pledgeAmount += row.amount
        report.pledgeApplications.push({
          name: row.name,
          amount: row.amount,
          date: row.date,
          pledge: pledge.nameAmount,
          remainingAfter: pledge.remaining,
        })
        if (pledge.remaining <= 0.009) report.pledgesFulfilled.push(pledge.nameAmount)
        pledgeIdsToRefresh.add(pledge.id)
      } else {
        contact = await ensureContact(row)
        donor = await ensureDonor(contact)
        report.oneTime += 1
        report.oneTimeAmount += row.amount
        report.oneTimeGifts.push({ name: row.name, amount: row.amount, date: row.date, note: row.note || null })
      }

      const realContactId = contact?.id && !String(contact.id).startsWith("dry-run:") ? contact.id : null
      const realDonorId = donor?.id && !String(donor.id).startsWith("dry-run:") ? donor.id : null
      if (realContactId) affectedContactIds.add(realContactId)
      paymentPayloads.push({
        organization_id: DEFAULT_ORG_ID,
        donor_id: realDonorId,
        contact_id: realContactId,
        amount: row.amount,
        payment_date: `${row.date}T12:00:00.000Z`,
        source: "square",
        source_type: "import",
        status: "unallocated",
        sender_name: row.name,
        category_id: category.id,
        subcategory_id: fund.id,
        campaign_id: DEFAULT_CAMPAIGN_ID,
        campaign_group_id: pledge?.groupId || null,
        pledge_id: pledge ? pledge.id : null,
        memo: [IMPORT_TAG, row.hash, row.note].filter(Boolean).join(" | "),
        is_verified: true,
      })
    } catch (error) {
      report.errors.push({ name: row.name, amount: row.amount, error: error.message })
    }
  }

  if (execute) {
    if (paymentPayloads.length) {
      const { error } = await sb.from("payments").insert(paymentPayloads)
      if (error) report.errors.push({ error: error.message })
      else report.paymentsCreated = paymentPayloads.length
    }
    for (const pledgeId of pledgeIdsToRefresh) {
      const { error } = await sb.rpc("refresh_pledge_status", { p_pledge_id: pledgeId })
      if (error) report.errors.push({ pledgeId, error: error.message })
    }
    for (const contactId of affectedContactIds) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: DEFAULT_ORG_ID,
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
    execute ? "september-2026-square-machine-dfw-execute.json" : "september-2026-square-machine-dfw-dry-run.json"
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)
  if (!execute) console.log("\nDry run only. Re-run with --execute to import.")
  if (report.errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
