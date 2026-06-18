import { normalizePaymentSourceChannel } from "@/lib/donations/payment-source-channel"

export type ParsedPaymentCsvRow = {
  sender_name: string
  amount: string
  payment_date: string
  reference: string
  email: string
  phone: string
  source: string
  campaign?: string
  category?: string
  fund?: string
}

export function normalizeText(value: string | undefined | null) {
  return (value || "").trim()
}

export function normalizeAmount(value: string | undefined | null) {
  const cleaned = normalizeText(value).replace(/[$,]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeDate(value: string | undefined | null) {
  const text = normalizeText(value)
  if (!text) return ""

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return text

  return parsed.toISOString().slice(0, 10)
}

export function normalizeEmail(value: string | undefined | null) {
  return normalizeText(value).toLowerCase()
}

export function normalizePhone(value: string | undefined | null) {
  return normalizeText(value).replace(/\D/g, "")
}

export function makePaymentDuplicateKey(row: {
  sender_name: string | null
  amount: number | null
  payment_date: string | null
  memo?: string | null
}) {
  return [
    (row.sender_name || "").trim().toLowerCase(),
    Number(row.amount || 0).toFixed(2),
    (row.payment_date || "").slice(0, 10),
    (row.memo || "").trim().toLowerCase(),
  ].join("|")
}

function pickField(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeText(row[key])
    if (value) return value
  }
  return ""
}

export function parsePaymentCsvRow(row: Record<string, string>): ParsedPaymentCsvRow {
  const senderName = pickField(row, [
    "sender_name",
    "Sender Name",
    "sender",
    "name",
    "Name",
    "donor_name",
    "Donor Name",
  ])

  const rawSource = pickField(row, ["source", "Source", "payment_method", "Payment Method", "method", "Method"])

  return {
    sender_name: senderName,
    amount: pickField(row, ["amount", "Amount", "payment_amount", "Payment Amount"]),
    payment_date: pickField(row, ["payment_date", "Payment Date", "date", "Date"]),
    reference: pickField(row, [
      "reference",
      "Reference",
      "memo",
      "Memo",
      "description",
      "Description",
      "transaction_id",
      "Transaction ID",
    ]),
    email: pickField(row, ["email", "Email", "sender_email", "Sender Email"]),
    phone: pickField(row, ["phone", "Phone", "sender_phone", "Sender Phone", "mobile", "Mobile"]),
    source: rawSource ? normalizePaymentSourceChannel(rawSource) : "import",
    campaign: pickField(row, ["campaign", "Campaign", "campaign_name", "Campaign Name"]) || undefined,
    category: pickField(row, ["category", "Category", "category_name", "Category Name"]) || undefined,
    fund: pickField(row, ["fund", "Fund", "subcategory", "Subcategory", "fund_name", "Fund Name"]) || undefined,
  }
}

export function validatePaymentCsvRow(row: ParsedPaymentCsvRow) {
  const problems: string[] = []

  if (!normalizeText(row.sender_name)) problems.push("Missing sender name")
  if (normalizeAmount(row.amount) <= 0) problems.push("Missing or invalid amount")

  return {
    valid: problems.length === 0,
    problems,
  }
}

export function parsePaymentCsvRows(rawRows: Record<string, string>[]) {
  return rawRows.map(parsePaymentCsvRow)
}

/** Rows per server-action request — keeps payloads under Next.js body limits. */
export const PAYMENT_CSV_IMPORT_CHUNK_SIZE = 100

export function dedupeValidPaymentCsvRows(rows: ParsedPaymentCsvRow[]) {
  const seen = new Set<string>()
  const unique: ParsedPaymentCsvRow[] = []
  let duplicates = 0

  for (const row of rows) {
    if (!validatePaymentCsvRow(row).valid) continue

    const key = makePaymentDuplicateKey({
      sender_name: normalizeText(row.sender_name),
      amount: normalizeAmount(row.amount),
      payment_date: normalizeDate(row.payment_date),
      memo: normalizeText(row.reference),
    })

    if (seen.has(key)) {
      duplicates += 1
      continue
    }

    seen.add(key)
    unique.push(row)
  }

  return { unique, duplicates }
}
