/**
 * Analyze New_PAYMENT_TRANSACTION_REPORT.csv with QIL offering/year mapping.
 * Run: node scripts/_analyze-new-payment-csv.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV = "C:/Users/danan/Downloads/New_PAYMENT_TRANSACTION_REPORT.csv"

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
  if (value == null || value === "") return null
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}
function parseTxnDate(value) {
  const text = normalizeText(value).replace(/\s+(CDT|CST|EDT|EST|PDT|PST|MDT|MST|UTC)$/i, "")
  if (!text) return null
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function classifyReason(reason) {
  const n = fold(reason)
  if (!n) return { family: "blank", year: null, key: "blank" }

  const isQil =
    (/quran institur?e for ladies/.test(n) || /\bqil\b/.test(n) || /quran institute for ladies/.test(n)) &&
    !/junior/.test(n) &&
    !/brother/.test(n) &&
    !/games/.test(n)
  // Also catch course-named QIL offerings exported as the "program"
  const qilCourseOnly =
    !isQil &&
    (/tajweed|recitation improvement|memorization|nouraniyyeh|ijaza|ajurrum|shu.?uba|osool/.test(n) ||
      /preparing for ijaza/.test(n)) &&
    !/junior/.test(n) &&
    !/little hearts/.test(n) &&
    !/sunday/.test(n)

  if (isQil || n.includes("quran institute for ladies") || n.includes("quran institure for ladies")) {
    let year = null
    if (/2026\s*-?\s*2027|26\s*-?\s*27/.test(n) && !/2025\s*-?\s*2026/.test(n)) year = "2026-2027"
    else if (/2025\s*-?\s*2026|25\s*-?\s*26/.test(n) && !/2024/.test(n) && !/2026\s*-?\s*2027/.test(n)) year = "2025-2026"
    else if (/2024\s*-?\s*2025|24\s*-?\s*25/.test(n)) year = "2024-2025"
    else if (/2026/.test(n) && !/2025/.test(n)) year = "2026-2027"
    else if (/2025/.test(n) && !/2026\s*-?\s*2027/.test(n) && !/2024/.test(n)) year = "2025-2026"
    return { family: "qil", year, key: `qil:${year || "unyearned"}` }
  }

  if (/quran 4 little|quran for little|\bqlh\b/.test(n)) {
    let year = null
    if (/26\s*-?\s*27|2026\s*-?\s*2027/.test(n)) year = "2026-2027"
    else if (/25\s*-?\s*26|2025\s*-?\s*2026/.test(n) && !/2024/.test(n)) year = "2025-2026"
    else if (/2024|24\s*-?\s*25/.test(n)) year = "2024-2025"
    return { family: "qlh", year, key: `qlh:${year || "unyearned"}` }
  }
  if (/sunday school/.test(n) && /lunch/.test(n)) return { family: "ss_lunch", year: null, key: "ss_lunch" }
  if (/muhsen sunday/.test(n)) return { family: "ss_muhsen", year: null, key: "ss_muhsen" }
  if (/sunday school/.test(n)) {
    let year = null
    if (/26\s*-?\s*27|2026/.test(n) && !/2025\s*-?\s*2026/.test(n) && !/25\s*-?\s*26/.test(n)) year = "2026-2027"
    else if (/25\s*-?\s*26|2025/.test(n) && !/2024/.test(n) && !/26\s*-?\s*27/.test(n)) year = "2025-2026"
    else if (/2024|24/.test(n)) year = "2024-2025"
    return { family: "sunday_school", year, key: `ss:${year || "unyearned"}` }
  }
  if (/2026 mas summer camp (one|two)/.test(n)) return { family: "camp", year: "2026", key: "camp:2026" }
  if (/youth intensive summer camp 2026/.test(n)) return { family: "camp_youth", year: "2026", key: "camp_youth:2026" }
  if (/special needs summer camp/.test(n)) return { family: "camp_sn", year: null, key: "camp_sn" }
  if (/2025 mas summer/.test(n) || /youth intensive summer camp 2025/.test(n)) return { family: "camp", year: "2025", key: "camp:2025" }
  if (/quran institute junior/.test(n)) return { family: "qij", year: /26/.test(n) ? "2026-2027" : null, key: "qij" }
  return { family: "other", year: null, key: "other" }
}

function qilOfferingFamily(secondary) {
  const n = fold(secondary)
  if (!n) return "blank"
  if (n.includes("baqara") || n.includes("omran") || n.includes("aal imran")) return "memoriz_baqara_omran"
  if (n.includes("course 1") || n.includes("course 2") || n.includes("yusif") || n.includes("annahl") || n.includes("memorization")) {
    return "memoriz_course"
  }
  if (n.includes("ajurrum")) return "ajurrumiyyah"
  if (n.includes("nourani")) return "nouraniyyeh"
  if (n.includes("ijaza")) return "ijaza"
  if (n.includes("shu")) return "shuuba"
  if (n.includes("tajweed") || n.includes("recitation")) return "tajweed_recitation"
  return `other:${n.slice(0, 60)}`
}

const text = readFileSync(CSV, "utf8")
const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })
const headers = parsed.meta.fields || []
const rows = parsed.data

const issues = {
  missingAmount: 0,
  zeroAmount: 0,
  negativeAmount: 0,
  missingEmail: 0,
  missingTxnId: 0,
  missingReason: 0,
  unparseableDate: 0,
  unknownStatus: {},
}
const statuses = new Map()
const amountTypes = new Map()
const txnTypes = new Map()
const paymentModes = new Map()
const reasons = new Map()
const qilReasons = new Map()
const qilSecondaries = new Map()
const qilYearSecondary = new Map()
const families = new Map()
const txnIdCounts = new Map()
const dates = []
let totalAmount = 0
const qilRows = []
const refundRows = []
const processingRows = []
const failedRows = []

function bump(map, key, amount) {
  const cur = map.get(key) || { count: 0, amount: 0 }
  cur.count += 1
  cur.amount = Math.round((cur.amount + (amount || 0)) * 100) / 100
  map.set(key, cur)
}

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i]
  const amount = parseMoney(row.Amount)
  const status = normalizeText(row.Status).toLowerCase()
  const amountType = normalizeText(row["Amount Type"]) || "(blank)"
  const txnType = normalizeText(row["Transaction Type"]) || "(blank)"
  const mode = normalizeText(row["Payment Mode"]) || "(blank)"
  const reason = normalizeText(row["Payment / Donation Reason"])
  const secondary = normalizeText(row["Payment / Donation Secondary Reason"])
  const email = normalizeText(row["Customer Email"]).toLowerCase()
  const txnId = normalizeText(row["Transaction ID"])
  const date = parseTxnDate(row["Transaction Date"])
  const cls = classifyReason(reason)

  if (amount != null) totalAmount += amount
  if (date) dates.push(date)
  else if (normalizeText(row["Transaction Date"])) issues.unparseableDate += 1

  if (amount == null) issues.missingAmount += 1
  else if (amount === 0) issues.zeroAmount += 1
  else if (amount < 0) issues.negativeAmount += 1
  if (!email) issues.missingEmail += 1
  if (!txnId) issues.missingTxnId += 1
  if (!reason) issues.missingReason += 1

  bump(statuses, status || "(blank)", amount || 0)
  bump(amountTypes, amountType, amount || 0)
  bump(txnTypes, txnType, amount || 0)
  bump(paymentModes, mode, amount || 0)
  bump(reasons, reason || "(blank)", amount || 0)
  bump(families, cls.key, amount || 0)

  if (txnId) {
    if (!txnIdCounts.has(txnId)) txnIdCounts.set(txnId, [])
    txnIdCounts.get(txnId).push({
      row: i + 2,
      amount,
      amountType,
      status,
      reason,
      email,
      date,
    })
  }

  if (status === "refunded" || amount < 0) {
    refundRows.push({
      row: i + 2,
      amount,
      email,
      reason,
      secondary,
      status,
      txnId,
      date,
      refundReason: normalizeText(row["Refund Reason"]),
    })
  }
  if (status === "processing") processingRows.push({ row: i + 2, amount, email, reason, secondary, txnId, date })
  if (status && !["succeeded", "refunded", "processing"].includes(status)) {
    issues.unknownStatus[status] = (issues.unknownStatus[status] || 0) + 1
    failedRows.push({ row: i + 2, status, amount, email, reason })
  }

  const isQilName = /ladies|institur/i.test(reason) && !/junior|brother/i.test(reason)
  if (isQilName) {
    bump(qilReasons, reason, amount || 0)
    const secKey = secondary || "(none)"
    bump(qilSecondaries, secKey, amount || 0)
    const ys = `${cls.year || "unyearned"} | ${secKey}`
    bump(qilYearSecondary, ys, amount || 0)
    qilRows.push({
      row: i + 2,
      amount,
      amountType,
      status,
      email: email,
      name: normalizeText(row["Customer Name"]),
      reason,
      secondary,
      year: cls.year,
      offeringFamily: qilOfferingFamily(secondary),
      txnId,
      date,
      rec: normalizeText(row["Recurring Type"]),
      refundReason: normalizeText(row["Refund Reason"]),
    })
  }
}

dates.sort()
const multiLineTxns = [...txnIdCounts.entries()].filter(([, list]) => list.length > 1)
const exactDupes = [...txnIdCounts.entries()].filter(([, list]) => {
  if (list.length < 2) return false
  const keys = list.map((r) => `${r.amount}|${r.amountType}|${r.status}`)
  return new Set(keys).size < keys.length
})

const qilByYear = {}
for (const r of qilRows) {
  const y = r.year || "unyearned"
  if (!qilByYear[y]) qilByYear[y] = { count: 0, amount: 0, succeeded: 0, refunded: 0, processing: 0, offerings: {}, reasons: {}, emails: new Set() }
  const b = qilByYear[y]
  b.count += 1
  b.amount = Math.round((b.amount + (r.amount || 0)) * 100) / 100
  if (r.status === "succeeded") b.succeeded += 1
  if (r.status === "refunded") b.refunded += 1
  if (r.status === "processing") b.processing += 1
  b.offerings[r.secondary || "(none)"] = (b.offerings[r.secondary || "(none)"] || 0) + 1
  b.reasons[r.reason] = (b.reasons[r.reason] || 0) + 1
  if (r.email) b.emails.add(r.email)
}
for (const y of Object.keys(qilByYear)) {
  qilByYear[y].uniqueEmails = qilByYear[y].emails.size
  delete qilByYear[y].emails
}

const qilUnyearned = qilRows.filter((r) => !r.year)
const qil202627 = qilRows.filter((r) => r.year === "2026-2027")
const qilAfterAug24 = qil202627.filter((r) => r.date && r.date > "2026-08-24" && r.status !== "refunded")

const summary = {
  file: CSV,
  rowCount: rows.length,
  headers,
  totalAmount: Math.round(totalAmount * 100) / 100,
  minDate: dates[0] || null,
  maxDate: dates[dates.length - 1] || null,
  uniqueTxnIds: txnIdCounts.size,
  multiLineTxnCount: multiLineTxns.length,
  exactDupeTxnCount: exactDupes.length,
  statuses: Object.fromEntries(statuses),
  amountTypes: Object.fromEntries(amountTypes),
  txnTypes: Object.fromEntries(txnTypes),
  paymentModes: Object.fromEntries(paymentModes),
  families: Object.fromEntries(
    [...families.entries()].sort((a, b) => b[1].count - a[1].count)
  ),
  reasonCount: reasons.size,
  topReasons: [...reasons.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 40),
  issues,
  parseErrors: parsed.errors?.length || 0,
  qil: {
    rowCount: qilRows.length,
    byYear: qilByYear,
    reasonVariants: Object.fromEntries(qilReasons),
    secondaries: Object.fromEntries([...qilSecondaries.entries()].sort((a, b) => b[1].count - a[1].count)),
    yearSecondary: Object.fromEntries([...qilYearSecondary.entries()].sort()),
    unyearnedSample: qilUnyearned.slice(0, 20).map((r) => ({
      row: r.row,
      reason: r.reason,
      secondary: r.secondary,
      amount: r.amount,
      date: r.date,
      email: r.email,
      status: r.status,
    })),
    unyearnedCount: qilUnyearned.length,
    afterAug24: qilAfterAug24.map((r) => ({
      date: r.date,
      amount: r.amount,
      amountType: r.amountType,
      email: r.email,
      name: r.name,
      secondary: r.secondary,
      status: r.status,
      txnId: r.txnId,
    })),
    refunds: qilRows.filter((r) => r.status === "refunded" || (r.amount || 0) < 0).map((r) => ({
      date: r.date,
      amount: r.amount,
      email: r.email,
      secondary: r.secondary,
      year: r.year,
      txnId: r.txnId,
      refundReason: r.refundReason,
    })),
    processing: qilRows.filter((r) => r.status === "processing"),
  },
  refundSample: refundRows.slice(0, 15),
  refundCount: refundRows.length,
  processingCount: processingRows.length,
  processingSample: processingRows.slice(0, 10),
  failedRows: failedRows.slice(0, 15),
  multiLineSample: multiLineTxns.slice(0, 8).map(([id, list]) => ({ id, n: list.length, rows: list })),
}

mkdirSync(resolve(__dirname, "reports"), { recursive: true })
writeFileSync(resolve(__dirname, "reports/new-payment-csv-analysis.json"), JSON.stringify(summary, null, 2))

console.log(JSON.stringify({
  rowCount: summary.rowCount,
  headers: summary.headers,
  totalAmount: summary.totalAmount,
  minDate: summary.minDate,
  maxDate: summary.maxDate,
  uniqueTxnIds: summary.uniqueTxnIds,
  multiLineTxnCount: summary.multiLineTxnCount,
  statuses: summary.statuses,
  amountTypes: summary.amountTypes,
  families: summary.families,
  issues: summary.issues,
  qilByYear: summary.qil.byYear,
  qilReasonVariants: summary.qil.reasonVariants,
  qilSecondaries: summary.qil.secondaries,
  qilUnyearnedCount: summary.qil.unyearnedCount,
  qilUnyearnedSample: summary.qil.unyearnedSample,
  qilAfterAug24: summary.qil.afterAug24,
  qilRefunds: summary.qil.refunds,
  processingCount: summary.processingCount,
  refundCount: summary.refundCount,
  topReasons: summary.topReasons,
}, null, 2))
