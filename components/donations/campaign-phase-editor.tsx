"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  emptyPhaseDraft,
  phaseGoalsMatchCampaignGoal,
  sumPhaseGoalAmounts,
  type CampaignPhaseDraft,
} from "@/lib/donations/campaign-phase-types"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

type CampaignPhaseEditorProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  phases: CampaignPhaseDraft[]
  onPhasesChange: (phases: CampaignPhaseDraft[]) => void
  campaignGoalAmount: string
  idPrefix?: string
}

export function CampaignPhaseEditor({
  enabled,
  onEnabledChange,
  phases,
  onPhasesChange,
  campaignGoalAmount,
  idPrefix = "phase",
}: CampaignPhaseEditorProps) {
  const phaseGoalSum = sumPhaseGoalAmounts(phases)
  const campaignGoal = campaignGoalAmount ? Number(campaignGoalAmount) : null
  const goalsMatch = phaseGoalsMatchCampaignGoal(campaignGoal, phaseGoalSum)
  const showMismatch = enabled && phases.length > 0 && campaignGoal != null && campaignGoal > 0 && !goalsMatch

  function updatePhase(clientKey: string, patch: Partial<CampaignPhaseDraft>) {
    onPhasesChange(
      phases.map((phase) => (phase.clientKey === clientKey ? { ...phase, ...patch } : phase))
    )
  }

  function addPhase() {
    onPhasesChange([...phases, emptyPhaseDraft(phases.length)])
  }

  function removePhase(clientKey: string) {
    onPhasesChange(
      phases
        .filter((phase) => phase.clientKey !== clientKey)
        .map((phase, index) => ({ ...phase, sortOrder: index }))
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-breakdown-toggle`}>Enable Goal Breakdown</Label>
          <p className="text-xs text-muted-foreground">
            Split the overall goal into optional campaign phases
          </p>
        </div>
        <Switch
          id={`${idPrefix}-breakdown-toggle`}
          checked={enabled}
          onCheckedChange={(checked) => {
            onEnabledChange(checked)
            if (checked && phases.length === 0) {
              onPhasesChange([emptyPhaseDraft(0), emptyPhaseDraft(1)])
            }
          }}
        />
      </div>

      {enabled ? (
        <div className="flex flex-col gap-3">
          {phases.map((phase, index) => (
            <div
              key={phase.clientKey}
              className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Phase {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => removePhase(phase.clientKey)}
                  disabled={phases.length <= 1}
                  aria-label={`Remove phase ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${idPrefix}-name-${phase.clientKey}`}>Phase Name</Label>
                <Input
                  id={`${idPrefix}-name-${phase.clientKey}`}
                  placeholder="e.g., Pre-Event Pledges"
                  value={phase.name}
                  onChange={(event) =>
                    updatePhase(phase.clientKey, { name: event.target.value })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${idPrefix}-goal-${phase.clientKey}`}>Goal Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id={`${idPrefix}-goal-${phase.clientKey}`}
                      type="number"
                      className="pl-7"
                      value={phase.goalAmount}
                      onChange={(event) =>
                        updatePhase(phase.clientKey, { goalAmount: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${idPrefix}-start-${phase.clientKey}`}>Start Date</Label>
                  <Input
                    id={`${idPrefix}-start-${phase.clientKey}`}
                    type="date"
                    value={phase.startDate}
                    onChange={(event) =>
                      updatePhase(phase.clientKey, { startDate: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${idPrefix}-deadline-${phase.clientKey}`}>Deadline</Label>
                  <Input
                    id={`${idPrefix}-deadline-${phase.clientKey}`}
                    type="date"
                    value={phase.deadline}
                    onChange={(event) =>
                      updatePhase(phase.clientKey, { deadline: event.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addPhase}>
              <Plus className="mr-2 h-4 w-4" />
              Add Phase
            </Button>
            <p className="text-sm text-muted-foreground">
              Phase total:{" "}
              <span className="font-medium text-foreground">
                {formatDonationCurrency(phaseGoalSum)}
              </span>
              {campaignGoal != null && campaignGoal > 0 ? (
                <>
                  {" "}
                  / campaign goal {formatDonationCurrency(campaignGoal)}
                </>
              ) : null}
            </p>
          </div>

          {showMismatch ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Phase goals do not equal the overall campaign goal. You can still save after
              confirming the warning.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
