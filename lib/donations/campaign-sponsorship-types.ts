export const SPONSORSHIP_TYPES = ["cash", "in_kind", "mixed"] as const

export type SponsorshipType = (typeof SPONSORSHIP_TYPES)[number]

export const SPONSORSHIP_TYPE_LABELS: Record<SponsorshipType, string> = {
  cash: "Cash",
  in_kind: "In-Kind",
  mixed: "Mixed",
}

export const SPONSORSHIP_STATUSES = ["committed", "confirmed", "completed", "cancelled"] as const

export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number]

export const SPONSORSHIP_STATUS_LABELS: Record<SponsorshipStatus, string> = {
  committed: "Committed",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const SPONSORSHIP_PAYMENT_STATUSES = ["unpaid", "partial", "paid", "waived"] as const

export type SponsorshipPaymentStatus = (typeof SPONSORSHIP_PAYMENT_STATUSES)[number]

export const SPONSORSHIP_PAYMENT_STATUS_LABELS: Record<SponsorshipPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  waived: "Waived",
}

export const CUSTOM_SPONSORSHIP_PACKAGE_VALUE = "__custom__"

export type SponsorshipPackageRow = {
  id: string
  organization_id: string
  event_id: string
  name: string
  amount: number
  description: string | null
  display_order: number
  active: boolean
}

export type SponsorshipPackageWriteInput = {
  event_id: string
  name: string
  amount: number
  description?: string | null
  display_order?: number
  active?: boolean
}

export type CampaignLinkedEventOption = {
  id: string
  name: string
  startAt: string | null
  linkedToCampaign: boolean
}

export type CampaignSponsorshipRow = {
  id: string
  organization_id: string
  campaign_id: string
  event_id: string | null
  contact_id: string
  prospect_id: string | null
  sponsorship_package_id: string | null
  sponsorship_type: SponsorshipType
  committed_amount: number
  cash_amount: number
  in_kind_value: number
  status: SponsorshipStatus
  payment_status: SponsorshipPaymentStatus
  committed_date: string | null
  notes: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type CampaignSponsorshipListItem = CampaignSponsorshipRow & {
  contactName: string
  contactEmail: string | null
  eventName: string | null
  packageName: string | null
}

export type CampaignSponsorshipWriteInput = {
  contact_id: string
  event_id?: string | null
  prospect_id?: string | null
  sponsorship_package_id?: string | null
  sponsorship_type?: SponsorshipType
  committed_amount: number
  cash_amount?: number | null
  in_kind_value?: number | null
  status?: SponsorshipStatus
  payment_status?: SponsorshipPaymentStatus
  committed_date?: string | null
  notes?: string | null
}

export const CAMPAIGN_SPONSORSHIP_SELECT =
  "id, organization_id, campaign_id, event_id, contact_id, prospect_id, sponsorship_package_id, sponsorship_type, committed_amount, cash_amount, in_kind_value, status, payment_status, committed_date, notes, created_at, updated_at"

export const SPONSORSHIP_PACKAGE_SELECT =
  "id, organization_id, event_id, name, amount, description, display_order, active, created_at, updated_at"

export function isSponsorshipType(value: string): value is SponsorshipType {
  return (SPONSORSHIP_TYPES as readonly string[]).includes(value)
}

export function isSponsorshipStatus(value: string): value is SponsorshipStatus {
  return (SPONSORSHIP_STATUSES as readonly string[]).includes(value)
}

export function isSponsorshipPaymentStatus(value: string): value is SponsorshipPaymentStatus {
  return (SPONSORSHIP_PAYMENT_STATUSES as readonly string[]).includes(value)
}

export function normalizeSponsorshipType(value: string | null | undefined): SponsorshipType {
  const normalized = String(value || "cash").toLowerCase()
  return isSponsorshipType(normalized) ? normalized : "cash"
}

export function normalizeSponsorshipStatus(value: string | null | undefined): SponsorshipStatus {
  const normalized = String(value || "committed").toLowerCase()
  return isSponsorshipStatus(normalized) ? normalized : "committed"
}

export function normalizeSponsorshipPaymentStatus(
  value: string | null | undefined
): SponsorshipPaymentStatus {
  const normalized = String(value || "unpaid").toLowerCase()
  return isSponsorshipPaymentStatus(normalized) ? normalized : "unpaid"
}

export function formatCampaignEventOptionLabel(event: {
  name: string
  startAt: string | null
}): string {
  if (!event.startAt) return event.name
  const dateOnly = event.startAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  const date = dateOnly ? new Date(`${dateOnly}T00:00:00`) : new Date(event.startAt)
  if (Number.isNaN(date.getTime())) return event.name
  const when = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${event.name} — ${when}`
}

export function formatSponsorshipPackageOptionLabel(pkg: {
  name: string
  amount: number
}): string {
  const amount = Number(pkg.amount || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(pkg.amount || 0) % 1 === 0 ? 0 : 2,
  })
  return `${pkg.name} — ${amount}`
}
