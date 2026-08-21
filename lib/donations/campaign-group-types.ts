export const CAMPAIGN_GROUP_STATUSES = [
  "active",
  "paused",
  "completed",
  "archived",
] as const

export type CampaignGroupStatus = (typeof CAMPAIGN_GROUP_STATUSES)[number]

export const CAMPAIGN_GROUP_STATUS_LABELS: Record<CampaignGroupStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
}

export type CampaignGroupRow = {
  id: string
  organization_id: string
  campaign_id: string
  organizational_group_id: string | null
  name: string
  lead_contact_id: string | null
  goal_amount: number | null
  description: string | null
  public_token: string
  status: CampaignGroupStatus
  public_progress_enabled: boolean
  link_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type CampaignGroupWriteInput = {
  name: string
  organizational_group_id?: string | null
  lead_contact_id?: string | null
  goal_amount?: number | null
  description?: string | null
  status?: CampaignGroupStatus | string
  public_progress_enabled?: boolean
  link_active?: boolean
}

export type CampaignGroupMetrics = {
  groupId: string
  name: string
  goalAmount: number | null
  leadContactId: string | null
  leadName: string | null
  organizationalGroupId: string | null
  organizationalGroupName: string | null
  status: CampaignGroupStatus
  linkActive: boolean
  publicToken: string
  publicProgressEnabled: boolean
  description: string | null
  /** Valid pledges attributed to this campaign group. */
  pledged: number
  /** Successful payments attributed to this campaign group. */
  collected: number
  outstanding: number
  donorCount: number
  progressPercent: number | null
}

export const CAMPAIGN_GROUP_SELECT =
  "id, organization_id, campaign_id, organizational_group_id, name, lead_contact_id, goal_amount, description, public_token, status, public_progress_enabled, link_active, created_at, updated_at"

export function normalizeCampaignGroupStatus(
  value: string | null | undefined
): CampaignGroupStatus {
  const normalized = String(value || "active").toLowerCase()
  if ((CAMPAIGN_GROUP_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as CampaignGroupStatus
  }
  return "active"
}

export function buildCampaignGroupDonationPath(publicToken: string) {
  return `/donate/g/${publicToken}`
}
