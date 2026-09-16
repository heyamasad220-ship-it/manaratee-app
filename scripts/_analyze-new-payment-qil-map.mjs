/**
 * Map QIL-related Payment/Donation Reason values to years via dates.
 * Run: node scripts/_analyze-new-payment-qil-map.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
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
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function isQilRelated(reason) {
  const n = fold(reason)
  if (!n) return false
  if (/taekwondo|self defense|game night|istiqamah|sunday|little hearts|junior|camp|swimming|rijaal|companion/.test(n)) {
    if (/ladies/.test(n) && /taekwondo/.test(n)) return false
    if (!/quran institute/.test(n) && !/qil/.test(n) && !/mas quran/.test(n)) return false
  }
  return (
    /quran institute for ladies/.test(n) ||
    /quran institure for ladies/.test(n) ||
    /mas quran institute/.test(n) ||
    /ladies quran/.test(n) ||
    (/^qi /.test(n) || n.startsWith("qi  ") || n.startsWith("qi -")) ||
    /ajurrum/.test(n) ||
    n.includes("quran institute")
  )
}

const { data } = Papa.parse(readFileSync(CSV, "utf8"), {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
})

const byReason = new Map()
const qil2026Txns = []
const allQilTxns = []

for (let i = 0; i < data.length; i += 1) {
  const row = data[i]
  const reason = normalizeText(row["Payment / Donation Reason"])
  if (!isQilRelated(reason)) continue
  const amount = parseMoney(row.Amount)
  const date = parseTxnDate(row["Transaction Date"])
  const status = normalizeText(row.Status).toLowerCase()
  const secondary = normalizeText(row["Payment / Donation Secondary Reason"])
  const email = normalizeText(row["Customer Email"]).toLowerCase()
  const txnId = normalizeText(row["Transaction ID"])
  const amountType = normalizeText(row["Amount Type"])

  if (!byReason.has(reason)) {
    byReason.set(reason, {
      reason,
      count: 0,
      amount: 0,
      succeeded: 0,
      refunded: 0,
      processing: 0,
      minDate: null,
      maxDate: null,
      secondaries: new Map(),
      statuses: new Map(),
      emails: new Set(),
      txnIds: new Set(),
    })
  }
  const b = byReason.get(reason)
  b.count += 1
  b.amount = Math.round((b.amount + (amount || 0)) * 100) / 100
  if (status === "succeeded") b.succeeded += 1
  if (status === "refunded") b.refunded += 1
  if (status === "processing") b.processing += 1
  if (date && (!b.minDate || date < b.minDate)) b.minDate = date
  if (date && (!b.maxDate || date > b.maxDate)) b.maxDate = date
  const sec = secondary || "(none)"
  b.secondaries.set(sec, (b.secondaries.get(sec) || 0) + 1)
  b.statuses.set(status, (b.statuses.get(status) || 0) + 1)
  if (email) b.emails.add(email)
  if (txnId) b.txnIds.add(txnId)

  const rec = {
    row: i + 2,
    reason,
    secondary,
    amount,
    amountType,
    status,
    email,
    date,
    txnId,
    name: normalizeText(row["Customer Name"]),
  }
  allQilTxns.push(rec)
  if (/2026/.test(reason) && /ladies/i.test(reason) && !/2025-2026/.test(reason)) {
    qil2026Txns.push(rec)
  }
}

const reasons = [...byReason.values()]
  .map((b) => ({
    reason: b.reason,
    count: b.count,
    amount: b.amount,
    succeeded: b.succeeded,
    refunded: b.refunded,
    processing: b.processing,
    minDate: b.minDate,
    maxDate: b.maxDate,
    uniqueEmails: b.emails.size,
    uniqueTxnIds: b.txnIds.size,
    secondaries: Object.fromEntries([...b.secondaries.entries()].sort((a, b) => b[1] - a[1])),
  }))
  .sort((a, b) => b.count - a.count)

const qil2026Succeeded = qil2026Txns.filter((r) => r.status === "succeeded")
const qil2026After = qil2026Succeeded.filter((r) => r.date && r.date > "2026-08-24")
const qil2026Processing = qil2026Txns.filter((r) => r.status === "processing")
const qil2026Refunds = qil2026Txns.filter((r) => r.status === "refunded")

const missingEmail = allQilTxns.filter((r) => !r.email)
const missingTxn = allQilTxns.filter((r) => !r.txnId && r.status !== "refunded")

writeFileSync(
  resolve(__dirname, "reports/new-payment-qil-map.json"),
  JSON.stringify(
    {
      reasonCount: reasons.length,
      reasons,
      qil2026: {
        rows: qil2026Txns.length,
        succeeded: qil2026Succeeded.length,
        refunded: qil2026Refunds.length,
        processing: qil2026Processing,
        afterAug24: qil2026After,
        txnIds: [...new Set(qil2026Txns.map((r) => r.txnId).filter(Boolean))],
      },
      missingEmail: missingEmail.length,
      missingTxn: missingTxn.length,
    },
    null,
    2
  )
)

console.log(JSON.stringify({
  reasonCount: reasons.length,
  reasons: reasons.map((r) => ({
    reason: r.reason,
    count: r.count,
    amount: r.amount,
    succeeded: r.succeeded,
    refunded: r.refunded,
    minDate: r.minDate,
    maxDate: r.maxDate,
    uniqueEmails: r.uniqueEmails,
    secondaries: r.secondaries,
  })),
  qil2026Succeeded: qil2026Succeeded.length,
  qil2026Refunded: qil2026Refunds.length,
  qil2026Processing: qil2026Processing,
  qil2026AfterAug24: qil2026After,
  qil2026TxnIdCount: new Set(qil2026Txns.map((r) => r.txnId).filter(Boolean)).size,
  missingEmail: missingEmail.length,
  missingTxn: missingTxn.length,
}, null, 2))
