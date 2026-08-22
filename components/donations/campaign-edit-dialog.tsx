"use client"

import { useEffect, useState } from "react"

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
import { updateCampaignAction, deleteCampaignAction } from "@/lib/donations/donation-reports-actions"
import type { CampaignRow } from "@/lib/donations/campaign-analytics"
import { formatCampaignStatusLabel } from "@/lib/donations/campaign-analytics"

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
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (campaign: CampaignRow) => void
  onDeleted?: () => void
}

export function CampaignEditDialog({
  campaign,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: CampaignEditDialogProps) {
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    name: campaign.name,
    description: campaign.description || "",
    goalAmount: campaign.goal_amount != null ? String(campaign.goal_amount) : "",
    startDate: campaign.start_date || "",
    endDate: campaign.end_date || "",
    status: statusToForm(campaign.status),
  })

  useEffect(() => {
    if (!open) return
    setForm({
      name: campaign.name,
      description: campaign.description || "",
      goalAmount: campaign.goal_amount != null ? String(campaign.goal_amount) : "",
      startDate: campaign.start_date || "",
      endDate: campaign.end_date || "",
      status: statusToForm(campaign.status),
    })
  }, [campaign, open])

  async function handleSave() {
    setSaving(true)
    const result = await updateCampaignAction(campaign.id, {
      name: form.name,
      description: form.description.trim() || null,
      goal_amount: form.goalAmount ? Number(form.goalAmount) : null,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      status: form.status,
    })
    setSaving(false)

    if (!result.success) {
      alert(result.error || "Failed to update campaign")
      return
    }

    onSaved(result.campaign)
    onOpenChange(false)
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete ${campaign.name}? This cannot be undone. Campaigns with pledges, donations, or recurring plans cannot be deleted.`
      )
    ) {
      return
    }

    setDeleting(true)
    const result = await deleteCampaignAction(campaign.id)
    setDeleting(false)

    if (!result.success) {
      alert(result.error || "Failed to delete campaign")
      return
    }

    onOpenChange(false)
    onDeleted?.()
  }

  const busy = saving || deleting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>Update campaign details and goal</DialogDescription>
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
            <Label htmlFor="camp-goal">Goal</Label>
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
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={busy}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
