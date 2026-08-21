export type CampaignPhaseStatus = "active" | "completed" | "cancelled"

export type CampaignPhaseRow = {
  id: string
  organization_id: string
  campaign_id: string
  name: string
  goal_amount: number | null
  start_date: string | null
  deadline: string | null
  sort_order: number
  status: string
  created_at?: string | null
  updated_at?: string | null
}

/** Client/form draft for create/edit (may use temp ids before save). */
export type CampaignPhaseDraft = {
  id?: string | null
  clientKey: string
  name: string
  goalAmount: string
  startDate: string
  deadline: string
  sortOrder: number
}

export type CampaignPhaseWriteInput = {
  id?: string | null
  name: string
  goal_amount?: number | null
  start_date?: string | null
  deadline?: string | null
  sort_order?: number
  status?: string | null
}

export type CampaignPhaseMetrics = {
  phaseId: string
  name: string
  goalAmount: number | null
  deadline: string | null
  startDate: string | null
  sortOrder: number
  /** Sum of valid pledge commitments attributed to this phase. */
  committed: number
  /** Sum of successful payments attributed to this phase (no double-count with pledges). */
  collected: number
  /** Outstanding pledge balances for pledges in this phase. */
  outstanding: number
  /** Goal minus committed (null when no goal). */
  remainingToGoal: number | null
}

export const CAMPAIGN_PHASE_SELECT =
  "id, organization_id, campaign_id, name, goal_amount, start_date, deadline, sort_order, status, created_at, updated_at"

export function emptyPhaseDraft(sortOrder = 0): CampaignPhaseDraft {
  return {
    id: null,
    clientKey: `phase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    goalAmount: "",
    startDate: "",
    deadline: "",
    sortOrder,
  }
}

export function phaseDraftsFromRows(phases: CampaignPhaseRow[]): CampaignPhaseDraft[] {
  return [...phases]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((phase, index) => ({
      id: phase.id,
      clientKey: phase.id,
      name: phase.name,
      goalAmount: phase.goal_amount != null ? String(phase.goal_amount) : "",
      startDate: phase.start_date || "",
      deadline: phase.deadline || "",
      sortOrder: phase.sort_order ?? index,
    }))
}

export function sumPhaseGoalAmounts(phases: Array<{ goal_amount?: number | null; goalAmount?: string }>) {
  return phases.reduce((sum, phase) => {
    if ("goal_amount" in phase && phase.goal_amount != null) {
      return sum + Number(phase.goal_amount || 0)
    }
    const raw = "goalAmount" in phase ? phase.goalAmount : ""
    const amount = raw ? Number(raw) : 0
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)
}

export function phaseGoalsMatchCampaignGoal(
  campaignGoal: number | null | undefined,
  phaseGoalSum: number
): boolean {
  const goal = Number(campaignGoal || 0)
  if (!(goal > 0)) return true
  return Math.abs(goal - phaseGoalSum) < 0.01
}

export function draftsToPhaseWriteInputs(drafts: CampaignPhaseDraft[]): CampaignPhaseWriteInput[] {
  return drafts
    .map((draft, index) => ({
      id: draft.id || null,
      name: draft.name.trim(),
      goal_amount: draft.goalAmount.trim() ? Number(draft.goalAmount) : null,
      start_date: draft.startDate || null,
      deadline: draft.deadline || null,
      sort_order: draft.sortOrder ?? index,
      status: "active",
    }))
    .filter((phase) => phase.name.length > 0)
}
