export const CAMPAIGN_PROSPECT_ASK_TYPES = ["donation", "sponsorship"] as const

export type CampaignProspectAskType = (typeof CAMPAIGN_PROSPECT_ASK_TYPES)[number]

export const CAMPAIGN_PROSPECT_ASK_TYPE_LABELS: Record<CampaignProspectAskType, string> = {
  donation: "Donation",
  sponsorship: "Sponsorship",
}

export const CAMPAIGN_PROSPECT_ACTIVITY_TYPES = [
  "email",
  "phone_call",
  "meeting",
  "text",
  "follow_up",
  "note",
  "other",
] as const

export type CampaignProspectActivityType = (typeof CAMPAIGN_PROSPECT_ACTIVITY_TYPES)[number]

export const CAMPAIGN_PROSPECT_ACTIVITY_TYPE_LABELS: Record<
  CampaignProspectActivityType,
  string
> = {
  email: "Email",
  phone_call: "Phone Call",
  meeting: "Meeting",
  text: "Text / Message",
  follow_up: "Follow-up",
  note: "Note",
  other: "Other",
}

/** Activity types that count as outreach and update last_contacted_at. */
export const CAMPAIGN_PROSPECT_CONTACT_ACTIVITY_TYPES: CampaignProspectActivityType[] = [
  "email",
  "phone_call",
  "meeting",
  "text",
  "follow_up",
]

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

/** Stages staff can set or filter by in the Prospects UI. */
export const CAMPAIGN_PROSPECT_SELECTABLE_STAGES: CampaignProspectStage[] = [
  "identified",
  "contacted",
  "pledged",
  "declined",
  "no_response",
]

/** Legacy stage `assigned` is shown and edited as Identified. */
export function displayCampaignProspectStage(
  stage: string | null | undefined
): CampaignProspectStage {
  const normalized = normalizeProspectStage(stage)
  if (normalized === "assigned") return "identified"
  return normalized
}

export function campaignProspectStagesForSelect(
  current?: string | null
): CampaignProspectStage[] {
  const display =
    current && current !== "all" ? displayCampaignProspectStage(current) : null
  if (
    display &&
    !CAMPAIGN_PROSPECT_SELECTABLE_STAGES.includes(display)
  ) {
    return [display, ...CAMPAIGN_PROSPECT_SELECTABLE_STAGES]
  }
  return [...CAMPAIGN_PROSPECT_SELECTABLE_STAGES]
}

export function campaignProspectStageFilterValues(stage: string): string[] {
  if (stage === "identified") return ["identified", "assigned"]
  return [stage]
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
  ask_type: CampaignProspectAskType
  ask_level_id: string | null
  suggested_ask_amount: number | null
  event_id: string | null
  sponsorship_package_id: string | null
  assigned_to_contact_id: string | null
  stage: CampaignProspectStage
  priority: CampaignProspectPriority
  last_contacted_at: string | null
  next_follow_up_at: string | null
  notes: string | null
  converted_pledge_id: string | null
  converted_sponsorship_id: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type CampaignProspectListItem = CampaignProspectRow & {
  contactName: string
  contactEmail: string | null
  assignedToName: string | null
  askLevelAmount: number | null
  pledgeAmount: number | null
  sponsorshipAmount: number | null
  eventName: string | null
  packageName: string | null
}

export type CampaignProspectWriteInput = {
  contact_id: string
  ask_type?: CampaignProspectAskType
  ask_level_id?: string | null
  suggested_ask_amount?: number | null
  event_id?: string | null
  sponsorship_package_id?: string | null
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
  askType?: CampaignProspectAskType | "all" | null
  stage?: string | null
  priority?: string | null
  followUp?: "overdue" | "upcoming" | "any" | null
  pledged?: "pledged" | "not_pledged" | "any" | null
  /** When true, restrict to CAMPAIGN_PROSPECT_ASKED_STAGES (Asked or Pledged). */
  asked?: boolean | null
  sortBy?: "contact" | "suggested_ask" | "stage" | "next_follow_up" | "assigned_to"
  sortAsc?: boolean
}

export type CampaignProspectActivityRow = {
  id: string
  organization_id: string
  campaign_id: string
  prospect_id: string
  activity_type: CampaignProspectActivityType
  activity_date: string
  notes: string | null
  created_by: string | null
  created_by_name: string | null
  created_at?: string | null
}

export type CampaignProspectActivityWriteInput = {
  activity_type: CampaignProspectActivityType
  activity_date?: string | null
  notes?: string | null
}

export const CAMPAIGN_PROSPECT_SELECT =
  "id, organization_id, campaign_id, contact_id, ask_type, ask_level_id, suggested_ask_amount, event_id, sponsorship_package_id, assigned_to_contact_id, stage, priority, last_contacted_at, next_follow_up_at, notes, converted_pledge_id, converted_sponsorship_id, created_at, updated_at"

export const CAMPAIGN_PROSPECT_ACTIVITY_SELECT =
  "id, organization_id, campaign_id, prospect_id, activity_type, activity_date, notes, created_by, created_by_name, created_at, updated_at"

export function isCampaignProspectStage(value: string): value is CampaignProspectStage {
  return (CAMPAIGN_PROSPECT_STAGES as readonly string[]).includes(value)
}

export function isCampaignProspectPriority(value: string): value is CampaignProspectPriority {
  return (CAMPAIGN_PROSPECT_PRIORITIES as readonly string[]).includes(value)
}

export function isCampaignProspectAskType(value: string): value is CampaignProspectAskType {
  return (CAMPAIGN_PROSPECT_ASK_TYPES as readonly string[]).includes(value)
}

export function isCampaignProspectActivityType(
  value: string
): value is CampaignProspectActivityType {
  return (CAMPAIGN_PROSPECT_ACTIVITY_TYPES as readonly string[]).includes(value)
}

export function normalizeProspectAskType(
  value: string | null | undefined
): CampaignProspectAskType {
  const normalized = String(value || "donation").toLowerCase()
  return isCampaignProspectAskType(normalized) ? normalized : "donation"
}

export function normalizeProspectActivityType(
  value: string | null | undefined
): CampaignProspectActivityType {
  const normalized = String(value || "note").toLowerCase()
  return isCampaignProspectActivityType(normalized) ? normalized : "note"
}

export function campaignProspectStageLabel(
  stage: string | null | undefined,
  askType?: CampaignProspectAskType | null
): string {
  const display = displayCampaignProspectStage(stage)
  if (askType === "sponsorship" && display === "pledged") return "Committed"
  return CAMPAIGN_PROSPECT_STAGE_LABELS[display]
}

export function activityUpdatesLastContact(activityType: CampaignProspectActivityType): boolean {
  return CAMPAIGN_PROSPECT_CONTACT_ACTIVITY_TYPES.includes(activityType)
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

export function isProspectFollowUpToday(nextFollowUpAt: string | null | undefined): boolean {
  if (!nextFollowUpAt) return false
  const due = new Date(`${nextFollowUpAt}T00:00:00`)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due.getTime() === today.getTime()
}
