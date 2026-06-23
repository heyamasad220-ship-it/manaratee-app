/**
 * Import MAS campaign ledger CSV (pledges + historical payments) into canonical tables.
 *
 * Usage:
 *   node scripts/import-mas-campaign-ledger.mjs --file "C:/path/All Campaigns.csv"
 *   node scripts/import-mas-campaign-ledger.mjs --file "..." --campaign "December 2023"
 *   node scripts/import-mas-campaign-ledger.mjs --file "..." --execute
 *   node scripts/import-mas-campaign-ledger.mjs --file "..." --execute --create-campaigns
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "MAS_CAMPAIGN_LEDGER_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

const PAYMENT_SOURCE_CHANNELS = new Set([
  "cash",
  "check",
  "zelle",
  "venmo",
  "paypal",
  "stripe",
  "import",
  "manual",
])

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
  const args = {
    file: null,
    execute: false,
    createCampaigns: false,
    campaign: null,
    limit: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--execute") args.execute = true
    else if (arg === "--create-campaigns") args.createCampaigns = true
    else if (arg === "--file") args.file = argv[++index]
    else if (arg === "--campaign") args.campaign = argv[++index]
    else if (arg === "--limit") args.limit = Number(argv[++index])
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
  return normalizeText(value).toLowerCase()
}

function normalizePhone(value) {
  return normalizeText(value).replace(/\D/g, "")
}

function parseMoney(value) {
  const cleaned = normalizeText(value).replace(/[$,]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function parsePaymentDate(value) {
  const text = normalizeText(value)
  if (!text) return null

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const month = slash[1].padStart(2, "0")
    const day = slash[2].padStart(2, "0")
    return `${slash[3]}-${month}-${day}`
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function normalizePaymentSource(displayName, columnKind) {
  if (columnKind === "cash") return "cash"
  if (columnKind === "checks") return "check"

  const raw = normalizeText(displayName)
  if (!raw) return columnKind === "recurring" ? "stripe" : "manual"

  const lower = raw.toLowerCase()
  if (PAYMENT_SOURCE_CHANNELS.has(lower)) return lower
  if (lower.includes("credit card")) return "stripe"
  if (lower.includes("ach") || lower.includes("wire")) return "manual"
  if (lower.includes("check")) return "check"
  if (lower.includes("zelle")) return "zelle"
  if (lower.includes("stripe")) return "stripe"
  if (lower.includes("paypal")) return "paypal"
  if (lower.includes("venmo")) return "venmo"
  if (lower.includes("cash")) return "cash"
  return "manual"
}

function detectContactType(row) {
  const name = normalizeText(row.Name)
  const primary = normalizeText(row["Primary Contact"])
  const primaryName = primary.split(/[?,]/)[0].trim()

  if (
    primaryName &&
    normalizeNameForMatch(primaryName) !== normalizeNameForMatch(name.split("/")[0])
  ) {
    return "organization"
  }

  if (
    /\b(inc|llc|corp|ltd|market|cafe|academy|msaada|dynamics|solar|labs)\b/i.test(name)
  ) {
    return "organization"
  }

  return "individual"
}

function buildRowKey(rowIndex, row) {
  const campaign = normalizeText(row.Campaign)
  const name = normalizeNameForMatch(row.Name)
  const phone = normalizePhone(row.phone)
  const payload = [
    rowIndex,
    campaign,
    name,
    phone,
    parseMoney(row.Pledge).toFixed(2),
    parseMoney(row.Cash).toFixed(2),
    parseMoney(row.Checks).toFixed(2),
    parseMoney(row["One-time"]).toFixed(2),
    parseMoney(row.Recurring).toFixed(2),
  ].join("|")

  const hash = createHash("sha1").update(payload).digest("hex").slice(0, 12)
  return `${IMPORT_TAG}|${hash}`
}

function buildNotes(row) {
  const parts = [
    normalizeText(row.Group),
    normalizeText(row.Notes),
    normalizeText(row["Primary Contact"])
      ? `Primary contact: ${normalizeText(row["Primary Contact"])}`
      : "",
  ].filter(Boolean)

  return parts.join(" | ")
}

function scoreNameMatch(a, b) {
  const left = normalizeNameForMatch(a)
  const right = normalizeNameForMatch(b)
  if (!left || !right) return 0
  if (left === right) return 100

  const leftParts = left.split(" ").filter(Boolean)
  const rightParts = right.split(" ").filter(Boolean)
  const shared = leftParts.filter((part) => rightParts.includes(part))
  if (shared.length === 0) return 0

  if (shared.length >= 2) {
    if (shared.length === leftParts.length || shared.length === rightParts.length) return 85
    return 72
  }

  return 0
}

loadEnvLocal()

const args = parseArgs(process.argv.slice(2))

if (!args.file) {
  console.error("Usage: node scripts/import-mas-campaign-ledger.mjs --file <path> [--campaign <name>] [--execute] [--create-campaigns]")
  process.exit(1)
}

if (!existsSync(args.file)) {
  console.error(`File not found: ${args.file}`)
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

function buildContactIndexes(contacts) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byName = new Map()

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = normalizeNameForMatch(contact.full_name)

    if (email) byEmail.set(email, contact)
    if (phone) byPhone.set(phone, contact)
    if (nameKey) {
      const list = byName.get(nameKey) || []
      list.push(contact)
      byName.set(nameKey, list)
    }
  }

  return { byEmail, byPhone, byName }
}

function findContactMatch(row, indexes) {
  const email = normalizeEmail(row.Email)
  const phone = normalizePhone(row.phone)
  const nameKey = normalizeNameForMatch(row.Name)

  if (email && indexes.byEmail.has(email)) {
    return { contact: indexes.byEmail.get(email), reason: "email" }
  }

  if (phone && indexes.byPhone.has(phone)) {
    return { contact: indexes.byPhone.get(phone), reason: "phone" }
  }

  const exactNameMatches = indexes.byName.get(nameKey) || []
  if (exactNameMatches.length === 1) {
    return { contact: exactNameMatches[0], reason: "exact_name" }
  }

  if (phone && exactNameMatches.length > 1) {
    const phoneMatch = exactNameMatches.find((contact) => normalizePhone(contact.phone) === phone)
    if (phoneMatch) return { contact: phoneMatch, reason: "name+phone" }
  }

  let best = null
  let bestScore = 0
  for (const candidates of indexes.byName.values()) {
    for (const contact of candidates) {
      const score = scoreNameMatch(row.Name, contact.full_name)
      if (score > bestScore) {
        bestScore = score
        best = contact
      }
    }
  }

  if (best && bestScore >= 85) {
    return { contact: best, reason: `fuzzy_name:${bestScore}` }
  }

  return null
}

async function main() {
  const csvText = readFileSync(args.file, "utf8")
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    console.error("CSV parse errors:", parsed.errors.slice(0, 5))
    process.exit(1)
  }

  let rows = parsed.data
  if (args.campaign) {
    rows = rows.filter((row) => normalizeText(row.Campaign) === args.campaign)
  }
  if (args.limit) {
    rows = rows.slice(0, args.limit)
  }

  const report = {
    mode: args.execute ? "execute" : "dry-run",
    file: args.file,
    campaignFilter: args.campaign,
    rowCount: rows.length,
    skippedEmpty: 0,
    skippedDuplicate: 0,
    contactsMatched: 0,
    contactsCreated: 0,
    donorsCreated: 0,
    campaignsCreated: 0,
    pledgesCreated: 0,
    paymentsCreated: 0,
    ambiguousMatches: [],
    errors: [],
    samples: [],
  }

  const orgIds = [...new Set(rows.map((row) => normalizeText(row.organization_id) || DEFAULT_ORG_ID))]
  if (orgIds.length !== 1) {
    console.error("Expected a single organization_id in file:", orgIds)
    process.exit(1)
  }

  const orgId = orgIds[0]
  const contacts = await fetchAll("contacts", [{ op: "eq", col: "organization_id", val: orgId }])
  const donors = await fetchAll("donors", [{ op: "eq", col: "organization_id", val: orgId }])
  const campaigns = await fetchAll("campaigns", [{ op: "eq", col: "organization_id", val: orgId }])

  const contactIndexes = buildContactIndexes(contacts)
  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )
  const campaignByName = new Map(
    campaigns.map((campaign) => [normalizeName(campaign.name), campaign])
  )

  const { data: existingTaggedPledges } = await sb
    .from("pledges")
    .select("id, notes")
    .eq("organization_id", orgId)
    .like("notes", `${IMPORT_TAG}|%`)

  const importedRowKeys = new Set(
    (existingTaggedPledges || [])
      .map((pledge) => {
        const match = String(pledge.notes || "").match(new RegExp(`${IMPORT_TAG}\\|[a-f0-9]{12}`))
        return match?.[0] || null
      })
      .filter(Boolean)
  )

  const pendingContacts = new Map()

  function rememberContact(contact) {
    contacts.push(contact)
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = normalizeNameForMatch(contact.full_name)
    if (email) contactIndexes.byEmail.set(email, contact)
    if (phone) contactIndexes.byPhone.set(phone, contact)
    if (nameKey) contactIndexes.byName.set(nameKey, [contact])
  }

  async function resolveCampaign(campaignName) {
    const key = normalizeName(campaignName)
    if (campaignByName.has(key)) return campaignByName.get(key)

    if (!args.createCampaigns) {
      throw new Error(`Campaign not found: ${campaignName} (use --create-campaigns)`)
    }

    if (!args.execute) {
      report.campaignsCreated += 1
      const placeholder = { id: `dry-run:${campaignName}`, name: campaignName }
      campaignByName.set(key, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("campaigns")
      .insert({
        organization_id: orgId,
        name: campaignName,
        status: "active",
      })
      .select("id, name")
      .single()

    if (error) throw new Error(`campaign insert (${campaignName}): ${error.message}`)
    campaignByName.set(key, data)
    report.campaignsCreated += 1
    return data
  }

  async function ensureDonor(contact) {
    if (donorByContactId.has(contact.id)) return donorByContactId.get(contact.id)

    if (!args.execute) {
      report.donorsCreated += 1
      const placeholder = { id: `dry-run:donor:${contact.id}`, contact_id: contact.id }
      donorByContactId.set(contact.id, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("donors")
      .insert({
        organization_id: orgId,
        contact_id: contact.id,
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
        donor_type: contact.contact_type === "organization" ? "organization" : "individual",
        status: "active",
      })
      .select("id, contact_id")
      .single()

    if (error) throw new Error(`donor insert (${contact.full_name}): ${error.message}`)
    donorByContactId.set(contact.id, data)
    report.donorsCreated += 1
    return data
  }

  async function ensureContact(row) {
    const displayName = normalizeText(row.Name)
    const pendingKey = [
      normalizeNameForMatch(displayName),
      normalizePhone(row.phone),
      normalizeEmail(row.Email),
    ].join("|")

    if (pendingContacts.has(pendingKey)) {
      return pendingContacts.get(pendingKey)
    }

    const match = findContactMatch(row, contactIndexes)
    if (match) {
      report.contactsMatched += 1
      if (match.reason.startsWith("fuzzy_name")) {
        report.ambiguousMatches.push({
          csvName: displayName,
          matchedName: match.contact.full_name,
          reason: match.reason,
        })
      }
      pendingContacts.set(pendingKey, match.contact)
      return match.contact
    }

    const contactType = detectContactType(row)
    const payload = {
      organization_id: orgId,
      full_name: displayName,
      email: normalizeEmail(row.Email) || null,
      phone: normalizeText(row.phone) || null,
      contact_type: contactType,
      status: "active",
    }

    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = { id: `dry-run:contact:${pendingKey}`, ...payload }
      rememberContact(placeholder)
      pendingContacts.set(pendingKey, placeholder)
      return placeholder
    }

    const { data, error } = await sb.from("contacts").insert(payload).select("*").single()
    if (error) throw new Error(`contact insert (${displayName}): ${error.message}`)
    rememberContact(data)
    pendingContacts.set(pendingKey, data)
    report.contactsCreated += 1
    return data
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowKey = buildRowKey(index + 2, row)
    const campaignName = normalizeText(row.Campaign)
    const pledgeAmount = parseMoney(row.Pledge)
    const cashAmount = parseMoney(row.Cash)
    const checksAmount = parseMoney(row.Checks)
    const oneTimeAmount = parseMoney(row["One-time"])
    const recurringAmount = parseMoney(row.Recurring)
    const totalPaid = cashAmount + checksAmount + oneTimeAmount + recurringAmount
    const paymentDate = parsePaymentDate(row.payment_date) || "2023-12-31"

    if (!campaignName || !normalizeText(row.Name)) {
      report.skippedEmpty += 1
      continue
    }

    if (pledgeAmount <= 0 && totalPaid <= 0) {
      report.skippedEmpty += 1
      continue
    }

    if (importedRowKeys.has(rowKey)) {
      report.skippedDuplicate += 1
      continue
    }

    try {
      const campaign = await resolveCampaign(campaignName)
      const contact = await ensureContact(row)
      const donor = await ensureDonor(contact)
      const notes = buildNotes(row)
      const displayName = normalizeText(row.Name)

      let pledgeId = null
      if (pledgeAmount > 0) {
        const pledgeNotes = [rowKey, notes].filter(Boolean).join(" | ")

        if (args.execute) {
          const { data: pledge, error } = await sb
            .from("pledges")
            .insert({
              organization_id: orgId,
              donor_id: donor.id,
              campaign_id: campaign.id,
              amount_pledged: pledgeAmount,
              pledge_date: paymentDate,
              pledge_type: "one_time",
              frequency: "one_time",
              status: "open",
              notes: pledgeNotes,
            })
            .select("id")
            .single()

          if (error) throw new Error(error.message)
          pledgeId = pledge.id
        }

        report.pledgesCreated += 1
      }

      const paymentSpecs = []
      if (cashAmount > 0) {
        paymentSpecs.push({ kind: "cash", amount: cashAmount, source: "cash" })
      }
      if (checksAmount > 0) {
        paymentSpecs.push({
          kind: "checks",
          amount: checksAmount,
          source: normalizePaymentSource(row.Source, "checks"),
        })
      }
      if (oneTimeAmount > 0) {
        paymentSpecs.push({
          kind: "one-time",
          amount: oneTimeAmount,
          source: normalizePaymentSource(row.Source, "one-time"),
        })
      }
      if (recurringAmount > 0) {
        paymentSpecs.push({
          kind: "recurring",
          amount: recurringAmount,
          source: normalizePaymentSource(row.Source, "recurring"),
        })
      }

      for (const spec of paymentSpecs) {
        const memo = `${rowKey}|${spec.kind}|${campaignName}`
        const status = pledgeId ? "allocated" : "unallocated"

        if (args.execute) {
          const { error } = await sb.from("payments").insert({
            organization_id: orgId,
            donor_id: donor.id,
            contact_id: contact.id,
            pledge_id: pledgeId,
            campaign_id: campaign.id,
            sender_name: displayName,
            amount: spec.amount,
            payment_date: `${paymentDate}T12:00:00`,
            source: spec.source,
            source_type: "import",
            status,
            memo,
            is_verified: false,
          })

          if (error) throw new Error(error.message)
        }

        report.paymentsCreated += 1
      }

      if (report.samples.length < 8) {
        report.samples.push({
          rowKey,
          name: displayName,
          campaign: campaignName,
          pledge: pledgeAmount,
          payments: paymentSpecs.map((spec) => spec.amount),
        })
      }
    } catch (error) {
      report.errors.push({
        row: index + 2,
        name: normalizeText(row.Name),
        campaign: campaignName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const suffix = args.campaign ? args.campaign.replace(/\s+/g, "-").toLowerCase() : "all"
  const reportPath = resolve(reportsDir, `mas-campaign-ledger-import-${suffix}-${stamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)

  if (!args.execute) {
    console.log("\nDry run only. Re-run with --execute to import.")
    if (!args.createCampaigns) {
      console.log("If campaigns are missing, add --create-campaigns on execute.")
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
