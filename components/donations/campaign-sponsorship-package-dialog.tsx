"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  createSponsorshipPackageAction,
  updateSponsorshipPackageAction,
} from "@/lib/donations/campaign-sponsorship-package-actions"
import {
  SPONSORSHIP_PACKAGE_BENEFIT_TYPE_LABELS,
  SPONSORSHIP_PACKAGE_BENEFIT_TYPES,
  formatCampaignEventOptionLabel,
  type CampaignLinkedEventOption,
  type SponsorshipPackageBenefitInput,
  type SponsorshipPackageListItem,
} from "@/lib/donations/campaign-sponsorship-types"

const NO_EVENT = "__none__"
const NO_TYPE = "__none__"

type BenefitDraft = SponsorshipPackageBenefitInput & { key: string }

function emptyBenefit(): BenefitDraft {
  return {
    key: `new-${crypto.randomUUID()}`,
    benefit_type: "",
    name: "",
    value: "",
  }
}

export function CampaignSponsorshipPackageDialog({
  open,
  onOpenChange,
  campaignId,
  canManage,
  events,
  pkg,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  canManage: boolean
  events: CampaignLinkedEventOption[]
  pkg: SponsorshipPackageListItem | null
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [eventId, setEventId] = useState("")
  const [description, setDescription] = useState("")
  const [active, setActive] = useState(true)
  const [displayOrder, setDisplayOrder] = useState("")
  const [benefits, setBenefits] = useState<BenefitDraft[]>([emptyBenefit()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (pkg) {
      setName(pkg.name)
      setAmount(String(pkg.amount || ""))
      setEventId(pkg.event_id || "")
      setDescription(pkg.description || "")
      setActive(pkg.active)
      setDisplayOrder(String(pkg.display_order || ""))
      setBenefits(
        pkg.benefits.length > 0
          ? pkg.benefits.map((benefit) => ({
              key: benefit.id,
              id: benefit.id,
              benefit_type: benefit.benefit_type || "",
              name: benefit.name,
              value: benefit.value || "",
              display_order: benefit.display_order,
            }))
          : [emptyBenefit()]
      )
      return
    }

    setName("")
    setAmount("")
    setEventId("")
    setDescription("")
    setActive(true)
    setDisplayOrder("")
    setBenefits([emptyBenefit()])
  }, [open, pkg])

  useEffect(() => {
    if (!open || pkg) return
    const linked = events.filter((event) => event.linkedToCampaign)
    if (linked.length !== 1) return
    setEventId((current) => current || linked[0].id)
  }, [open, pkg, events])

  async function handleSave() {
    if (!name.trim()) {
      alert("Package name is required")
      return
    }
    const parsedAmount = Number(amount)
    if (!(parsedAmount >= 0)) {
      alert("Enter a valid package amount")
      return
    }

    setSaving(true)
    const payload = {
      campaign_id: campaignId,
      name: name.trim(),
      amount: parsedAmount,
      event_id: eventId || null,
      description: description.trim() || null,
      display_order: displayOrder ? Number(displayOrder) : undefined,
      active,
      benefits: benefits
        .filter((benefit) => benefit.name.trim())
        .map((benefit, index) => ({
          id: benefit.id,
          benefit_type: benefit.benefit_type || null,
          name: benefit.name.trim(),
          value: benefit.value?.trim() || null,
          display_order: index,
        })),
    }

    const result = pkg
      ? await updateSponsorshipPackageAction(pkg.id, payload)
      : await createSponsorshipPackageAction(payload)

    setSaving(false)
    if (!result.success) {
      alert(result.error)
      return
    }
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,56rem)] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{pkg ? "Edit Package" : "New Package"}</DialogTitle>
          <DialogDescription>
            Create a sponsorship level for this campaign. Benefits are copied onto a sponsor when
            they commit.
          </DialogDescription>
        </DialogHeader>

        {pkg ? (
          <div className="grid gap-3 rounded-md border border-border p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Sponsors</p>
              <p className="font-medium">{pkg.sponsorCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Committed</p>
              <p className="font-medium">{formatDonationCurrency(pkg.totalCommitted)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="font-medium">{formatDonationCurrency(pkg.totalCollected)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-medium">{formatDonationCurrency(pkg.outstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In-Kind Value</p>
              <p className="font-medium">{formatDonationCurrency(pkg.inKindValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Benefits</p>
              <p className="font-medium">{pkg.benefitCount}</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="package-name">Package Name</Label>
              <Input
                id="package-name"
                value={name}
                disabled={!canManage}
                onChange={(event) => setName(event.target.value)}
                placeholder="Visionary Partner"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="package-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="package-amount"
                  type="number"
                  className="pl-7"
                  value={amount}
                  disabled={!canManage}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Related Event</Label>
              <Select
                value={eventId || NO_EVENT}
                onValueChange={(value) => setEventId(value === NO_EVENT ? "" : value)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EVENT}>No event</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {formatCampaignEventOptionLabel(event)}
                      {event.linkedToCampaign ? " (linked)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={active ? "active" : "inactive"}
                  onValueChange={(value) => setActive(value === "active")}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="package-order">Display Order</Label>
                <Input
                  id="package-order"
                  type="number"
                  value={displayOrder}
                  disabled={!canManage}
                  onChange={(event) => setDisplayOrder(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="package-description">Description</Label>
            <Textarea
              id="package-description"
              rows={2}
              value={description}
              disabled={!canManage}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Premier sponsorship level with maximum event and community exposure."
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Benefits</Label>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBenefits((current) => [...current, emptyBenefit()])}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add benefit
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {benefits.map((benefit, index) => (
                <div
                  key={benefit.key}
                  className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[11rem_minmax(0,1fr)_9rem_auto]"
                >
                  <Select
                    value={benefit.benefit_type || NO_TYPE}
                    onValueChange={(value) =>
                      setBenefits((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, benefit_type: value === NO_TYPE ? "" : value }
                            : row
                        )
                      )
                    }
                    disabled={!canManage}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TYPE}>Custom</SelectItem>
                      {SPONSORSHIP_PACKAGE_BENEFIT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {SPONSORSHIP_PACKAGE_BENEFIT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Benefit"
                    value={benefit.name}
                    disabled={!canManage}
                    onChange={(event) =>
                      setBenefits((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: event.target.value } : row
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Qty / value"
                    value={benefit.value || ""}
                    disabled={!canManage}
                    onChange={(event) =>
                      setBenefits((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, value: event.target.value } : row
                        )
                      )
                    }
                  />
                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setBenefits((current) => current.filter((_, rowIndex) => rowIndex !== index))
                      }
                      aria-label="Remove benefit"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {canManage ? "Cancel" : "Close"}
          </Button>
          {canManage ? (
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : pkg ? "Save Package" : "Create Package"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
