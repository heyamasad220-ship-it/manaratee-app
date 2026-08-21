"use client"

import { useEffect, useState } from "react"

import { CampaignPhaseEditor } from "@/components/donations/campaign-phase-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateCampaignAction } from "@/lib/donations/donation-reports-actions"
import type { CampaignRow } from "@/lib/donations/campaign-analytics"
import { formatCampaignStatusLabel } from "@/lib/donations/campaign-analytics"
import {
  draftsToPhaseWriteInputs,
  emptyPhaseDraft,
  phaseDraftsFromRows,
  phaseGoalsMatchCampaignGoal,
  sumPhaseGoalAmounts,
  type CampaignPhaseDraft,
  type CampaignPhaseRow,
} from "@/lib/donations/campaign-phase-types"

type CampaignStatus = "Active" | "Completed" | "Draft" | "Paused"

function statusToForm(status: string | null | undefined): CampaignStatus {
  const label = formatCampaignStatusLabel(status)
  if (label === "Active" || label === "Completed" || label === "Paused") {
    return label
  }
  return "Draft"
}

type CampaignEditDialogProps = {
  campaign: CampaignRow
  phases?: CampaignPhaseRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (campaign: CampaignRow) => void
}

export function CampaignEditDialog({
  campaign,
  phases = [],
  open,
  onOpenChange,
  onSaved,
}: CampaignEditDialogProps) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: campaign.name,
    description: campaign.description || "",
    goalAmount: campaign.goal_amount != null ? String(campaign.goal_amount) : "",
    startDate: campaign.start_date || "",
    endDate: campaign.end_date || "",
    status: statusToForm(campaign.status),
    goalBreakdownEnabled: Boolean(campaign.goal_breakdown_enabled || phases.length > 0),
  })
  const [phaseDrafts, setPhaseDrafts] = useState<CampaignPhaseDraft[]>(
    phases.length > 0 ? phaseDraftsFromRows(phases) : []
  )

  useEffect(() => {
    if (!open) return
    setForm({
      name: campaign.name,
      description: campaign.description || "",
      goalAmount: campaign.goal_amount != null ? String(campaign.goal_amount) : "",
      startDate: campaign.start_date || "",
      endDate: campaign.end_date || "",
      status: statusToForm(campaign.status),
      goalBreakdownEnabled: Boolean(campaign.goal_breakdown_enabled || phases.length > 0),
    })
    setPhaseDrafts(phases.length > 0 ? phaseDraftsFromRows(phases) : [])
  }, [campaign, open, phases])

  async function handleSave(allowPhaseGoalMismatch = false) {
    const goalBreakdownEnabled = form.goalBreakdownEnabled
    const phaseInputs = goalBreakdownEnabled ? draftsToPhaseWriteInputs(phaseDrafts) : []

    if (goalBreakdownEnabled && phaseInputs.length === 0) {
      alert("Add at least one phase, or turn off Goal Breakdown.")
      return
    }

    if (
      goalBreakdownEnabled &&
      !allowPhaseGoalMismatch &&
      !phaseGoalsMatchCampaignGoal(
        form.goalAmount ? Number(form.goalAmount) : null,
        sumPhaseGoalAmounts(phaseDrafts)
      )
    ) {
      const confirmed = window.confirm(
        "Phase goals do not equal the overall campaign goal. Save anyway?"
      )
      if (!confirmed) return
      return handleSave(true)
    }

    setSaving(true)
    const result = await updateCampaignAction(campaign.id, {
      name: form.name,
      description: form.description.trim() || null,
      goal_amount: form.goalAmount ? Number(form.goalAmount) : null,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      status: form.status,
      goal_breakdown_enabled: goalBreakdownEnabled,
      phases: phaseInputs,
      allow_phase_goal_mismatch: allowPhaseGoalMismatch,
    })
    setSaving(false)

    if (!result.success) {
      if ("code" in result && result.code === "phase_goal_mismatch") {
        const confirmed = window.confirm(`${result.error}\n\nSave anyway?`)
        if (confirmed) {
          void handleSave(true)
        }
        return
      }
      alert(result.error || "Failed to update campaign")
      return
    }

    onSaved(result.campaign)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>Update campaign details and optional goal phases</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="camp-name">Campaign Name</Label>
            <Input
              id="camp-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {campaign.code ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-code">Campaign Code</Label>
              <Input id="camp-code" value={campaign.code} readOnly className="bg-muted font-mono" />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="camp-description">Description</Label>
            <Textarea
              id="camp-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="camp-goal">Overall Goal</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="camp-goal"
                type="number"
                className="pl-7"
                value={form.goalAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, goalAmount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-start">Start Date</Label>
              <Input
                id="camp-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="camp-end">End Date / Event Date</Label>
              <Input
                id="camp-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="camp-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value: CampaignStatus) =>
                setForm((prev) => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger id="camp-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <CampaignPhaseEditor
            enabled={form.goalBreakdownEnabled}
            onEnabledChange={(enabled) => {
              setForm((prev) => ({ ...prev, goalBreakdownEnabled: enabled }))
              if (enabled && phaseDrafts.length === 0) {
                setPhaseDrafts([emptyPhaseDraft(0), emptyPhaseDraft(1)])
              }
            }}
            phases={phaseDrafts}
            onPhasesChange={setPhaseDrafts}
            campaignGoalAmount={form.goalAmount}
            idPrefix="edit-phase"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
