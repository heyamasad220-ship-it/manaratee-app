export const CAMPAIGN_PROSPECT_STAGES = [
  "identified",
  "assigned",
  "contacted",
  "meeting_scheduled",
  "asked",
  "pledged",
  "declined",
  "no_response",
] as const

export type CampaignProspectStage = (typeof CAMPAIGN_PROSPECT_STAGES)[number]

export const CAMPAIGN_PROSPECT_STAGE_LABELS: Record<CampaignProspectStage, string> = {
  identified: "Identified",
  assigned: "Assigned",
  contacted: "Contacted",
  meeting_scheduled: "Meeting Scheduled",
  asked: "Asked",
  pledged: "Pledged",
  declined: "Declined",
  no_response: "No Response",
}

/** Stages that count as "Asked" for strategy metrics. */
export const CAMPAIGN_PROSPECT_ASKED_STAGES: CampaignProspectStage[] = [
  "asked",
  "pledged",
]

export const CAMPAIGN_PROSPECT_PRIORITIES = ["high", "medium", "low"] as const

export type CampaignProspectPriority = (typeof CAMPAIGN_PROSPECT_PRIORITIES)[number]

export const CAMPAIGN_PROSPECT_PRIORITY_LABELS: Record<CampaignProspectPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export type CampaignProspectRow = {
  id: string
  organization_id: string
  campaign_id: string
  contact_id: string
  ask_level_id: string | null
  suggested_ask_amount: number | null
  assigned_to_contact_id: string | null
  stage: CampaignProspectStage
  priority: CampaignProspectPriority
  last_contacted_at: string | null
  next_follow_up_at: string | null
  notes: string | null
  converted_pledge_id: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type CampaignProspectListItem = CampaignProspectRow & {
  contactName: string
  contactEmail: string | null
  assignedToName: string | null
  askLevelAmount: number | null
  pledgeAmount: number | null
}

export type CampaignProspectWriteInput = {
  contact_id: string
  ask_level_id?: string | null
  suggested_ask_amount?: number | null
  assigned_to_contact_id?: string | null
  stage?: CampaignProspectStage
  priority?: CampaignProspectPriority
  last_contacted_at?: string | null
  next_follow_up_at?: string | null
  notes?: string | null
}

export type CampaignProspectsPageInput = {
  campaignId: string
  page?: number
  pageSize?: number
  search?: string
  assignedToContactId?: string | null
  askLevelId?: string | null
  stage?: string | null
  priority?: string | null
  followUp?: "overdue" | "upcoming" | "any" | null
  pledged?: "pledged" | "not_pledged" | "any" | null
  sortBy?: "contact" | "suggested_ask" | "stage" | "next_follow_up" | "assigned_to"
  sortAsc?: boolean
}

export const CAMPAIGN_PROSPECT_SELECT =
  "id, organization_id, campaign_id, contact_id, ask_level_id, suggested_ask_amount, assigned_to_contact_id, stage, priority, last_contacted_at, next_follow_up_at, notes, converted_pledge_id, created_at, updated_at"

export function isCampaignProspectStage(value: string): value is CampaignProspectStage {
  return (CAMPAIGN_PROSPECT_STAGES as readonly string[]).includes(value)
}

export function isCampaignProspectPriority(value: string): value is CampaignProspectPriority {
  return (CAMPAIGN_PROSPECT_PRIORITIES as readonly string[]).includes(value)
}

export function normalizeProspectStage(value: string | null | undefined): CampaignProspectStage {
  const normalized = String(value || "identified").toLowerCase()
  return isCampaignProspectStage(normalized) ? normalized : "identified"
}

export function normalizeProspectPriority(
  value: string | null | undefined
): CampaignProspectPriority {
  const normalized = String(value || "medium").toLowerCase()
  return isCampaignProspectPriority(normalized) ? normalized : "medium"
}

export function isProspectFollowUpOverdue(
  nextFollowUpAt: string | null | undefined,
  stage?: CampaignProspectStage | null
): boolean {
  if (!nextFollowUpAt) return false
  if (stage === "pledged" || stage === "declined" || stage === "no_response") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${nextFollowUpAt}T00:00:00`)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < today.getTime()
}
