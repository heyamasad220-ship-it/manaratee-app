/**
 * Import Quran Institute for Ladies payments from New_PAYMENT_TRANSACTION_REPORT.csv.
 *
 * - Creates closed years QIL 2022-2023 / 2023-2024 / 2024-2025 and their offerings
 * - Leaves QIL 2025-2026 unchanged
 * - QIL 2026-2027: only new Stripe IDs, matched to existing offerings (no new offerings)
 * - Skips June/July 2026 Recitation Improvement, Ijaza Lesson, Junior, Taekwondo, donations, tickets
 *
 * Usage:
 *   node scripts/import-qil-historical-payments.mjs
 *   node scripts/import-qil-historical-payments.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_HISTORICAL_PAYMENTS_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/New_PAYMENT_TRANSACTION_REPORT.csv"
const DEPARTMENT_ID = "c5d6b286-0d48-431f-9b55-94a80d4821ef"
const QIL_2026_ID = "78616758-d6fc-4a48-a99c-f8ea24a34646"

const YEAR_DEFS = {
  "2022-2023": {
    name: "QIL 2022-2023",
    start: "2022-08-01",
    end: "2023-05-31",
  },
  "2023-2024": {
    name: "QIL 2023-2024",
    start: "2023-08-01",
    end: "2024-05-31",
  },
  "2024-2025": {
    name: "QIL 2024-2025",
    start: "2024-08-01",
    end: "2025-05-31",
  },
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

const COURSE_FROM_REASON = [
  [/surat an.?nisa|سورة النّساء|سورة النساء/, "Surat An-Nisa"],
  [/beginner.*summer 2023/, "Tajweed (Beginner) Summer"],
  [/advanced.*summer 2023|advance.*summer 2023/, "Tajweed (Advanced) Summer"],
  [/beginner|مبتدئة/, "Tajweed (Beginner)"],
  [/osool|الأصول/, "Tajweed (Osool)"],
  [/baqara|سورة البقرة/, "Surat Al-Baqara"],
  [/nouranea|nourani|قاعدة نوراني/, "Al Nouraniyyeh"],
  [/recitation improvement.*level 1|تحسين تلاوة/, "Recitation Improvement (Level 1)"],
  [/recitation improvement.*level 2|تحسين الأداء/, "Recitation Improvement (Level 2)"],
  [/girls\s*14/, "Quran & Arabic Language Arts (Girls 14+)"],
  [/nahw|النّحو|النحو والإعراب/, "Arabic Grammar (Nahw)"],
  [/zahrawayn|الزّهراوين|الزهراوين/, "Hifz Review (Az-Zahrawayn)"],
  [/حفظ القرآن|hifz(?! review)/, "Hifz"],
  [/arabic grammar/, "Arabic Grammar"],
  [/shu.?uba|شعبة/, "Shu'uba Narration"],
  [/pre.?ijaza|الإعداد للإجازة/, "Preparing for Ijaza"],
  [/ijaza & sanad|إجازة تلاوة/, "Ijaza & Sanad"],
  [/advance|متقد/, "Tajweed (Advanced)"],
]

const COURSE_FROM_SECONDARY = [
  [/hifz classes/, "Hifz"],
  [/hifz review/, "Hifz Review & Arabic Grammar"],
  [/hifz and arabic/, "Hifz and Arabic Grammar"],
  [/ijaza.*sanad/, "Ijaza & Sanad"],
  [/itqan|pre.?ijaza|improvement recitation/, "Recitation / Ijaza"],
  [/tajweed section/, "Tajweed"],
  [/nouraneh.*recitation|nouraea.*recitation|nouranea.*recitation/, "Nouraniyyeh / Recitation Improvement"],
  [/recitation.*nouranea|recitation.*noranea/, "Recitation / Nouraniyyeh"],
  [/nouranea|beginner|advance|ousol|osool/, "Tajweed / Nouraniyyeh"],
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
  const args = { csv: DEFAULT_CSV, execute: false, orgId: DEFAULT_ORG_ID }
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

function fold(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseMoney(value) {
  if (value == null || value === "") return 0
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function parseTxnDate(value) {
  const text = normalizeText(value).replace(
    /\s+(CDT|CST|EDT|EST|PDT|PST|MDT|MST|UTC)$/i,
    ""
  )
  if (!text) return { date: null, iso: null }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return { date: null, iso: null }
  return { date: parsed.toISOString().slice(0, 10), iso: parsed.toISOString() }
}

function extractField(remarks, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Registration Fees|Subscription Fees|Subscription Discount|Add-Ons Amount|Coupon Code|Registration Coupon Value|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
    "i"
  )
  const match = re.exec(remarks || "")
  return match ? normalizeText(match[1]) : ""
}

function parseMembers(remarks, fallbackName) {
  const raw = extractField(remarks, "Registered Members")
  const members = raw
    ? raw
        .split(",")
        .map((item) =>
          normalizeText(item.replace(/\biphone\b/gi, " ").replace(/\bipad\b/gi, " "))
        )
        .filter(Boolean)
    : []
  return members.length ? members : fallbackName ? [fallbackName] : ["Unknown student"]
}

function skipReason(reason) {
  const n = fold(reason)
  if (/junior/.test(n)) return "junior"
  if (/taekwondo|self defense/.test(n)) return "not_qil"
  if (/recitation improvement \(june\)|recitation improvement \(july\)/.test(n)) {
    return "intensive_2026"
  }
  if (/ijaza lesson/.test(n)) return "ijaza_lesson"
  if (/ladies/i.test(reason) && /2025/.test(reason) && /2026/.test(reason) && !/2027/.test(reason)) {
    return "already_imported_2025_26"
  }
  if (/brother/.test(n)) return "not_qil"
  if (/little hearts|\bqlh\b|sunday school|camp|istiqamah|game night/.test(n)) {
    return "not_qil"
  }
  return null
}

function isQilRow(reason) {
  if (skipReason(reason)) return false
  const n = fold(reason)
  if (/quran institur?e for ladies|quran institute for ladies/.test(n)) return true
  if (/mas quran institute/.test(n)) return true
  if (/ladies quran/.test(n)) return true
  if (n === "quran institute") return true
  if (/quran institute/.test(n) && /ijaza/.test(n) && !/lesson/.test(n)) return true
  return false
}

function assignYear(reason, date) {
  const n = fold(reason)
  if (/ladies/.test(n) && /2026/.test(n) && /2027/.test(n)) return "2026-2027"
  if (/ladies/.test(n) && /2026/.test(n) && !/2025/.test(n)) return "2026-2027"
  if (!date) return null
  if (date >= "2024-07-01" && date < "2025-08-01") return "2024-2025"
  if (date >= "2023-08-01" && date < "2024-07-01") return "2023-2024"
  if (date >= "2022-08-01" && date < "2023-08-01") return "2022-2023"
  return null
}

function matchTable(text, table, fallback) {
  const n = fold(text)
  const raw = String(text || "")
  for (const [re, name] of table) {
    if (re.test(n) || re.test(raw)) return name
  }
  return fallback
}

function offeringNameFor(yearKey, reason, secondary) {
  if (yearKey === "2026-2027") {
    return normalizeText(secondary) || "Tajweed & Recitation"
  }
  if (yearKey === "2024-2025") {
    const sec = fold(secondary)
    if (/memorization/.test(sec)) return "Memorization"
    if (/recitation/.test(sec)) return "Recitation & Arabic Grammar"
    return "QIL Registration"
  }
  if (yearKey === "2023-2024") {
    return matchTable(
      secondary,
      COURSE_FROM_SECONDARY,
      matchTable(reason, COURSE_FROM_REASON, "QIL Registration")
    )
  }
  return matchTable(reason, COURSE_FROM_REASON, "QIL Registration")
}

function offeringFamily(secondary) {
  const n = fold(secondary)
  if (!n) return "tajweed_recitation"
  if (n.includes("baqara") || n.includes("omran") || n.includes("aal imran")) {
    return "memoriz_baqara_omran"
  }
  if (n.includes("course 1") || n.includes("course 2")) return "memoriz_course"
  return "tajweed_recitation"
}

function offeringMatchesFamily(offeringName, family) {
  const name = fold(offeringName)
  if (!name) return false
  if (name.includes("ajurrum")) return false
  if (family === "memoriz_baqara_omran") {
    return name.includes("baqara") || name.includes("omran")
  }
  if (family === "memoriz_course") {
    return (
      name.includes("memorization 1") ||
      name.includes("yusif") ||
      name.includes("annahl")
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
  const name = fold(offeringName)
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

function loadRows(csvPath) {
  const { data, errors } = Papa.parse(readFileSync(csvPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  if (errors?.length) console.warn(`CSV parse warnings: ${errors.length}`)
  return data.map((row, index) => {
    const txn = parseTxnDate(row["Transaction Date"])
    const amount = parseMoney(row.Amount)
    const remarks = row["Payment Remarks"]
    const customerName = normalizeText(row["Customer Name"])
    return {
      rowNumber: index + 2,
      amount,
      amountType: normalizeText(row["Amount Type"]),
      status: normalizeText(row.Status).toLowerCase(),
      reason: normalizeText(row["Payment / Donation Reason"]),
      secondary: normalizeText(row["Payment / Donation Secondary Reason"]),
      email: normalizeText(row["Customer Email"]).toLowerCase(),
      phone: normalizeText(row["Customer Phone"]),
      customerName,
      members: parseMembers(remarks, customerName),
      txnId: normalizeText(row["Transaction ID"]),
      refundReason: normalizeText(row["Refund Reason"]),
      recurringType: normalizeText(row["Recurring Type"]).toUpperCase(),
      date: txn.date,
      iso: txn.iso,
      isFullPayment: /yes/i.test(extractField(remarks, "Is Full Payment Made")),
      subscriptionFees: parseMoney(extractField(remarks, "Subscription Fees")),
    }
  })
}

function buildPlan(rows, existingStripeIds, offerings2026) {
  const skipped = {}
  const bumpSkip = (key) => {
    skipped[key] = (skipped[key] || 0) + 1
  }

  const grouped = new Map()
  for (const row of rows) {
    if (["DONATION_AMOUNT", "TICKET_AMOUNT"].includes(row.amountType)) {
      bumpSkip("donation_or_ticket")
      continue
    }
    const skip = skipReason(row.reason)
    if (skip) {
      bumpSkip(skip)
      continue
    }
    if (!isQilRow(row.reason)) {
      bumpSkip("not_qil")
      continue
    }
    if (row.status === "processing") {
      bumpSkip("processing")
      continue
    }
    const yearKey = assignYear(row.reason, row.date)
    if (!yearKey) {
      bumpSkip("unyearned")
      continue
    }
    if (yearKey === "2026-2027" && row.txnId && existingStripeIds.has(row.txnId)) {
      bumpSkip("already_in_2026_27")
      continue
    }
    const key = row.txnId || `row:${row.rowNumber}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        txnId: row.txnId,
        yearKey,
        reason: row.reason,
        secondary: row.secondary,
        email: row.email,
        phone: row.phone,
        customerName: row.customerName,
        members: row.members,
        payments: [],
        refunds: [],
        isFullPayment: row.isFullPayment,
        subscriptionFees: row.subscriptionFees,
      })
    }
    const g = grouped.get(key)
    if (row.secondary && !g.secondary) g.secondary = row.secondary
    if (row.email && !g.email) g.email = row.email
    if (row.status === "refunded" || row.amount < 0) {
      g.refunds.push({
        amount: Math.abs(row.amount),
        date: row.date,
        iso: row.iso,
        transactionId: row.txnId,
        refundReason: row.refundReason,
        recurringType: row.recurringType,
      })
    } else if (row.status === "succeeded" && row.amount > 0.009) {
      g.payments.push({
        amount: row.amount,
        date: row.date,
        iso: row.iso,
        transactionId: row.txnId,
        recurringType: row.recurringType,
        amountType: row.amountType,
      })
    } else {
      bumpSkip("zero_or_other_status")
    }
  }

  const unknownCourses = []
  const enrollments = []
  const unmatched2026 = []
  const byYear = {}

  for (const g of grouped.values()) {
    const gross = round2(g.payments.reduce((s, p) => s + p.amount, 0))
    const refunded = round2(g.refunds.reduce((s, p) => s + p.amount, 0))
    const net = round2(gross - refunded)
    if (gross <= 0.009 && refunded <= 0.009) continue

    let offeringName = offeringNameFor(g.yearKey, g.reason, g.secondary)
    if (offeringName === "QIL Registration" && g.yearKey !== "2024-2025") {
      unknownCourses.push({ yearKey: g.yearKey, reason: g.reason, secondary: g.secondary, date: g.payments[0]?.date || g.refunds[0]?.date })
    }
    let offeringId = null
    if (g.yearKey === "2026-2027") {
      const family = offeringFamily(g.secondary)
      const matches = offerings2026.filter((o) => offeringMatchesFamily(o.name, family))
      const sorted = [...matches].sort((a, b) => {
        const pri = offeringPriority(a.name) - offeringPriority(b.name)
        if (pri !== 0) return pri
        return (b.enrolled || 0) - (a.enrolled || 0)
      })
      if (!sorted.length) {
        unmatched2026.push({
          email: g.email,
          name: g.customerName,
          secondary: g.secondary,
          net,
        })
        continue
      }
      offeringId = sorted[0].id
      offeringName = sorted[0].name
    }

    const members = g.members.length ? g.members : [g.customerName]
    const payShares = splitMoneyAcross(gross, members.length)
    const refundShares = splitMoneyAcross(refunded, members.length)

    members.forEach((member, index) => {
      const paid = payShares[index] || 0
      const ref = refundShares[index] || 0
      const netPaid = round2(paid - ref)
      const cancelled = ref > 0.009 && netPaid <= 0.009
      const listPrice =
        g.subscriptionFees > 0 && members.length === 1
          ? g.subscriptionFees
          : Math.max(paid, netPaid)
      enrollments.push({
        yearKey: g.yearKey,
        offeringName,
        offeringId,
        studentName: member,
        payerName: g.customerName,
        email: g.email,
        phone: g.phone,
        gross: paid,
        refunded: ref,
        netPaid: Math.max(netPaid, 0),
        listPrice,
        cancelled,
        payments: g.payments.map((p) => ({
          ...p,
          amount: members.length === 1 ? p.amount : round2(p.amount / members.length),
        })).filter((p) => p.amount > 0.009),
        refunds: g.refunds.map((p) => ({
          ...p,
          amount: members.length === 1 ? p.amount : round2(p.amount / members.length),
        })).filter((p) => p.amount > 0.009),
      })
    })

    if (!byYear[g.yearKey]) {
      byYear[g.yearKey] = { txns: 0, gross: 0, refunded: 0, net: 0, offerings: {} }
    }
    const y = byYear[g.yearKey]
    y.txns += 1
    y.gross = round2(y.gross + gross)
    y.refunded = round2(y.refunded + refunded)
    y.net = round2(y.net + net)
    y.offerings[offeringName] = (y.offerings[offeringName] || 0) + 1
  }

  const merged = new Map()
  for (const enrollment of enrollments) {
    const key = `${enrollment.yearKey}|${enrollment.offeringName}|${fold(enrollment.studentName)}|${enrollment.email || ""}`
    if (!merged.has(key)) {
      merged.set(key, {
        ...enrollment,
        payments: [...enrollment.payments],
        refunds: [...enrollment.refunds],
      })
      continue
    }
    const current = merged.get(key)
    current.gross = round2(current.gross + enrollment.gross)
    current.refunded = round2(current.refunded + enrollment.refunded)
    current.netPaid = round2(current.netPaid + enrollment.netPaid)
    current.listPrice = round2(
      Math.max(current.listPrice, enrollment.listPrice, current.gross)
    )
    current.payments.push(...enrollment.payments)
    current.refunds.push(...enrollment.refunds)
    current.cancelled = current.refunded > 0.009 && current.netPaid <= 0.009
    if (!current.email && enrollment.email) current.email = enrollment.email
    if (!current.phone && enrollment.phone) current.phone = enrollment.phone
  }
  const mergedEnrollments = [...merged.values()]

  return {
    skipped,
    unmatched2026,
    unknownCourses: unknownCourses.slice(0, 40),
    unknownCourseCount: unknownCourses.length,
    enrollments: mergedEnrollments,
    byYear,
    totals: {
      enrollments: mergedEnrollments.length,
      cancelled: mergedEnrollments.filter((e) => e.cancelled).length,
      net: round2(mergedEnrollments.reduce((s, e) => s + e.netPaid, 0)),
      gross: round2(mergedEnrollments.reduce((s, e) => s + e.gross, 0)),
      refunded: round2(mergedEnrollments.reduce((s, e) => s + e.refunded, 0)),
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

async function ensureProgram(sb, orgId, yearKey, execute) {
  const def = YEAR_DEFS[yearKey]
  const { data: existing } = await sb
    .from("programs")
    .select("id, name, department_id")
    .eq("organization_id", orgId)
    .eq("name", def.name)
    .maybeSingle()
  if (existing) return existing
  if (!execute) return { id: `dry-run:${yearKey}`, name: def.name, department_id: DEPARTMENT_ID }
  const { data, error } = await sb
    .from("programs")
    .insert({
      organization_id: orgId,
      department_id: DEPARTMENT_ID,
      name: def.name,
      description: "Historical QIL year imported from payment export. Courses are offerings.",
      start_date: def.start,
      end_date: def.end,
      enrollment_open_date: def.start,
      enrollment_close_date: def.end,
      program_type: "adult",
      program_kind: "academic",
      gender: "Female",
      capacity: 0,
      enrolled: 0,
      waitlist: 0,
      status: "closed",
      visibility: "private",
      enrollment_process: "application_approval",
      evaluation_required: true,
      full_program_registration_enabled: true,
      session_registration_enabled: false,
      require_guardian: false,
    })
    .select("id, name, department_id")
    .single()
  if (error) throw new Error(`program ${def.name}: ${error.message}`)
  return data
}

async function ensureOffering(sb, orgId, program, yearKey, courseName, execute, cache) {
  const cacheKey = `${program.id}:${courseName}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  const { data: existing } = await sb
    .from("program_offerings")
    .select("id, name, program_id")
    .eq("organization_id", orgId)
    .eq("program_id", program.id)
    .eq("name", courseName)
    .maybeSingle()
  if (existing) {
    cache.set(cacheKey, existing)
    return existing
  }
  if (!execute) {
    const placeholder = { id: `dry-run:off:${courseName}`, name: courseName, program_id: program.id }
    cache.set(cacheKey, placeholder)
    return placeholder
  }
  const def = YEAR_DEFS[yearKey]
  const { data, error } = await sb
    .from("program_offerings")
    .insert({
      organization_id: orgId,
      program_id: program.id,
      name: courseName,
      is_default: courseName === "QIL Registration",
      offering_type: "academic_year",
      start_date: def.start,
      end_date: def.end,
      enrollment_open_date: def.start,
      enrollment_close_date: def.end,
      status: "closed",
      gender: "Female",
    })
    .select("id, name, program_id")
    .single()
  if (error) throw new Error(`offering ${courseName}: ${error.message}`)
  cache.set(cacheKey, data)
  return data
}

async function ensureContact(sb, orgId, fullName, email, phone, execute) {
  if (email) {
    const { data: byEmail } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .ilike("email", email)
      .maybeSingle()
    if (byEmail) {
      const patch = {}
      if (email && !byEmail.email) patch.email = email
      if (phone && !byEmail.phone) patch.phone = phone
      if (Object.keys(patch).length && execute) {
        await sb.from("contacts").update(patch).eq("id", byEmail.id)
      }
      return byEmail
    }
  }
  const digits = String(phone || "").replace(/\D/g, "")
  const last10 = digits.length >= 10 ? digits.slice(-10) : ""
  if (last10) {
    const { data: byPhone } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .or(`phone.ilike.%${last10}%,phone.ilike.%${digits}%`)
      .limit(5)
    const hit = (byPhone || []).find((c) => {
      const d = String(c.phone || "").replace(/\D/g, "")
      return d.endsWith(last10)
    })
    if (hit) {
      const patch = {}
      if (email && !hit.email) patch.email = email
      if (Object.keys(patch).length && execute) {
        await sb.from("contacts").update(patch).eq("id", hit.id)
      }
      return hit
    }
  }
  if (fullName) {
    const { data: byName } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .ilike("full_name", fullName)
      .limit(1)
      .maybeSingle()
    if (byName) {
      const patch = {}
      if (email && !byName.email) patch.email = email
      if (phone && !byName.phone) patch.phone = phone
      if (Object.keys(patch).length && execute) {
        await sb.from("contacts").update(patch).eq("id", byName.id)
      }
      return byName
    }
  }
  if (!execute) {
    return { id: `dry-run:c:${fold(fullName)}`, full_name: fullName, email, phone }
  }
  const { data, error } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: fullName || "Unknown",
    p_email: email || null,
    p_phone: phone || null,
    p_contact_type: "individual",
  })
  if (error) throw new Error(`contact ${fullName}: ${error.message}`)
  const { data: contact, error: reloadError } = await sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("id", data)
    .single()
  if (reloadError) throw new Error(`reload contact ${fullName}: ${reloadError.message}`)
  return contact
}

async function upsertEnrollment(sb, orgId, program, offering, enrollment, execute) {
  const importKey = createHash("sha1")
    .update(
      `${IMPORT_TAG}|${program.id}|${offering.id}|${fold(enrollment.studentName)}|${enrollment.payments[0]?.transactionId || enrollment.email}`
    )
    .digest("hex")
  if (!execute) return { enrollmentId: `dry:${importKey}`, chargeId: `dry:chg:${importKey}` }

  const firstIso =
    [...enrollment.payments, ...enrollment.refunds].find((p) => p.iso)?.iso ||
    new Date().toISOString()
  const firstDate =
    [...enrollment.payments, ...enrollment.refunds].find((p) => p.date)?.date ||
    firstIso.slice(0, 10)

  const student = await ensureContact(
    sb,
    orgId,
    enrollment.studentName,
    enrollment.email,
    enrollment.phone,
    execute
  )
  const payer =
    fold(enrollment.payerName) === fold(enrollment.studentName)
      ? student
      : await ensureContact(
          sb,
          orgId,
          enrollment.payerName,
          enrollment.email,
          enrollment.phone,
          execute
        )

  const { data: existingRows, error: existingError } = await sb
    .from("program_enrollments")
    .select("id, charge_id, status")
    .eq("organization_id", orgId)
    .eq("offering_id", offering.id)
    .eq("participant_contact_id", student.id)
  if (existingError) throw new Error(`find enrollment: ${existingError.message}`)
  const existing =
    (existingRows || []).find((row) => row.status !== "cancelled") ||
    (existingRows || [])[0] ||
    null

  const remaining = round2(Math.max(enrollment.listPrice - enrollment.netPaid, 0))
  const paymentStatus = enrollment.cancelled
    ? "refunded"
    : enrollment.netPaid <= 0.009
      ? "pending"
      : remaining <= 0.009
        ? "paid"
        : "partial"
  const payload = {
    organization_id: orgId,
    program_id: program.id,
    offering_id: offering.id,
    department_id: DEPARTMENT_ID,
    child_name: enrollment.studentName,
    participant_contact_id: student.id,
    registrant_contact_id: payer.id,
    payer_contact_id: payer.id,
    status: enrollment.cancelled ? "cancelled" : "enrolled",
    payment_status: enrollment.cancelled ? "paid" : paymentStatus,
    total_amount: enrollment.listPrice,
    amount_paid: enrollment.netPaid,
    fee_total: enrollment.listPrice,
    discount_total: 0,
    final_total: enrollment.listPrice,
    enrollment_date: firstDate,
    participant_type: "adult",
    registrant_type: payer.id === student.id ? "adult_self" : "guardian",
    parent_name: payer.full_name || enrollment.payerName,
    parent_email: enrollment.email || payer.email || null,
    parent_phone: enrollment.phone || payer.phone || null,
    notes: `Imported ${IMPORT_TAG}`,
    payment_required: enrollment.listPrice > 0.009,
    cancelled_at: enrollment.cancelled ? firstIso : null,
    cancel_reason: enrollment.cancelled ? "Fully refunded in payment export" : null,
  }

  let enrollmentId = existing?.id || null
  let chargeId = existing?.charge_id || null
  if (!enrollmentId) {
    const { data, error } = await sb.from("program_enrollments").insert(payload).select("id").single()
    if (error) throw new Error(`enrollment ${enrollment.studentName}: ${error.message}`)
    enrollmentId = data.id
  } else {
    const { error } = await sb
      .from("program_enrollments")
      .update(payload)
      .eq("id", enrollmentId)
      .eq("organization_id", orgId)
    if (error) throw new Error(`enrollment update ${enrollment.studentName}: ${error.message}`)
  }

  const chargeStatus =
    enrollment.netPaid <= 0.009 && enrollment.listPrice > 0.009
      ? "pending_payment"
      : remaining <= 0.009
        ? "paid"
        : "partially_paid"
  const chargePayload = {
    organization_id: orgId,
    enrollment_id: enrollmentId,
    charge_type: "registration",
    source_type: "manual",
    payer_contact_id: payer.id,
    registrant_contact_id: payer.id,
    participant_contact_id: student.id,
    program_id: program.id,
    offering_id: offering.id,
    currency: "USD",
    subtotal: enrollment.listPrice,
    discount_total: 0,
    total: enrollment.listPrice,
    due_today: remaining,
    amount_paid: enrollment.netPaid,
    payment_required: enrollment.listPrice > 0.009,
    charge_status: chargeStatus,
    checkout_status: enrollment.netPaid > 0 || enrollment.cancelled ? "paid" : "not_started",
    paid_at: enrollment.netPaid > 0 || enrollment.cancelled ? firstIso : null,
    metadata: { import_tag: IMPORT_TAG, import_key: importKey },
    quote_snapshot: { import: IMPORT_TAG, offering: enrollment.offeringName },
  }

  if (!chargeId) {
    const { data, error } = await sb.from("program_charges").insert(chargePayload).select("id").single()
    if (error) throw new Error(`charge ${enrollment.studentName}: ${error.message}`)
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
    if (error) throw new Error(`charge update ${enrollment.studentName}: ${error.message}`)
  }

  await sb.from("program_charge_lines").delete().eq("organization_id", orgId).eq("charge_id", chargeId)
  const { error: lineError } = await sb.from("program_charge_lines").insert({
    organization_id: orgId,
    charge_id: chargeId,
    line_type: "tuition",
    label: enrollment.offeringName,
    quantity: 1,
    unit_amount: enrollment.listPrice,
    amount: enrollment.listPrice,
    sort_order: 0,
    metadata: { import_tag: IMPORT_TAG },
  })
  if (lineError) throw new Error(`charge lines ${enrollment.studentName}: ${lineError.message}`)

  const { data: existingSched, error: schedReadError } = await sb
    .from("program_charge_schedule")
    .select("id, sequence_number, metadata")
    .eq("organization_id", orgId)
    .eq("charge_id", chargeId)
  if (schedReadError) throw new Error(`read schedule: ${schedReadError.message}`)
  const foreignSchedule = (existingSched || []).some(
    (row) => row.metadata?.import_tag && row.metadata.import_tag !== IMPORT_TAG
  )
  const alreadyStripe = new Set(
    (existingSched || [])
      .map((row) => row.metadata?.stripe_charge_id)
      .filter(Boolean)
  )

  if (!foreignSchedule) {
    await sb.from("program_charge_schedule").delete().eq("organization_id", orgId).eq("charge_id", chargeId)
  }
  const scheduleRows = []
  let sequence = foreignSchedule
    ? Math.max(0, ...(existingSched || []).map((row) => row.sequence_number || 0)) + 1
    : 1
  for (const part of enrollment.payments) {
    if (foreignSchedule && part.transactionId && alreadyStripe.has(part.transactionId)) continue
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
    if (foreignSchedule && part.transactionId && alreadyStripe.has(part.transactionId)) continue
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
        refund_reason: part.refundReason,
      },
    })
    sequence += 1
  }
  if (scheduleRows.length) {
    const { error: scheduleError } = await sb.from("program_charge_schedule").insert(scheduleRows)
    if (scheduleError) {
      throw new Error(`schedule ${enrollment.studentName}: ${scheduleError.message}`)
    }
  }

  try {
    await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: student.id,
    })
    if (payer.id !== student.id) {
      await sb.rpc("sync_contact_affiliations", {
        p_organization_id: orgId,
        p_contact_id: payer.id,
      })
    }
  } catch (error) {
    console.warn(
      `affiliation warn (${enrollment.studentName}): ${error instanceof Error ? error.message : error}`
    )
  }

  return { enrollmentId, chargeId }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)
  console.log(`CSV: ${args.csv}`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const rows = loadRows(args.csv)
  const existingSchedule = await fetchAll(
    sb,
    "program_charge_schedule",
    "metadata",
    (q) => q.eq("organization_id", args.orgId)
  )
  // Keep this broad so re-runs skip Stripe IDs already on any program year.
  const existingStripeIds = new Set(
    existingSchedule
      .map((row) => row.metadata?.stripe_charge_id)
      .filter((id) => typeof id === "string" && id.trim())
  )

  const offerings2026 = await fetchAll(
    sb,
    "program_offerings",
    "id, name",
    (q) => q.eq("organization_id", args.orgId).eq("program_id", QIL_2026_ID)
  )
  const enrollCounts = await fetchAll(
    sb,
    "program_enrollments",
    "offering_id",
    (q) => q.eq("organization_id", args.orgId).eq("program_id", QIL_2026_ID).eq("status", "enrolled")
  )
  const countByOffering = new Map()
  for (const row of enrollCounts) {
    countByOffering.set(row.offering_id, (countByOffering.get(row.offering_id) || 0) + 1)
  }
  for (const offering of offerings2026) {
    offering.enrolled = countByOffering.get(offering.id) || 0
  }

  const plan = buildPlan(rows, existingStripeIds, offerings2026)
  const stamp = new Date().toISOString().slice(0, 10)
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const mode = args.execute ? "execute" : "dry-run"
  const reportPath = resolve(reportDir, `qil-historical-payments-${mode}-${stamp}.json`)

  const created = { programs: [], offerings: [], enrollments: 0 }

  if (args.execute) {
    const programByYear = {
      "2026-2027": { id: QIL_2026_ID, name: "QIL 2026-2027", department_id: DEPARTMENT_ID },
    }
    const offeringCache = new Map()
    for (const yearKey of Object.keys(YEAR_DEFS)) {
      programByYear[yearKey] = await ensureProgram(sb, args.orgId, yearKey, true)
      created.programs.push(programByYear[yearKey].name)
    }
    for (const enrollment of plan.enrollments) {
      const program = programByYear[enrollment.yearKey]
      if (!program) throw new Error(`No program for ${enrollment.yearKey}`)
      let offering
      if (enrollment.yearKey === "2026-2027") {
        offering = offerings2026.find((o) => o.id === enrollment.offeringId)
        if (!offering) throw new Error(`Missing 2026 offering for ${enrollment.studentName}`)
      } else {
        offering = await ensureOffering(
          sb,
          args.orgId,
          program,
          enrollment.yearKey,
          enrollment.offeringName,
          true,
          offeringCache
        )
      }
      await upsertEnrollment(sb, args.orgId, program, offering, enrollment, true)
      created.enrollments += 1
    }
    created.offerings = [...offeringCache.values()].map((o) => o.name)
  }

  const report = {
    importTag: IMPORT_TAG,
    mode,
    generatedAt: new Date().toISOString(),
    skipped: plan.skipped,
    byYear: plan.byYear,
    totals: plan.totals,
    unmatched2026: plan.unmatched2026,
    unknownCourseCount: plan.unknownCourseCount,
    unknownCourses: plan.unknownCourses,
    created,
    sample: plan.enrollments.slice(0, 25).map((e) => ({
      year: e.yearKey,
      offering: e.offeringName,
      student: e.studentName,
      payer: e.payerName,
      email: e.email,
      net: e.netPaid,
      refunded: e.refunded,
      cancelled: e.cancelled,
    })),
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log("\n=== SUMMARY ===")
  console.log(JSON.stringify({ skipped: plan.skipped, byYear: plan.byYear, totals: plan.totals, unmatched2026: plan.unmatched2026, unknownCourseCount: plan.unknownCourseCount, unknownCourses: plan.unknownCourses, created }, null, 2))
  console.log(`Report: ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
