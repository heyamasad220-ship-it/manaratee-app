/**
 * One-off analysis of Program_PAYMENT_TRANSACTION_REPORT.csv.
 * Run: node scripts/_analyze-program-payment-csv.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV = "C:/Users/danan/Downloads/Program_PAYMENT_TRANSACTION_REPORT.csv"
const OUT_DIR = resolve(__dirname, "reports")

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

function parseMoney(value) {
  if (value == null || value === "") return null
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function parseTxnDate(value) {
  const text = normalizeText(value).replace(
    /\s+(CDT|CST|EDT|EST|PDT|PST|MDT|MST|UTC)$/i,
    ""
  )
  if (!text) return { date: null, iso: null, raw: value }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return { date: null, iso: null, raw: value }
  return { date: parsed.toISOString().slice(0, 10), iso: parsed.toISOString(), raw: value }
}

function extractField(remarks, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Registration Fees|Subscription Fees|Subscription Discount|Add-Ons Amount|Coupon Code|Registration Coupon Value|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
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
        .map((item) => normalizeText(item.replace(/\biphone\b/gi, " ").replace(/\bipad\b/gi, " ")))
        .filter(Boolean)
    : []
  return {
    hasRemarks: Boolean(text),
    members,
    registrationFees: parseMoney(extractField(text, "Registration Fees")) || 0,
    subscriptionFees: parseMoney(extractField(text, "Subscription Fees")) || 0,
    addOns: parseMoney(extractField(text, "Add-Ons Amount")) || 0,
    couponCode: normalizeText(extractField(text, "Coupon Code")).toUpperCase(),
    registrationCoupon: parseMoney(extractField(text, "Registration Coupon Value")) || 0,
    subscriptionCoupon: parseMoney(extractField(text, "Subscription Coupon Value")) || 0,
    isFullPayment: extractField(text, "Is Full Payment Made"),
  }
}

function classifyProgram(name) {
  const n = foldName(name)
  if (!n) return { family: "blank", year: null }
  if (/summer camp/.test(n)) {
    const y = n.match(/20(\d{2})/)
    return { family: "summer_camp", year: y ? `20${y[1]}` : null }
  }
  if (/quran institute junior|qij/.test(n)) {
    const y = n.match(/(\d{2})\s*-?\s*(\d{2})/)
    return { family: "qij", year: y ? `20${y[1]}-20${y[2]}` : null }
  }
  if (/quran institur?e for ladies|qil/.test(n) && !/junior/.test(n) && !/games/.test(n)) {
    const y = n.match(/(\d{4})\s*-?\s*(\d{4}|\d{2})/) || n.match(/(\d{2})\s*-?\s*(\d{2})/)
    if (y && y[1].length === 4) {
      const end = y[2].length === 2 ? `20${y[2]}` : y[2]
      return { family: "qil", year: `${y[1]}-${end}` }
    }
    if (y) return { family: "qil", year: `20${y[1]}-20${y[2]}` }
    return { family: "qil", year: null }
  }
  if (/quran 4 little|quran for little|qlh/.test(n)) {
    const y = n.match(/(\d{2})\s*-?\s*(\d{2})/) || n.match(/(\d{4})\s*-?\s*(\d{4}|\d{2})/)
    if (y && y[1].length === 4) {
      const end = y[2].length === 2 ? `20${y[2]}` : y[2]
      return { family: "qlh", year: `${y[1]}-${end}` }
    }
    if (y) return { family: "qlh", year: `20${y[1]}-20${y[2]}` }
    return { family: "qlh", year: null }
  }
  if (/sunday school/.test(n)) {
    const y = n.match(/(\d{2,4})\s*-?\s*(\d{2,4})/)
    if (y) {
      const a = y[1].length === 2 ? `20${y[1]}` : y[1]
      const b = y[2].length === 2 ? `20${y[2]}` : y[2]
      return { family: "sunday_school", year: `${a}-${b}` }
    }
    return { family: "sunday_school", year: null }
  }
  return { family: "other", year: null }
}

const text = readFileSync(CSV, "utf8")
const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })
const headers = parsed.meta.fields || []
const rows = parsed.data

const issues = {
  missingAmount: [],
  zeroAmount: [],
  negativeAmount: [],
  missingName: [],
  missingEmail: [],
  missingPhone: [],
  missingProgram: [],
  missingTxnDate: [],
  unparseableTxnDate: [],
  missingRemarks: [],
  remarksNoMembers: [],
  amountVsFeesMismatch: [],
  trailingSpacesProgram: [],
  likelyTypos: [],
}

const programs = new Map()
const familyYear = new Map()
const emails = new Set()
const phones = new Set()
const internalDupes = new Map()
const dates = []
const recurringTypes = new Map()
const reasons = new Map()
let totalAmount = 0
let amountAbs = 0

function bump(map, key, amount) {
  const cur = map.get(key) || { count: 0, amount: 0 }
  cur.count += 1
  cur.amount = Math.round((cur.amount + (amount || 0)) * 100) / 100
  map.set(key, cur)
}

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i]
  const rowNumber = i + 2
  const amount = parseMoney(row.Amount)
  const name = normalizeText(row["Customer Name"])
  const email = normalizeText(row["Customer Email"]).toLowerCase()
  const phone = normalizeText(row["Customer Phone"])
  const program = normalizeText(row.Program)
  const txn = parseTxnDate(row["Transaction Date"])
  const remarksRaw = row["Payment Remarks"]
  const remarks = parseRemarks(remarksRaw)
  const rec = normalizeText(row["Recurring Type"]).toUpperCase()
  const reason = normalizeText(row["Payment / Donation Secondary Reason"])
  const cls = classifyProgram(program)

  if (email) emails.add(email)
  if (phone) phones.add(phone)
  if (txn.date) dates.push(txn.date)
  if (amount != null) {
    totalAmount += amount
    amountAbs += Math.abs(amount)
  }

  bump(recurringTypes, rec || "(blank)", amount || 0)
  if (reason) bump(reasons, reason, amount || 0)

  const pKey = program || "(blank)"
  if (!programs.has(pKey)) {
    programs.set(pKey, {
      name: pKey,
      rawDistinct: new Set(),
      family: cls.family,
      year: cls.year,
      count: 0,
      amount: 0,
      absAmount: 0,
      minDate: null,
      maxDate: null,
      missingEmail: 0,
      missingPhone: 0,
      missingRemarks: 0,
      noMembers: 0,
      fullPaymentYes: 0,
      fullPaymentNo: 0,
      coupons: new Map(),
      recurring: new Map(),
    })
  }
  const p = programs.get(pKey)
  p.rawDistinct.add(String(row.Program ?? ""))
  p.count += 1
  p.amount = Math.round((p.amount + (amount || 0)) * 100) / 100
  p.absAmount = Math.round((p.absAmount + Math.abs(amount || 0)) * 100) / 100
  if (txn.date) {
    if (!p.minDate || txn.date < p.minDate) p.minDate = txn.date
    if (!p.maxDate || txn.date > p.maxDate) p.maxDate = txn.date
  }
  if (!email) p.missingEmail += 1
  if (!phone) p.missingPhone += 1
  if (!remarks.hasRemarks) p.missingRemarks += 1
  if (!remarks.members.length) p.noMembers += 1
  if (/^yes$/i.test(remarks.isFullPayment)) p.fullPaymentYes += 1
  if (/^no$/i.test(remarks.isFullPayment)) p.fullPaymentNo += 1
  if (remarks.couponCode) bump(p.coupons, remarks.couponCode, amount || 0)
  bump(p.recurring, rec || "(blank)", amount || 0)

  const fy = `${cls.family}|${cls.year || "unknown"}`
  if (!familyYear.has(fy)) familyYear.set(fy, { family: cls.family, year: cls.year, count: 0, amount: 0, programs: new Set() })
  const f = familyYear.get(fy)
  f.count += 1
  f.amount = Math.round((f.amount + (amount || 0)) * 100) / 100
  f.programs.add(pKey)

  if (amount == null) issues.missingAmount.push(rowNumber)
  else if (amount === 0) issues.zeroAmount.push({ rowNumber, program, name, email })
  else if (amount < 0) issues.negativeAmount.push({ rowNumber, amount, program, name, email, date: txn.date })

  if (!name) issues.missingName.push(rowNumber)
  if (!email) issues.missingEmail.push({ rowNumber, name, program })
  if (!phone) issues.missingPhone.push({ rowNumber, name, email, program })
  if (!program) issues.missingProgram.push({ rowNumber, name, email })
  if (!normalizeText(row["Transaction Date"])) issues.missingTxnDate.push(rowNumber)
  else if (!txn.date) issues.unparseableTxnDate.push({ rowNumber, raw: row["Transaction Date"] })
  if (!remarks.hasRemarks) issues.missingRemarks.push({ rowNumber, name, program })
  if (remarks.hasRemarks && !remarks.members.length) {
    issues.remarksNoMembers.push({ rowNumber, name, program, remarks: String(remarksRaw).slice(0, 120) })
  }

  if (program !== String(row.Program ?? "") && String(row.Program ?? "").length) {
    issues.trailingSpacesProgram.push({ rowNumber, raw: JSON.stringify(row.Program) })
  } else if (String(row.Program ?? "").endsWith(" ") || String(row.Program ?? "").startsWith(" ")) {
    issues.trailingSpacesProgram.push({ rowNumber, raw: JSON.stringify(row.Program) })
  }

  if (/institur/.test(foldName(program))) {
    issues.likelyTypos.push({ rowNumber, program, name, email })
  }

  const feesSum = Math.round((remarks.registrationFees + remarks.subscriptionFees + remarks.addOns) * 100) / 100
  const couponSum = Math.round((remarks.registrationCoupon + remarks.subscriptionCoupon) * 100) / 100
  if (amount != null && remarks.hasRemarks && feesSum > 0) {
    const expectedNet = Math.round((feesSum - couponSum) * 100) / 100
    if (Math.abs(expectedNet - amount) > 0.05 && Math.abs(remarks.subscriptionFees - amount) > 0.05) {
      issues.amountVsFeesMismatch.push({
        rowNumber,
        amount,
        feesSum,
        couponSum,
        expectedNet,
        program,
        name,
        members: remarks.members,
      })
    }
  }

  const dupeKey = [email || name.toLowerCase(), amount, txn.date, foldName(program), foldName(remarks.members.join(","))].join("|")
  if (!internalDupes.has(dupeKey)) internalDupes.set(dupeKey, [])
  internalDupes.get(dupeKey).push({ rowNumber, name, email, amount, date: txn.date, program })
}

dates.sort()
const actualDupes = [...internalDupes.entries()].filter(([, list]) => list.length > 1)

const programList = [...programs.values()]
  .map((p) => ({
    name: p.name,
    family: p.family,
    year: p.year,
    count: p.count,
    amount: p.amount,
    absAmount: p.absAmount,
    minDate: p.minDate,
    maxDate: p.maxDate,
    missingEmail: p.missingEmail,
    missingPhone: p.missingPhone,
    missingRemarks: p.missingRemarks,
    noMembers: p.noMembers,
    fullPaymentYes: p.fullPaymentYes,
    fullPaymentNo: p.fullPaymentNo,
    rawVariants: [...p.rawDistinct],
    couponCount: p.coupons.size,
    topCoupons: [...p.coupons.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8),
    recurring: Object.fromEntries([...p.recurring.entries()].map(([k, v]) => [k, v])),
  }))
  .sort((a, b) => b.count - a.count)

const focusFamilies = ["summer_camp", "qil", "qlh", "sunday_school"]
const focus = programList.filter((p) => focusFamilies.includes(p.family))
const other = programList.filter((p) => !focusFamilies.includes(p.family))

const extraColumns = headers.filter(
  (h) =>
    ![
      "Amount",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Payment / Donation Secondary Reason",
      "Payment Remarks",
      "Program",
      "Recurring Type",
      "Schedule Transaction Date",
      "Transaction Date",
    ].includes(h)
)

const sampleTypos = issues.likelyTypos.slice(0, 20)
const sampleMismatch = issues.amountVsFeesMismatch.slice(0, 25)
const sampleNoMembers = issues.remarksNoMembers.slice(0, 15)
const sampleNeg = issues.negativeAmount.slice(0, 20)
const sampleZero = issues.zeroAmount.slice(0, 15)

const summary = {
  file: CSV,
  rowCount: rows.length,
  headers,
  extraColumns,
  hasStatus: headers.includes("Status"),
  hasTransactionId: headers.includes("Transaction ID") || headers.includes("Transaction Id"),
  hasRefundReason: headers.includes("Refund Reason"),
  hasPaymentMode: headers.includes("Payment Mode"),
  uniqueEmails: emails.size,
  uniquePhones: phones.size,
  totalAmount: Math.round(totalAmount * 100) / 100,
  absAmount: Math.round(amountAbs * 100) / 100,
  minDate: dates[0] || null,
  maxDate: dates[dates.length - 1] || null,
  parseErrors: parsed.errors?.length || 0,
  parseErrorSample: (parsed.errors || []).slice(0, 10),
  recurringTypes: Object.fromEntries([...recurringTypes.entries()]),
  programCount: programs.size,
  familyYear: [...familyYear.values()].map((f) => ({
    family: f.family,
    year: f.year,
    count: f.count,
    amount: f.amount,
    programs: [...f.programs],
  })),
  focusPrograms: focus,
  otherPrograms: other,
  issueCounts: Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])),
  internalExactDupes: actualDupes.length,
  internalExactDupeRows: actualDupes.reduce((n, [, list]) => n + list.length, 0),
  internalDupeSample: actualDupes.slice(0, 15).map(([key, list]) => ({ key, rows: list })),
  sampleTypos,
  sampleMismatch,
  sampleNoMembers,
  sampleNeg,
  sampleZero,
  missingEmailSample: issues.missingEmail.slice(0, 15),
  missingPhoneSample: issues.missingPhone.slice(0, 10),
  missingProgramSample: issues.missingProgram.slice(0, 10),
  unparseableDateSample: issues.unparseableTxnDate.slice(0, 10),
  trailingSpacesSample: issues.trailingSpacesProgram.slice(0, 10),
  topReasons: [...reasons.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 25),
}

mkdirSync(OUT_DIR, { recursive: true })
const outPath = resolve(OUT_DIR, "program-payment-csv-analysis.json")
writeFileSync(outPath, JSON.stringify(summary, null, 2))

console.log(JSON.stringify({
  rowCount: summary.rowCount,
  headers: summary.headers,
  hasStatus: summary.hasStatus,
  hasTransactionId: summary.hasTransactionId,
  totalAmount: summary.totalAmount,
  minDate: summary.minDate,
  maxDate: summary.maxDate,
  programCount: summary.programCount,
  uniqueEmails: summary.uniqueEmails,
  issueCounts: summary.issueCounts,
  internalExactDupes: summary.internalExactDupes,
  familyYear: summary.familyYear,
  focusPrograms: summary.focusPrograms.map((p) => ({
    name: p.name,
    family: p.family,
    year: p.year,
    count: p.count,
    amount: p.amount,
    minDate: p.minDate,
    maxDate: p.maxDate,
    rawVariants: p.rawVariants,
  })),
  otherPrograms: summary.otherPrograms.map((p) => ({
    name: p.name,
    count: p.count,
    amount: p.amount,
    minDate: p.minDate,
    maxDate: p.maxDate,
  })),
}, null, 2))
console.error(`Wrote ${outPath}`)
