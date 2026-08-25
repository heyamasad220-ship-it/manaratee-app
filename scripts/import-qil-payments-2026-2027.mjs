/**
 * Import QIL 2026–2027 Stripe/member-portal payments (QIPayments.csv).
 *
 * - Paid students become enrollments (Registrations tab)
 * - Refunded payments are stored for reporting (cancelled enrollments)
 * - CSV member/customer spelling is canonical (contacts + application names)
 *
 * Usage:
 *   node scripts/import-qil-payments-2026-2027.mjs
 *   node scripts/import-qil-payments-2026-2027.mjs --csv "C:/Users/danan/Downloads/QIPayments.csv"
 *   node scripts/import-qil-payments-2026-2027.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 * Run scripts/277_program_charge_schedule_refunded_status.sql before --execute (refunded schedule rows).
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2026_27_PAYMENTS_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/QIPayments.csv"
const PROGRAM_ID = "78616758-d6fc-4a48-a99c-f8ea24a34646"
const DEPARTMENT_ID = "c5d6b286-0d48-431f-9b55-94a80d4821ef"
const PROGRAM_NAME = "Quran Institute for Ladies 2026-2027"
const AUTO_MATCH_MIN = 82
const DEFAULT_PAID_TUITION = 450

/** CSV / remarks name → existing CRM name (then we rename the contact to CSV spelling). */
const MEMBER_ALIASES = {
  "nada saleh": "Nada Hasan",
  "fatema odeh": "Fatima Odeh",
  "heba hassan": "Hebatallah Hassan",
  "malak ahmed hmimy": "Malak Hamimi",
  "wafa yerrou": "Wafaa Yarro",
  "ola alkhousi": "Viola Mohamed Alkhousi",
  "ghadeer zarkani": "Ghadeer Zakani",
  "ghadeer iphone zarkani": "Ghadeer Zakani",
  "sarfraz amin": "Amin Sarfraz",
  "iman elghandour": "IMAN IBRAHIM ELGHANDOUR",
  "asmaa ali": "Asmaa Ali Ismail Mohamed",
  "soumia b bouhlal": "Soumia Bouhlal",
  "birlanti abdalhamid alsawfta": "Birlanti Alsawfta",
  "reda hussain elkomy": "Reda Elkomy",
  "marwa taissir elgamal": "Marwa Elgamal",
  "nooreleine abushaaban": "Noor Abushaaban",
  "narmeen alfahal": "Narmeen gamal Alfahal",
  "safa s siddiqui": "Safa siddiqui",
  "imene latreche": "Imene Latrehe",
  "abeer zoubi": "ABEER ZOUBI",
  "raddwa sayed abdalla": "Raddwa Abdalla",
  "anhar ahmed": "Anhar Ahmed",
  "israa alaomairi": "Israa Alaomairi",
}

const TAJWEED_RECITATION_PRIORITY = [
  "recitation improvement",
  "tajweed level 1",
  "tajweed beginner",
  "tajweed osool",
  "tajweed advanced",
  "tajweed level 2",
  "al nouraniyyeh",
  "preparing for ijaza",
]

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
    csv: DEFAULT_CSV,
    execute: false,
    orgId: DEFAULT_ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--csv") args.csv = argv[++i]
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function foldName(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function canonicalizeMemberName(value) {
  return normalizeText(value)
    .replace(/\biphone\b/gi, " ")
    .replace(/\bipad\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function parseMoney(value) {
  if (value == null || value === "") return 0
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? round2(n) : 0
}

function parseTxnDate(value) {
  const text = normalizeText(value).replace(
    /\s+(CDT|CST|EDT|EST|PDT|PST|MDT|MST)$/i,
    ""
  )
  if (!text) return { date: null, iso: null }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return { date: null, iso: null }
  return {
    date: parsed.toISOString().slice(0, 10),
    iso: parsed.toISOString(),
  }
}

function extractField(remarks, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Subscription Fees|Subscription Discount|Add-Ons Amount|Coupon Code|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
    "i"
  )
  const match = re.exec(remarks || "")
  return match ? normalizeText(match[1]) : ""
}

function parseRemarks(remarks) {
  const text = normalizeText(remarks)
  const membersRaw = extractField(text, "Registered Members")
  const members = membersRaw
    ? membersRaw
        .split(",")
        .map((item) => canonicalizeMemberName(item))
        .filter(Boolean)
    : []
  return {
    members,
    subscriptionFees: parseMoney(extractField(text, "Subscription Fees")),
    subscriptionDiscount: parseMoney(extractField(text, "Subscription Discount")),
    couponCode: normalizeText(extractField(text, "Coupon Code")).toUpperCase(),
    couponValue: parseMoney(extractField(text, "Subscription Coupon Value")),
    isFullPayment: /yes/i.test(extractField(text, "Is Full Payment Made")),
  }
}

function classifyCoupon(code) {
  const coupon = normalizeText(code).toUpperCase()
  if (!coupon) return { type: "none", code: "" }
  if (/^FA\b|^FA[-_]/i.test(coupon)) return { type: "financial_assistance", code: coupon }
  if (/^STAFF/i.test(coupon)) return { type: "staff_credit", code: coupon }
  return { type: "other_discount", code: coupon }
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const rows = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i
    for (let j = 1; j <= b.length; j += 1) {
      const cur = rows[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[j] = Math.min(rows[j] + 1, prev + 1, rows[j - 1] + cost)
      prev = cur
    }
    rows[0] = i
  }
  return rows[b.length]
}

function tokenSimilar(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) {
    return 0.92
  }
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - levenshtein(a, b) / max
}

function scoreNames(leftName, rightName) {
  const left = foldName(leftName).replace(/\s*\([^)]*\)\s*/g, " ").trim()
  const right = foldName(rightName).replace(/\s*\([^)]*\)\s*/g, " ").trim()
  if (!left || !right) return 0
  if (left === right) return 100
  const leftTokens = left.split(" ").filter(Boolean)
  const rightTokens = right.split(" ").filter(Boolean)
  if (!leftTokens.length || !rightTokens.length) return 0
  const first = tokenSimilar(leftTokens[0], rightTokens[0])
  if (first < 0.7) return 0
  const lastLeft = leftTokens[leftTokens.length - 1]
  const lastRightBest = Math.max(
    ...rightTokens.map((token) => tokenSimilar(lastLeft, token))
  )
  if (lastRightBest < 0.55) return 0
  return Math.round(45 * first + 55 * lastRightBest)
}

function reasonFamily(reason) {
  const folded = foldName(reason)
  if (folded.includes("baqara") || folded.includes("omran") || folded.includes("aal imran")) {
    return "memoriz_baqara_omran"
  }
  if (folded.includes("course 1") || folded.includes("course 2")) {
    return "memoriz_course"
  }
  return "tajweed_recitation"
}

function offeringMatchesFamily(offeringName, family) {
  const name = foldName(offeringName)
  if (!name) return false
  if (name.includes("ajurrum")) return false
  if (family === "memoriz_baqara_omran") {
    return name.includes("baqara") || name.includes("omran")
  }
  if (family === "memoriz_course") {
    return (
      name.includes("memorization 1") ||
      name.includes("yusif") ||
      name.includes("annahl") ||
      name === "memorization 2"
    )
  }
  return (
    name.includes("tajweed") ||
    name.includes("recitation") ||
    name.includes("nouraniyyeh") ||
    name.includes("ijaza")
  )
}

function offeringPriority(offeringName) {
  const name = foldName(offeringName)
  const index = TAJWEED_RECITATION_PRIORITY.findIndex((item) => name.includes(item))
  return index === -1 ? 99 : index
}

function splitMoneyAcross(total, count) {
  if (count <= 0) return []
  const cents = Math.round(round2(total) * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  return Array.from({ length: count }, (_, index) =>
    round2((base + (index < remainder ? 1 : 0)) / 100)
  )
}

function loadPayments(csvPath) {
  if (!existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`)
  const text = readFileSync(csvPath, "utf8")
  const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (errors?.length) console.warn(`CSV parse warnings: ${errors.length}`)

  return data.map((row, index) => {
    const remarks = parseRemarks(row["Payment Remarks"])
    const amount = parseMoney(row.Amount)
    const status = normalizeText(row.Status).toLowerCase()
    const txn = parseTxnDate(row["Transaction Date"])
    const customerName = canonicalizeMemberName(row["Customer Name"])
    const members = remarks.members.length ? remarks.members : customerName ? [customerName] : []
    return {
      rowNumber: index + 2,
      customerName,
      email: normalizeEmail(row["Customer Email"]),
      phone: normalizeText(row["Customer Phone"]),
      amount,
      status,
      recurringType: normalizeText(row["Recurring Type"]).toUpperCase(),
      reason: normalizeText(row["Payment / Donation Secondary Reason"]),
      family: reasonFamily(row["Payment / Donation Secondary Reason"]),
      transactionId: normalizeText(row["Transaction ID"]),
      refundReason: normalizeText(row["Refund Reason"]),
      paymentMode: normalizeText(row["Payment Mode"]),
      date: txn.date,
      iso: txn.iso,
      members,
      ...remarks,
      couponClass: classifyCoupon(remarks.couponCode),
    }
  })
}

function pickOffering(apps, family, listPriceHint) {
  const matches = apps.filter((app) => offeringMatchesFamily(app.offeringName, family))
  if (!matches.length) return { chosen: null, alternatives: [] }
  if (matches.length === 1) return { chosen: matches[0], alternatives: [] }

  const byPrice = listPriceHint
    ? matches.filter((app) => Math.abs((app.tuition || 0) - listPriceHint) < 0.5)
    : matches
  const pool = byPrice.length ? byPrice : matches
  const sorted = [...pool].sort(
    (a, b) => offeringPriority(a.offeringName) - offeringPriority(b.offeringName)
  )
  return {
    chosen: sorted[0],
    alternatives: sorted.slice(1).concat(matches.filter((app) => app !== sorted[0])),
  }
}

function computeAssisted(row, memberCount, listPrice) {
  const shareFee = memberCount > 0 ? round2(row.subscriptionFees / memberCount) : row.subscriptionFees
  const shareDiscount =
    memberCount > 0 ? round2(row.subscriptionDiscount / memberCount) : row.subscriptionDiscount
  const shareCoupon = memberCount > 0 ? round2(row.couponValue / memberCount) : row.couponValue
  const monthly = row.recurringType === "MONTHLY"

  if (row.couponClass.type === "financial_assistance") {
    return { originalFee: listPrice || shareFee || DEFAULT_PAID_TUITION, assistedFee: 0 }
  }

  if (monthly) {
    const originalFee = listPrice || DEFAULT_PAID_TUITION
    if (row.couponClass.type === "staff_credit") {
      return { originalFee, assistedFee: round2(originalFee * 0.5) }
    }
    return { originalFee, assistedFee: originalFee }
  }

  const originalFee = listPrice || shareFee || DEFAULT_PAID_TUITION
  const assistedFee = Math.max(0, round2(originalFee - shareDiscount - shareCoupon))
  return { originalFee, assistedFee }
}

function bestContactMatch(name, contacts, minScore = AUTO_MATCH_MIN) {
  let best = null
  for (const contact of contacts) {
    const score = scoreNames(name, contact.full_name)
    if (score < minScore) continue
    if (!best || score > best.score) best = { contact, score }
  }
  return best
}

function buildPlan(paymentRows, ctx) {
  const { applications, contactsByEmail, contacts, offeringsById } = ctx
  const appsByContact = new Map()
  for (const app of applications) {
    if (!app.participant_contact_id) continue
    const list = appsByContact.get(app.participant_contact_id) || []
    list.push(app)
    appsByContact.set(app.participant_contact_id, list)
  }

  const groups = new Map()
  const unmatchedMembers = []
  const unmatchedOfferings = []
  const nameFixes = []
  const payerCreates = []
  const ambiguous = []

  function resolveContact(name, email) {
    const canonical = canonicalizeMemberName(name)
    const folded = foldName(canonical)
    const alias = MEMBER_ALIASES[folded]
    const searchNames = [...new Set([canonical, alias].filter(Boolean))]
    const applicants = contacts.filter((contact) => appsByContact.has(contact.id))

    const searchPool = (pool, viaPrefix) => {
      for (const searchName of searchNames) {
        const exact = pool.find((contact) => foldName(contact.full_name) === foldName(searchName))
        if (exact) {
          return { contact: exact, via: `${viaPrefix}:exact`, canonical, alias }
        }
      }
      for (const searchName of searchNames) {
        const fuzzy = bestContactMatch(searchName, pool)
        if (fuzzy) {
          return {
            contact: fuzzy.contact,
            via: `${viaPrefix}:fuzzy:${fuzzy.score}`,
            canonical,
            alias,
          }
        }
      }
      return null
    }

    const applicantHit = searchPool(applicants, "applicant")
    if (applicantHit) return applicantHit

    if (email && contactsByEmail.has(email)) {
      const byEmail = contactsByEmail.get(email)
      if (appsByContact.has(byEmail.id) || !applicants.length) {
        return { contact: byEmail, via: "email", canonical, alias }
      }
    }

    const anyHit = searchPool(contacts, "contact")
    if (anyHit) return anyHit

    if (email && contactsByEmail.has(email)) {
      return { contact: contactsByEmail.get(email), via: "email", canonical, alias }
    }
    return { contact: null, via: null, canonical, alias }
  }

  for (const row of paymentRows) {
    if (row.status !== "succeeded" && row.status !== "refunded") continue
    const memberCount = Math.max(row.members.length, 1)
    const amountShares = splitMoneyAcross(Math.abs(row.amount), memberCount)
    const feeShares = splitMoneyAcross(row.subscriptionFees, memberCount)

    let payerHit = resolveContact(row.customerName, row.email)
    if (!payerHit.contact && row.email) {
      payerCreates.push({
        name: row.customerName,
        email: row.email,
        phone: row.phone,
      })
    } else if (
      payerHit.contact &&
      payerHit.contact.full_name !== canonicalizeMemberName(row.customerName)
    ) {
      nameFixes.push({
        contactId: payerHit.contact.id,
        from: payerHit.contact.full_name,
        to: canonicalizeMemberName(row.customerName),
        via: payerHit.via || "payer",
      })
    }

    row.members.forEach((memberName, index) => {
      const memberEmail =
        foldName(memberName) === foldName(row.customerName) ? row.email : null
      const hit = resolveContact(memberName, memberEmail)
      if (!hit.contact) {
        unmatchedMembers.push({
          rowNumber: row.rowNumber,
          memberName,
          customerName: row.customerName,
          email: row.email,
          amount: row.amount,
          reason: row.reason,
        })
        return
      }

      if (hit.contact.full_name !== hit.canonical) {
        nameFixes.push({
          contactId: hit.contact.id,
          from: hit.contact.full_name,
          to: hit.canonical,
          via: hit.via,
        })
      }

      const apps = appsByContact.get(hit.contact.id) || []
      const listHint = feeShares[index] >= 200 ? feeShares[index] : null
      const picked = pickOffering(apps, row.family, listHint)
      if (!picked.chosen) {
        unmatchedOfferings.push({
          rowNumber: row.rowNumber,
          memberName: hit.canonical,
          matchedContact: hit.contact.full_name,
          reason: row.reason,
          apps: apps.map((app) => app.offeringName),
        })
        return
      }
      if (picked.alternatives.length) {
        ambiguous.push({
          memberName: hit.canonical,
          chosen: picked.chosen.offeringName,
          alternatives: [...new Set(picked.alternatives.map((app) => app.offeringName))],
          reason: row.reason,
        })
      }

      const offering = offeringsById.get(picked.chosen.offering_id || picked.chosen.approved_offering_id)
      const tuition = offering?.tuition ?? picked.chosen.tuition ?? DEFAULT_PAID_TUITION
      const fees = computeAssisted(row, memberCount, tuition)
      const key = `${hit.contact.id}::${picked.chosen.offeringId}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          student: hit.contact,
          canonicalName: hit.canonical,
          payer: payerHit.contact || hit.contact,
          payerCanonical: canonicalizeMemberName(row.customerName),
          payerEmail: row.email,
          payerPhone: row.phone,
          application: picked.chosen,
          offeringId: picked.chosen.offeringId,
          offeringName: picked.chosen.offeringName,
          originalFee: fees.originalFee,
          assistedFee: fees.assistedFee,
          couponCode: row.couponCode,
          couponClass: row.couponClass,
          payments: [],
          refunds: [],
          netPaid: 0,
          grossPaid: 0,
          refunded: 0,
        })
      }
      const group = groups.get(key)
      if (hit.canonical) group.canonicalName = hit.canonical
      if (row.couponCode && !group.couponCode) {
        group.couponCode = row.couponCode
        group.couponClass = row.couponClass
      }
      if (fees.originalFee > group.originalFee) group.originalFee = fees.originalFee
      if (row.isFullPayment || row.couponClass.type !== "none") {
        group.assistedFee = fees.assistedFee
      } else if (group.assistedFee == null) {
        group.assistedFee = fees.assistedFee
      }
      const share = amountShares[index] || 0
      const part = {
        rowNumber: row.rowNumber,
        amount: share,
        date: row.date,
        iso: row.iso,
        transactionId: row.transactionId,
        recurringType: row.recurringType,
        status: row.status,
        refundReason: row.refundReason,
      }
      if (row.status === "refunded") {
        group.refunds.push(part)
        group.refunded = round2(group.refunded + share)
      } else {
        group.payments.push(part)
        group.grossPaid = round2(group.grossPaid + share)
      }
      group.netPaid = round2(group.grossPaid - group.refunded)
    })
  }

  const enrollments = []
  for (const group of groups.values()) {
    const fullyRefunded = group.refunded > 0.009 && group.netPaid <= 0.009
    const assistedFee = fullyRefunded ? 0 : group.assistedFee
    const amountPaid = fullyRefunded ? 0 : Math.max(group.netPaid, 0)
    enrollments.push({
      ...group,
      cancelled: fullyRefunded,
      assistedFee,
      amountPaid,
      remaining: round2(Math.max((assistedFee || 0) - amountPaid, 0)),
      paymentStatus:
        amountPaid <= 0.009 && (assistedFee || 0) > 0.009
          ? "pending"
          : (assistedFee || 0) - amountPaid <= 0.009
            ? "paid"
            : "partial",
    })
  }

  const uniqueNameFixes = []
  const seenFix = new Set()
  for (const fix of nameFixes) {
    const key = `${fix.contactId}::${foldName(fix.to)}`
    if (seenFix.has(key)) continue
    seenFix.add(key)
    uniqueNameFixes.push(fix)
  }
  const uniqueAmbiguous = []
  const seenAmb = new Set()
  for (const item of ambiguous) {
    const key = `${foldName(item.memberName)}::${item.chosen}`
    if (seenAmb.has(key)) continue
    seenAmb.add(key)
    uniqueAmbiguous.push(item)
  }
  const uniquePayers = []
  const seenPayer = new Set()
  for (const payer of payerCreates) {
    const key = payer.email || foldName(payer.name)
    if (seenPayer.has(key)) continue
    seenPayer.add(key)
    uniquePayers.push(payer)
  }

  return {
    enrollments,
    unmatchedMembers,
    unmatchedOfferings,
    nameFixes: uniqueNameFixes,
    ambiguous: uniqueAmbiguous,
    payerCreates: uniquePayers,
    totals: {
      csvRows: paymentRows.length,
      succeeded: paymentRows.filter((r) => r.status === "succeeded").length,
      refunded: paymentRows.filter((r) => r.status === "refunded").length,
      enrollments: enrollments.length,
      cancelled: enrollments.filter((e) => e.cancelled).length,
      active: enrollments.filter((e) => !e.cancelled).length,
      netCollected: round2(enrollments.reduce((sum, e) => sum + e.amountPaid, 0)),
      csvNet: round2(paymentRows.reduce((sum, r) => sum + r.amount, 0)),
    },
  }
}

async function fetchAll(sb, table, select, apply) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = sb.from(table).select(select).range(from, from + pageSize - 1)
    if (apply) query = apply(query)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function loadContext(sb, orgId) {
  const offerings = await fetchAll(
    sb,
    "program_offerings",
    "id, name, delivery_format, program_id",
    (q) => q.eq("organization_id", orgId).eq("program_id", PROGRAM_ID)
  )
  const feePlans = await fetchAll(
    sb,
    "program_offering_fee_plans",
    "id, offering_id, name, plan_type, is_default",
    (q) => q.eq("organization_id", orgId).in(
      "offering_id",
      offerings.map((o) => o.id)
    )
  )
  const components = feePlans.length
    ? await fetchAll(
        sb,
        "program_offering_fee_plan_components",
        "fee_plan_id, amount, component_type",
        (q) => q.in(
          "fee_plan_id",
          feePlans.map((p) => p.id)
        )
      )
    : []
  const tuitionByPlan = new Map()
  for (const component of components) {
    if (String(component.component_type || "") === "tuition") {
      tuitionByPlan.set(component.fee_plan_id, Number(component.amount || 0))
    }
  }
  const tuitionByOffering = new Map()
  for (const plan of feePlans) {
    const amount = tuitionByPlan.get(plan.id)
    if (amount == null) continue
    if (plan.is_default || !tuitionByOffering.has(plan.offering_id)) {
      tuitionByOffering.set(plan.offering_id, amount)
    }
  }

  const offeringsById = new Map()
  for (const offering of offerings) {
    const name = foldName(offering.name)
    let tuition = tuitionByOffering.get(offering.id)
    if (tuition == null) {
      tuition = name.includes("ajurrum") ? 0 : DEFAULT_PAID_TUITION
    }
    offeringsById.set(offering.id, { ...offering, tuition })
  }

  const applicationsRaw = await fetchAll(
    sb,
    "program_applications",
    "id, status, enrollment_id, participant_contact_id, participant_name, offering_id, approved_offering_id, registrant_contact_id",
    (q) => q.eq("organization_id", orgId).eq("program_id", PROGRAM_ID)
  )
  const contactIds = [
    ...new Set(
      applicationsRaw
        .flatMap((app) => [app.participant_contact_id, app.registrant_contact_id])
        .filter(Boolean)
    ),
  ]
  const contacts = contactIds.length
    ? await fetchAll(sb, "contacts", "id, full_name, email, phone", (q) =>
        q.eq("organization_id", orgId).in("id", contactIds)
      )
    : []
  const extraEmails = []
  const applications = applicationsRaw.map((app) => {
    const offeringId = app.approved_offering_id || app.offering_id
    const offering = offeringsById.get(offeringId)
    return {
      ...app,
      offeringId,
      offeringName: offering?.name || "",
      tuition: offering?.tuition ?? DEFAULT_PAID_TUITION,
    }
  })

  return {
    offerings,
    offeringsById,
    applications,
    contacts,
    contactsByEmail: new Map(
      contacts
        .filter((c) => c.email)
        .map((c) => [normalizeEmail(c.email), c])
    ),
    extraEmails,
  }
}

async function ensurePayerAndExtraContacts(sb, orgId, paymentRows, ctx, execute) {
  const emails = [...new Set(paymentRows.map((row) => row.email).filter(Boolean))]
  if (emails.length) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .in("email", emails)
    if (error) throw new Error(`contacts by email: ${error.message}`)
    for (const contact of data || []) {
      if (!ctx.contacts.some((c) => c.id === contact.id)) ctx.contacts.push(contact)
      if (contact.email) ctx.contactsByEmail.set(normalizeEmail(contact.email), contact)
    }
  }

  const neededNames = new Set()
  for (const row of paymentRows) {
    neededNames.add(foldName(row.customerName))
    for (const member of row.members) neededNames.add(foldName(member))
    const alias = MEMBER_ALIASES[foldName(row.customerName)]
    if (alias) neededNames.add(foldName(alias))
    for (const member of row.members) {
      const memberAlias = MEMBER_ALIASES[foldName(member)]
      if (memberAlias) neededNames.add(foldName(memberAlias))
    }
  }
  const missing = [...neededNames].filter(
    (folded) => !ctx.contacts.some((c) => foldName(c.full_name) === folded)
  )
  if (missing.length) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
    if (error) throw new Error(`contacts scan: ${error.message}`)
    for (const contact of data || []) {
      if (ctx.contacts.some((c) => c.id === contact.id)) continue
      const folded = foldName(contact.full_name)
      if (
        neededNames.has(folded) ||
        Object.values(MEMBER_ALIASES).some((alias) => foldName(alias) === folded)
      ) {
        ctx.contacts.push(contact)
        if (contact.email) ctx.contactsByEmail.set(normalizeEmail(contact.email), contact)
      } else {
        const fuzzy = bestContactMatch(contact.full_name, [{ full_name: [...neededNames][0] }], 101)
        void fuzzy
      }
    }
    for (const contact of data || []) {
      if (ctx.contacts.some((c) => c.id === contact.id)) continue
      const hit = [...neededNames].some((name) => scoreNames(name, contact.full_name) >= AUTO_MATCH_MIN)
      if (hit) {
        ctx.contacts.push(contact)
        if (contact.email) ctx.contactsByEmail.set(normalizeEmail(contact.email), contact)
      }
    }
  }

  if (!execute) return
  for (const row of paymentRows) {
    if (!row.email || ctx.contactsByEmail.has(row.email)) continue
    const { data, error } = await sb
      .from("contacts")
      .insert({
        organization_id: orgId,
        full_name: row.customerName,
        email: row.email,
        phone: row.phone || null,
        contact_type: "individual",
        status: "active",
      })
      .select("id, full_name, email, phone")
      .single()
    if (error) throw new Error(`create payer ${row.customerName}: ${error.message}`)
    ctx.contacts.push(data)
    ctx.contactsByEmail.set(row.email, data)
  }
}

async function upsertEnrollment(sb, orgId, enrollment, execute) {
  const importKey = createHash("sha1")
    .update(`${IMPORT_TAG}|${enrollment.student.id}|${enrollment.offeringId}`)
    .digest("hex")
  if (!execute) {
    return { enrollmentId: `dry-run:${importKey}`, chargeId: `dry-run:chg:${importKey}` }
  }

  const firstIso =
    [...enrollment.payments, ...enrollment.refunds].find((part) => part.iso)?.iso ||
    new Date().toISOString()
  const firstDate =
    [...enrollment.payments, ...enrollment.refunds].find((part) => part.date)?.date ||
    firstIso.slice(0, 10)
  const payer = enrollment.payer || enrollment.student
  const notes = [
    `Imported ${IMPORT_TAG}`,
    enrollment.couponCode ? `Coupon: ${enrollment.couponCode}` : null,
    enrollment.cancelled
      ? "Cancelled: refunded in QIPayments.csv (not enough people registered)"
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  const { data: existingRows, error: existingError } = await sb
    .from("program_enrollments")
    .select("id, charge_id, status")
    .eq("organization_id", orgId)
    .eq("offering_id", enrollment.offeringId)
    .eq("participant_contact_id", enrollment.student.id)
  if (existingError) throw new Error(`find enrollment: ${existingError.message}`)
  const existing =
    (existingRows || []).find((row) => row.status !== "cancelled") ||
    (existingRows || [])[0] ||
    null

  const payload = {
    organization_id: orgId,
    program_id: PROGRAM_ID,
    offering_id: enrollment.offeringId,
    department_id: DEPARTMENT_ID,
    child_name: enrollment.canonicalName,
    participant_contact_id: enrollment.student.id,
    registrant_contact_id: payer.id,
    payer_contact_id: payer.id,
    status: enrollment.cancelled ? "cancelled" : "enrolled",
    payment_status: enrollment.paymentStatus,
    total_amount: enrollment.assistedFee,
    amount_paid: enrollment.amountPaid,
    fee_total: enrollment.originalFee,
    discount_total: round2(Math.max(enrollment.originalFee - enrollment.assistedFee, 0)),
    final_total: enrollment.assistedFee,
    enrollment_date: firstDate,
    participant_type: "adult",
    registrant_type:
      payer.id === enrollment.student.id ? "adult_self" : "guardian",
    parent_name: payer.full_name || enrollment.payerCanonical,
    parent_email: enrollment.payerEmail || payer.email || null,
    parent_phone: enrollment.payerPhone || payer.phone || null,
    notes,
    payment_required: enrollment.assistedFee > 0.009,
    cancelled_at: enrollment.cancelled ? firstIso : null,
    cancel_reason: enrollment.cancelled
      ? "Refunded — not enough people registered (QIPayments.csv)"
      : null,
  }

  let enrollmentId = existing?.id || null
  let chargeId = existing?.charge_id || null
  if (!enrollmentId) {
    const { data, error } = await sb
      .from("program_enrollments")
      .insert(payload)
      .select("id")
      .single()
    if (error) throw new Error(`enrollment ${enrollment.canonicalName}: ${error.message}`)
    enrollmentId = data.id
  } else {
    const { error } = await sb
      .from("program_enrollments")
      .update(payload)
      .eq("id", enrollmentId)
      .eq("organization_id", orgId)
    if (error) throw new Error(`enrollment update ${enrollment.canonicalName}: ${error.message}`)
  }

  const chargeStatus =
    enrollment.amountPaid <= 0.009 && enrollment.assistedFee > 0.009
      ? "pending_payment"
      : enrollment.remaining <= 0.009
        ? "paid"
        : "partially_paid"
  const discountTotal = round2(Math.max(enrollment.originalFee - enrollment.assistedFee, 0))
  const chargePayload = {
    organization_id: orgId,
    enrollment_id: enrollmentId,
    charge_type: "registration",
    source_type: "manual",
    payer_contact_id: payer.id,
    registrant_contact_id: payer.id,
    participant_contact_id: enrollment.student.id,
    program_id: PROGRAM_ID,
    offering_id: enrollment.offeringId,
    currency: "USD",
    subtotal: enrollment.originalFee,
    discount_total: discountTotal,
    total: enrollment.assistedFee,
    due_today: Math.max(enrollment.remaining, 0),
    amount_paid: enrollment.amountPaid,
    payment_required: enrollment.assistedFee > 0.009,
    charge_status: chargeStatus,
    checkout_status:
      enrollment.amountPaid > 0 || enrollment.assistedFee <= 0.009 ? "paid" : "not_started",
    paid_at: enrollment.amountPaid > 0 || enrollment.cancelled ? firstIso : null,
    metadata: {
      import_tag: IMPORT_TAG,
      import_key: importKey,
      coupon_code: enrollment.couponCode || null,
      coupon_type: enrollment.couponClass?.type || null,
      cancelled_full_refund: enrollment.cancelled,
    },
    quote_snapshot: { import: IMPORT_TAG, offering: enrollment.offeringName },
  }

  if (!chargeId) {
    const { data, error } = await sb
      .from("program_charges")
      .insert(chargePayload)
      .select("id")
      .single()
    if (error) throw new Error(`charge ${enrollment.canonicalName}: ${error.message}`)
    chargeId = data.id
    await sb
      .from("program_enrollments")
      .update({ charge_id: chargeId })
      .eq("id", enrollmentId)
      .eq("organization_id", orgId)
  } else {
    const { error } = await sb
      .from("program_charges")
      .update(chargePayload)
      .eq("id", chargeId)
      .eq("organization_id", orgId)
    if (error) throw new Error(`charge update ${enrollment.canonicalName}: ${error.message}`)
  }

  await sb.from("program_charge_lines").delete().eq("organization_id", orgId).eq("charge_id", chargeId)
  const lines = [
    {
      organization_id: orgId,
      charge_id: chargeId,
      line_type: "tuition",
      label: enrollment.offeringName,
      quantity: 1,
      unit_amount: enrollment.originalFee,
      amount: enrollment.originalFee,
      sort_order: 0,
      metadata: { import_tag: IMPORT_TAG },
    },
  ]
  if (discountTotal > 0.009) {
    const lineType =
      enrollment.couponClass?.type === "financial_assistance"
        ? "financial_assistance"
        : enrollment.couponClass?.type === "staff_credit"
          ? "staff_discount"
          : "discount"
    lines.push({
      organization_id: orgId,
      charge_id: chargeId,
      line_type: lineType,
      label: enrollment.couponCode
        ? `Discount (${enrollment.couponCode})`
        : "Full payment discount",
      quantity: 1,
      unit_amount: -discountTotal,
      amount: -discountTotal,
      sort_order: 1,
      metadata: { import_tag: IMPORT_TAG, coupon_type: enrollment.couponClass?.type },
    })
  }
  const { error: lineError } = await sb.from("program_charge_lines").insert(lines)
  if (lineError) throw new Error(`charge lines ${enrollment.canonicalName}: ${lineError.message}`)

  await sb
    .from("program_charge_schedule")
    .delete()
    .eq("organization_id", orgId)
    .eq("charge_id", chargeId)

  const scheduleRows = []
  let sequence = 1
  for (const part of enrollment.payments) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: `Payment ${part.date || sequence}`,
      due_date: part.date,
      amount: part.amount,
      sequence_number: sequence,
      status: "paid",
      charge_category: "tuition",
      paid_at: part.iso || (part.date ? `${part.date}T17:00:00Z` : firstIso),
      metadata: {
        import_tag: IMPORT_TAG,
        stripe_charge_id: part.transactionId,
        recurring_type: part.recurringType,
      },
    })
    sequence += 1
  }
  for (const part of enrollment.refunds) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: `Refund ${part.date || sequence}`,
      due_date: part.date,
      amount: part.amount,
      original_amount: part.amount,
      sequence_number: sequence,
      status: "refunded",
      charge_category: "tuition",
      paid_at: part.iso || (part.date ? `${part.date}T17:00:00Z` : firstIso),
      metadata: {
        import_tag: IMPORT_TAG,
        stripe_charge_id: part.transactionId,
        refund_reason: part.refundReason || "not enough people registered",
      },
    })
    sequence += 1
  }
  if (enrollment.remaining > 0.009 && !enrollment.cancelled) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: "Remaining tuition",
      due_date: firstDate,
      amount: enrollment.remaining,
      sequence_number: sequence,
      status: "scheduled",
      charge_category: "tuition",
      metadata: { import_tag: IMPORT_TAG },
    })
  }
  if (scheduleRows.length) {
    const { error: scheduleError } = await sb.from("program_charge_schedule").insert(scheduleRows)
    if (scheduleError) {
      throw new Error(`schedule ${enrollment.canonicalName}: ${scheduleError.message}`)
    }
  }

  if (enrollment.application?.id) {
    const { error: appError } = await sb
      .from("program_applications")
      .update({
        status: "approved",
        enrollment_id: enrollmentId,
        approved_offering_id: enrollment.offeringId,
        participant_name: enrollment.canonicalName,
      })
      .eq("id", enrollment.application.id)
      .eq("organization_id", orgId)
    if (appError) throw new Error(`application link ${enrollment.canonicalName}: ${appError.message}`)
  }

  if (enrollment.couponClass?.type === "financial_assistance") {
    await sb
      .from("program_enrollment_fa_awards")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("enrollment_id", enrollmentId)
      .eq("status", "active")
    const { error: faError } = await sb.from("program_enrollment_fa_awards").insert({
      organization_id: orgId,
      enrollment_id: enrollmentId,
      program_id: PROGRAM_ID,
      offering_id: enrollment.offeringId,
      participant_contact_id: enrollment.student.id,
      participant_name: enrollment.canonicalName,
      original_amount: enrollment.originalFee,
      assisted_amount: enrollment.assistedFee,
      discount_amount: discountTotal,
      plan_type: "total_fee",
      note: `Imported ${IMPORT_TAG}; coupon ${enrollment.couponCode}`,
      status: "active",
    })
    if (faError) console.warn(`FA award warn (${enrollment.canonicalName}): ${faError.message}`)
  }

  try {
    await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: enrollment.student.id,
    })
    if (payer.id !== enrollment.student.id) {
      await sb.rpc("sync_contact_affiliations", {
        p_organization_id: orgId,
        p_contact_id: payer.id,
      })
    }
  } catch (error) {
    console.warn(
      `affiliation warn (${enrollment.canonicalName}): ${error instanceof Error ? error.message : error}`
    )
  }

  return { enrollmentId, chargeId }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)
  console.log(`CSV: ${args.csv}`)

  const paymentRows = loadPayments(args.csv)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ctx = await loadContext(sb, args.orgId)
  await ensurePayerAndExtraContacts(sb, args.orgId, paymentRows, ctx, false)
  const plan = buildPlan(paymentRows, ctx)

  const stamp = new Date().toISOString().slice(0, 10)
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const mode = args.execute ? "execute" : "dry-run"
  const reportPath = resolve(reportDir, `qil-2026-2027-payments-${mode}.json`)

  if (!args.execute) {
    const report = {
      importTag: IMPORT_TAG,
      mode,
      generatedAt: new Date().toISOString(),
      totals: plan.totals,
      nameFixes: plan.nameFixes,
      ambiguous: plan.ambiguous,
      unmatchedMembers: plan.unmatchedMembers,
      unmatchedOfferings: plan.unmatchedOfferings,
      payerCreates: plan.payerCreates,
      enrollments: plan.enrollments.map((item) => ({
        student: item.canonicalName,
        matchedContact: item.student.full_name,
        payer: item.payerCanonical,
        offering: item.offeringName,
        originalFee: item.originalFee,
        assistedFee: item.assistedFee,
        amountPaid: item.amountPaid,
        remaining: item.remaining,
        cancelled: item.cancelled,
        coupon: item.couponCode || null,
        payments: item.payments.map((p) => ({ amount: p.amount, date: p.date, txn: p.transactionId })),
        refunds: item.refunds.map((p) => ({ amount: p.amount, date: p.date, txn: p.transactionId })),
      })),
    }
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log("\n=== DRY-RUN SUMMARY ===")
    console.log(JSON.stringify(plan.totals, null, 2))
    console.log(`Name spelling fixes: ${plan.nameFixes.length}`)
    console.log(`Ambiguous offering picks: ${plan.ambiguous.length}`)
    console.log(`Unmatched members: ${plan.unmatchedMembers.length}`)
    console.log(`Unmatched offerings: ${plan.unmatchedOfferings.length}`)
    if (plan.unmatchedMembers.length) console.log(plan.unmatchedMembers)
    if (plan.unmatchedOfferings.length) console.log(plan.unmatchedOfferings)
    if (plan.ambiguous.length) console.log("Ambiguous:", plan.ambiguous)
    console.log(`\nReport written: ${reportPath}`)
    console.log("Re-run with --execute to write to Supabase.")
    return
  }

  const created = { enrollments: 0, nameFixes: 0, applicationsLinked: 0 }

  for (const fix of plan.nameFixes) {
    const { error } = await sb
      .from("contacts")
      .update({ full_name: fix.to })
      .eq("id", fix.contactId)
      .eq("organization_id", args.orgId)
    if (error) throw new Error(`rename ${fix.from} → ${fix.to}: ${error.message}`)
    created.nameFixes += 1
  }

  await ensurePayerAndExtraContacts(sb, args.orgId, paymentRows, ctx, true)
  const executePlan = buildPlan(paymentRows, ctx)

  for (const enrollment of executePlan.enrollments) {
    await upsertEnrollment(sb, args.orgId, enrollment, true)
    created.enrollments += 1
    if (enrollment.application?.id) created.applicationsLinked += 1
  }

  const report = {
    importTag: IMPORT_TAG,
    mode,
    generatedAt: new Date().toISOString(),
    totals: executePlan.totals,
    created,
    nameFixes: executePlan.nameFixes,
    ambiguous: executePlan.ambiguous,
    unmatchedMembers: executePlan.unmatchedMembers,
    unmatchedOfferings: executePlan.unmatchedOfferings,
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log("\n=== EXECUTE SUMMARY ===")
  console.log(JSON.stringify({ ...executePlan.totals, created }, null, 2))
  console.log(`Report written: ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
