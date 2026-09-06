/**
 * Compare Program_PAYMENT_TRANSACTION_REPORT.csv focus programs vs DB overlap keys.
 * Run: node scripts/_analyze-program-payment-csv-focus.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV = "C:/Users/danan/Downloads/Program_PAYMENT_TRANSACTION_REPORT.csv"

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
function extractField(remarks, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Registration Fees|Subscription Fees|Subscription Discount|Add-Ons Amount|Coupon Code|Registration Coupon Value|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
    "i"
  )
  const match = re.exec(remarks || "")
  return match ? normalizeText(match[1]) : ""
}

function classify(name) {
  const n = fold(name)
  if (/quran institure for ladies|quran institute for ladies|\bqil\b/.test(n) && !/junior/.test(n)) {
    if (/2026/.test(n)) return "qil_2026_27"
    if (/2025/.test(n)) return "qil_2025_26"
    return "qil_other"
  }
  if (/quran 4 little|quran for little|\bqlh\b/.test(n)) {
    if (/26\s*27|2026/.test(n)) return "qlh_2026_27"
    if (/25\s*26|2025/.test(n) && !/2024/.test(n)) return "qlh_2025_26"
    if (/2024|24\s*25/.test(n)) return "qlh_2024_25"
    return "qlh_other"
  }
  if (/sunday school/.test(n) && /lunch/.test(n)) return "ss_lunch"
  if (/muhsen sunday/.test(n)) return "ss_muhsen"
  if (/sunday school/.test(n)) {
    if (/26\s*27|2026/.test(n)) return "ss_2026_27"
    if (/25\s*26|2025/.test(n) && !/2024/.test(n)) return "ss_2025_26"
    if (/2024|24/.test(n)) return "ss_2024_25"
    return "ss_other"
  }
  if (/2026 mas summer camp (one|two)/.test(n)) return "camp_2026_main"
  if (/youth intensive summer camp 2026/.test(n)) return "camp_2026_youth"
  if (/special needs summer camp/.test(n)) return "camp_special_needs"
  if (/2025 mas summer/.test(n) || /youth intensive summer camp 2025/.test(n)) return "camp_2025"
  return "other"
}

const text = readFileSync(CSV, "utf8")
const { data } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })

const buckets = {}
const zeroByProgram = {}
const afterCutoff = { qil_2026_27: [], camp_2026_main: [], ss_2026_27: [], qlh_2026_27: [] }

for (let i = 0; i < data.length; i += 1) {
  const row = data[i]
  const program = normalizeText(row.Program)
  const cls = classify(program)
  const amount = parseMoney(row.Amount)
  const date = parseTxnDate(row["Transaction Date"])
  const email = normalizeText(row["Customer Email"]).toLowerCase()
  const name = normalizeText(row["Customer Name"])
  const members = extractField(row["Payment Remarks"], "Registered Members")
  const coupon = extractField(row["Payment Remarks"], "Coupon Code")
  const rec = normalizeText(row["Recurring Type"]).toUpperCase()
  const reason = normalizeText(row["Payment / Donation Secondary Reason"])

  if (!buckets[cls]) buckets[cls] = { count: 0, amount: 0, zero: 0, programs: {}, rows: [] }
  const b = buckets[cls]
  b.count += 1
  b.amount = Math.round((b.amount + (amount || 0)) * 100) / 100
  if (amount === 0) {
    b.zero += 1
    zeroByProgram[program] = (zeroByProgram[program] || 0) + 1
  }
  b.programs[program] = (b.programs[program] || 0) + 1
  if (cls !== "other" && cls !== "camp_2025" && cls !== "ss_lunch" && cls !== "ss_2025_26" && cls !== "ss_2024_25") {
    b.rows.push({
      row: i + 2,
      date,
      amount,
      email,
      name,
      program,
      rec,
      coupon,
      reason,
      members,
    })
  }

  if (cls === "qil_2026_27" && date && date > "2026-08-24") afterCutoff.qil_2026_27.push({ date, amount, email, name, program })
  if (cls === "camp_2026_main" && date && date > "2026-07-21") afterCutoff.camp_2026_main.push({ date, amount, email, name, program })
  if (cls === "ss_2026_27" && date && date > "2026-07-30") afterCutoff.ss_2026_27.push({ date, amount, email, name, program })
}

const summary = {}
for (const [k, v] of Object.entries(buckets)) {
  summary[k] = {
    count: v.count,
    amount: v.amount,
    zero: v.zero,
    programs: v.programs,
    sample: (v.rows || []).slice(0, 8),
    dateRange: v.rows?.length
      ? {
          min: v.rows.map((r) => r.date).filter(Boolean).sort()[0],
          max: v.rows.map((r) => r.date).filter(Boolean).sort().at(-1),
        }
      : null,
  }
}

const qilKeys = (buckets.qil_2026_27?.rows || []).map((r) => ({
  email: r.email,
  date: r.date,
  amount: r.amount,
  name: r.name,
  program: r.program,
  coupon: r.coupon,
}))
const ssKeys = (buckets.ss_2026_27?.rows || []).map((r) => ({
  email: r.email,
  date: r.date,
  amount: r.amount,
  name: r.name,
  members: r.members,
  coupon: r.coupon,
  rec: r.rec,
}))
const qlh26 = (buckets.qlh_2026_27?.rows || []).map((r) => ({
  email: r.email,
  date: r.date,
  amount: r.amount,
  name: r.name,
  members: r.members,
  coupon: r.coupon,
  rec: r.rec,
  reason: r.reason,
}))
const campKeys = (buckets.camp_2026_main?.rows || []).map((r) => ({
  email: r.email,
  date: r.date,
  amount: r.amount,
  name: r.name,
  program: r.program,
}))

const out = {
  totalsByClass: Object.fromEntries(
    Object.entries(summary).map(([k, v]) => [k, { count: v.count, amount: v.amount, zero: v.zero, programs: v.programs, dateRange: v.dateRange }])
  ),
  zeroByProgram,
  afterCutoff,
  qil_2026_27: qilKeys,
  ss_2026_27: ssKeys,
  qlh_2026_27: qlh26,
  camp_2026_main_count: campKeys.length,
  camp_2026_main_amount: buckets.camp_2026_main?.amount,
  camp_2026_zero: buckets.camp_2026_main?.zero,
}

writeFileSync(resolve(__dirname, "reports/program-payment-csv-focus.json"), JSON.stringify(out, null, 2))
console.log(JSON.stringify({
  totalsByClass: out.totalsByClass,
  zeroByProgram,
  afterCutoffCounts: Object.fromEntries(Object.entries(afterCutoff).map(([k, v]) => [k, v.length])),
  qilRowCount: qilKeys.length,
  ssRowCount: ssKeys.length,
  qlh26RowCount: qlh26.length,
  qlh26Amount: buckets.qlh_2026_27?.amount,
  qlh26Zero: buckets.qlh_2026_27?.zero,
  ssRows: ssKeys,
}, null, 2))
