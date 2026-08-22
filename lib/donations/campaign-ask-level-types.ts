export type CampaignAskLevelRow = {
  id: string
  organization_id: string
  campaign_id: string
  campaign_phase_id: string | null
  ask_amount: number
  target_count: number
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export type CampaignAskLevelWriteInput = {
  id?: string | null
  ask_amount: number
  target_count: number
  campaign_phase_id?: string | null
  sort_order?: number
}

export type CampaignAskLevelDraft = {
  id?: string | null
  clientKey: string
  askAmount: string
  targetCount: string
  campaignPhaseId: string
  sortOrder: number
}

export type CampaignAskLevelMetrics = {
  askLevelId: string
  askAmount: number
  targetCount: number
  targetValue: number
  campaignPhaseId: string | null
  campaignPhaseName: string | null
  sortOrder: number
  /** Prospects linked to this ask level (0 until prospects exist). */
  prospects: number
  /** Prospects at Asked stage or later (0 until prospects exist). */
  asked: number
  /** Count of secured pledges attributed to this ask level. */
  securedCount: number
  /** Sum of secured pledge amounts. */
  amountSecured: number
  /** Target value minus amount secured (floor at 0). */
  gap: number
}

export const CAMPAIGN_ASK_LEVEL_SELECT =
  "id, organization_id, campaign_id, campaign_phase_id, ask_amount, target_count, sort_order, created_at, updated_at"

export function askLevelTargetValue(askAmount: number, targetCount: number) {
  return Number(askAmount || 0) * Number(targetCount || 0)
}

export function emptyAskLevelDraft(sortOrder = 0): CampaignAskLevelDraft {
  return {
    id: null,
    clientKey: `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    askAmount: "",
    targetCount: "1",
    campaignPhaseId: "",
    sortOrder,
  }
}

export function askLevelDraftsFromRows(rows: CampaignAskLevelRow[]): CampaignAskLevelDraft[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || b.ask_amount - a.ask_amount)
    .map((row, index) => ({
      id: row.id,
      clientKey: row.id,
      askAmount: String(row.ask_amount),
      targetCount: String(row.target_count),
      campaignPhaseId: row.campaign_phase_id || "",
      sortOrder: row.sort_order ?? index,
    }))
}

export function draftsToAskLevelWriteInputs(
  drafts: CampaignAskLevelDraft[]
): CampaignAskLevelWriteInput[] {
  return drafts
    .map((draft, index) => ({
      id: draft.id || null,
      ask_amount: Number(draft.askAmount),
      target_count: Math.max(0, Math.floor(Number(draft.targetCount) || 0)),
      campaign_phase_id: null,
      sort_order: draft.sortOrder ?? index,
    }))
    .filter((row) => Number.isFinite(row.ask_amount) && row.ask_amount > 0)
}
