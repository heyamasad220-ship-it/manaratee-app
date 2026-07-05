import { isImportedPayment } from "@/lib/donations/payment-net-amount"

export const MAS_LEDGER_IMPORT_TAG = "MAS_CAMPAIGN_LEDGER_V1"

export function parseContactTimelineResetAt(
  value: string | null | undefined
): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

export function isTimelineEventVisible(
  eventDate: string | null | undefined,
  resetAt: string | null
): boolean {
  if (!resetAt) return true
  if (!eventDate) return false
  return new Date(eventDate).getTime() >= new Date(resetAt).getTime()
}

export function isImportTimelinePayment(payment: {
  source?: string | null
  source_type?: string | null
  import_batch_id?: string | null
  memo?: string | null
}): boolean {
  if (isImportedPayment(payment)) return true
  if (String(payment.source || "").toLowerCase() === "import") return true
  const memo = String(payment.memo || "")
  return memo.includes(MAS_LEDGER_IMPORT_TAG)
}

export function isImportTimelinePledge(pledge: { notes?: string | null }): boolean {
  return String(pledge.notes || "").includes(MAS_LEDGER_IMPORT_TAG)
}

export function shouldIncludeInContactTimeline(
  eventDate: string | null | undefined,
  resetAt: string | null,
  options: { imported?: boolean } = {}
): boolean {
  if (options.imported) return false
  return isTimelineEventVisible(eventDate, resetAt)
}
