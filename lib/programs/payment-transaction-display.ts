/** Labels for Programs → Reports → Transactions. */

export type PaymentTransactionStatus =
  | "Succeeded"
  | "Failed"
  | "Refunded"
  | "Voided"

function titleCaseLabel(value: string) {
  const trimmed = value.trim().replace(/_/g, " ")
  if (!trimmed) return "Payment"
  return trimmed.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function formatPaymentTransactionStatus(
  status: string | null | undefined
): PaymentTransactionStatus {
  const raw = String(status || "").toLowerCase().replace(/_/g, " ")
  if (raw.includes("refund")) {
    return "Refunded"
  }
  if (raw === "void" || raw === "voided") {
    return "Voided"
  }
  if (
    raw === "failed" ||
    raw === "declined" ||
    raw === "unresolved" ||
    raw.includes("declin")
  ) {
    return "Failed"
  }
  return "Succeeded"
}

export function formatPaymentMethodLabel(
  value: string | null | undefined
): string {
  const raw = String(value || "").trim()
  if (!raw) return "—"
  const lower = raw.toLowerCase().replace(/_/g, " ")
  if (
    lower.includes("stripe") ||
    lower.includes("credit card") ||
    lower.includes("card")
  ) {
    return "Credit Card"
  }
  if (lower === "cash") return "Cash"
  if (lower === "check") return "Check"
  if (lower === "zelle") return "Zelle"
  if (lower === "venmo") return "Venmo"
  if (lower === "paypal") return "PayPal"
  if (lower === "square") return "Square"
  if (lower === "ach" || lower.includes("bank")) return "Bank"
  if (lower === "import" || lower === "manual") return "—"
  return titleCaseLabel(raw)
}

export function resolveProgramPaymentType(input: {
  chargeCategory?: string | null
  chargeType?: string | null
  label?: string | null
  metadata?: Record<string, unknown> | null
  quote?: Record<string, unknown> | null
}): string {
  const meta = input.metadata || {}
  const quote = input.quote || {}
  const metaLabel = typeof meta.label === "string" ? meta.label : null
  const quoteType = typeof quote.type === "string" ? quote.type : null
  const blob = [
    input.label,
    metaLabel,
    input.chargeCategory,
    input.chargeType,
    quoteType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (blob.includes("late")) return "Late fee"
  if (blob.includes("lunch")) return "Lunch fee"
  if (
    blob.includes("childcare") ||
    blob.includes("child care") ||
    blob.includes("before care") ||
    blob.includes("after care") ||
    blob.includes("extended care")
  ) {
    return "Childcare"
  }
  if (blob.includes("transaction")) return "Transaction fee"
  if (blob.includes("material")) return "Materials"

  const category = String(input.chargeCategory || "").toLowerCase()
  const chargeType = String(input.chargeType || "").toLowerCase()
  if (category === "tuition" || blob.includes("tuition")) return "Program Fee"
  if (
    category === "registration_fee" ||
    chargeType === "registration" ||
    blob.includes("registration")
  ) {
    return "Registration"
  }
  if (category === "addon" || chargeType === "addon" || chargeType === "fee") {
    return titleCaseLabel(input.label || metaLabel || "Additional fee")
  }
  if (category === "adjustment" || chargeType === "adjustment") {
    return "Adjustment"
  }

  return titleCaseLabel(
    input.label || metaLabel || category || chargeType || "Payment"
  )
}

export function resolveProgramPaymentMethod(input: {
  scheduleMetadata?: Record<string, unknown> | null
  chargeMetadata?: Record<string, unknown> | null
  checkoutId?: string | null
}): string {
  const schedule = input.scheduleMetadata || {}
  const charge = input.chargeMetadata || {}
  const raw =
    (typeof schedule.payment_method === "string" && schedule.payment_method) ||
    (typeof schedule.method === "string" && schedule.method) ||
    (typeof charge.payment_method === "string" && charge.payment_method) ||
    (typeof charge.payment_mode === "string" && charge.payment_mode) ||
    (typeof charge.method === "string" && charge.method) ||
    null

  if (raw) return formatPaymentMethodLabel(raw)
  if (input.checkoutId) return "Credit Card"
  return "—"
}
