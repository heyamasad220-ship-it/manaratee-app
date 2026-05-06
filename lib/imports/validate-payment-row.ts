export type PaymentImportRow = Record<string, any>

function getValue(row: PaymentImportRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim()
    }
  }

  return ""
}

export function validatePaymentRow(row: PaymentImportRow) {
  const errors: string[] = []

  const paymentDate = getValue(row, [
    "payment_date",
    "Payment Date",
    "payment date",
    "date",
    "Date",
  ])

  const amountRaw = getValue(row, ["amount", "Amount"])
  const source = getValue(row, [
  "source",
  "Source",
  "method",
  "Method",
  "payment_method",
  "Payment Method",
  "payment method",
])
  const senderName = getValue(row, [
    "sender_name",
    "Sender Name",
    "sender name",
    "name",
    "Name",
  ])
  const memo = getValue(row, ["memo", "Memo", "description", "Description"])
  const reference = getValue(row, [
    "reference",
    "Reference",
    "external_id",
    "External ID",
    "transaction_id",
    "Transaction ID",
  ])

  if (!paymentDate) {
    errors.push("Missing payment date")
  }

  if (paymentDate && Number.isNaN(Date.parse(paymentDate))) {
    errors.push("Invalid payment date")
  }

  if (!amountRaw) {
    errors.push("Missing amount")
  }

  const amount = Number(String(amountRaw).replace(/[$,]/g, ""))

  if (amountRaw && (Number.isNaN(amount) || amount <= 0)) {
    errors.push("Amount must be greater than 0")
  }


  if (!senderName && !memo && !reference) {
    errors.push("Need sender name, memo, reference, or external ID for matching")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}