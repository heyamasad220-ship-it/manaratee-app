export const WISHLIST_ITEM_TYPES = [
  "facility",
  "renovation",
  "equipment",
  "technology",
  "education",
  "youth",
  "programming",
  "staffing",
  "community_services",
  "other",
] as const

export type WishlistItemType = (typeof WISHLIST_ITEM_TYPES)[number]

export const WISHLIST_ITEM_TYPE_LABELS: Record<WishlistItemType, string> = {
  facility: "Facility",
  renovation: "Renovation",
  equipment: "Equipment",
  technology: "Technology",
  education: "Education",
  youth: "Youth",
  programming: "Programming",
  staffing: "Staffing",
  community_services: "Community Services",
  other: "Other",
}

export const WISHLIST_PRIORITIES = ["high", "medium", "low"] as const
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number]

export const WISHLIST_PRIORITY_LABELS: Record<WishlistPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export const WISHLIST_PROJECT_STATUSES = [
  "planned",
  "approved",
  "in_progress",
  "completed",
  "on_hold",
  "cancelled",
] as const

export type WishlistProjectStatus = (typeof WISHLIST_PROJECT_STATUSES)[number]

export const WISHLIST_PROJECT_STATUS_LABELS: Record<WishlistProjectStatus, string> = {
  planned: "Planned",
  approved: "Approved",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
}

export const WISHLIST_FUNDING_STATUSES = [
  "not_funded",
  "partially_funded",
  "fully_funded",
  "overfunded",
] as const

export type WishlistFundingStatus = (typeof WISHLIST_FUNDING_STATUSES)[number]

export const WISHLIST_FUNDING_STATUS_LABELS: Record<WishlistFundingStatus, string> = {
  not_funded: "Not Funded",
  partially_funded: "Partially Funded",
  fully_funded: "Fully Funded",
  overfunded: "Overfunded",
}

export const CAMPAIGN_WISHLIST_SELECT = [
  "id",
  "organization_id",
  "campaign_id",
  "name",
  "item_type",
  "description",
  "target_amount",
  "priority",
  "project_status",
  "target_completion_date",
  "actual_completion_date",
  "completion_notes",
  "fund_id",
  "department_id",
  "campaign_phase_id",
  "public_visible",
  "public_token",
  "link_active",
  "carry_forward_enabled",
  "carried_from_item_id",
  "carried_to_item_id",
  "previous_funding_amount",
  "remaining_need_at_carry_forward",
  "sort_order",
  "notes",
  "image_url",
  "archived_at",
  "created_at",
  "updated_at",
].join(", ")

export type CampaignWishlistItemRow = {
  id: string
  organization_id: string
  campaign_id: string
  name: string
  item_type: WishlistItemType
  description: string | null
  target_amount: number
  priority: WishlistPriority
  project_status: WishlistProjectStatus
  target_completion_date: string | null
  actual_completion_date: string | null
  completion_notes: string | null
  fund_id: string | null
  department_id: string | null
  campaign_phase_id: string | null
  public_visible: boolean
  public_token: string
  link_active: boolean
  carry_forward_enabled: boolean
  carried_from_item_id: string | null
  carried_to_item_id: string | null
  previous_funding_amount: number
  remaining_need_at_carry_forward: number | null
  sort_order: number
  notes: string | null
  image_url: string | null
  archived_at: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type CampaignWishlistWriteInput = {
  name: string
  item_type?: WishlistItemType | string
  description?: string | null
  target_amount: number
  priority?: WishlistPriority | string
  project_status?: WishlistProjectStatus | string
  target_completion_date?: string | null
  actual_completion_date?: string | null
  completion_notes?: string | null
  fund_id?: string | null
  department_id?: string | null
  campaign_phase_id?: string | null
  public_visible?: boolean
  link_active?: boolean
  carry_forward_enabled?: boolean
  sort_order?: number
  notes?: string | null
  image_url?: string | null
}

export type WishlistFundingTotals = {
  pledged: number
  collected: number
  previousFunding: number
  lifetimeCollected: number
  remaining: number
  fundingPercent: number | null
  fundingStatus: WishlistFundingStatus
}

export type CampaignWishlistItemMetric = CampaignWishlistItemRow &
  WishlistFundingTotals & {
    fundName: string | null
    departmentName: string | null
    campaignName?: string | null
  }

export function normalizeWishlistItemType(value: string | null | undefined): WishlistItemType {
  const normalized = String(value || "other")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if ((WISHLIST_ITEM_TYPES as readonly string[]).includes(normalized)) {
    return normalized as WishlistItemType
  }
  return "other"
}

export function normalizeWishlistPriority(value: string | null | undefined): WishlistPriority {
  const normalized = String(value || "medium").trim().toLowerCase()
  if ((WISHLIST_PRIORITIES as readonly string[]).includes(normalized)) {
    return normalized as WishlistPriority
  }
  return "medium"
}

export function normalizeWishlistProjectStatus(
  value: string | null | undefined
): WishlistProjectStatus {
  const normalized = String(value || "planned")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if ((WISHLIST_PROJECT_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as WishlistProjectStatus
  }
  return "planned"
}

export function buildWishlistDonationPath(publicToken: string) {
  return `/donate/w/${publicToken}`
}
