/**
 * Labels and line-type rules for Programs → Reports → Add-ons.
 * Client-safe (no server imports).
 */

export type AddonReportPaymentStatus = "paid" | "partial" | "unpaid" | "refunded"

export type AddonReportRow = {
  id: string
  contactName: string
  contactProfileId: string | null
  contactEmail: string | null
  contactPhone: string | null
  participantName: string
  programId: string | null
  programName: string
  programKind: "academic" | "seasonal"
  offeringId: string | null
  offeringName: string
  offeringActivity: "active" | "closed"
  departmentId: string | null
  departmentName: string
  addonType: string
  quantity: number
  amountDue: number
  amountPaid: number
  balance: number
  status: AddonReportPaymentStatus
}

const CORE_FEE_LINE_TYPES = new Set([
  "registration_fee",
  "tuition",
  "season_fee",
  "program_fee",
])

const SKIP_ADDON_LINE_TYPES = new Set([
  "discount",
  "sibling_discount",
  "scholarship",
  "financial_assistance",
  "fa",
  "credit",
  "adjustment",
])

function titleCaseLabel(value: string) {
  const trimmed = value.trim().replace(/_/g, " ")
  if (!trimmed) return "Add-on"
  return trimmed.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function isSkippedAddonLineType(lineType: string | null | undefined) {
  return SKIP_ADDON_LINE_TYPES.has(String(lineType || "").toLowerCase())
}

export function isCoreProgramFeeLineType(lineType: string | null | undefined) {
  return CORE_FEE_LINE_TYPES.has(String(lineType || "").toLowerCase())
}

export function isAddonChargeType(chargeType: string | null | undefined) {
  const type = String(chargeType || "").toLowerCase()
  return type === "addon" || type === "fee"
}

export function resolveProgramAddonType(input: {
  label?: string | null
  lineType?: string | null
  chargeType?: string | null
  metadata?: Record<string, unknown> | null
  quote?: Record<string, unknown> | null
}): string {
  const meta = input.metadata || {}
  const quote = input.quote || {}
  const raw = [
    input.label,
    input.lineType,
    typeof meta.label === "string" ? meta.label : null,
    typeof meta.addon_kind === "string" ? meta.addon_kind : null,
    typeof quote.type === "string" ? quote.type : null,
    typeof quote.addon === "string" ? quote.addon : null,
    input.chargeType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (raw.includes("lunch")) return "Lunch"
  if (
    raw.includes("childcare") ||
    raw.includes("child care") ||
    raw.includes("before care") ||
    raw.includes("after care") ||
    raw.includes("extended care")
  ) {
    return "Childcare"
  }
  if (raw.includes("transaction")) return "Transaction fee"
  if (raw.includes("material")) return "Materials"
  if (raw.includes("uniform")) return "Uniforms"
  if (raw.includes("field trip") || raw.includes("fieldtrip")) {
    return "Field trip"
  }

  const label =
    (typeof meta.label === "string" && meta.label.trim()) ||
    input.label?.trim() ||
    input.lineType?.trim() ||
    "Add-on"
  return titleCaseLabel(label)
}
