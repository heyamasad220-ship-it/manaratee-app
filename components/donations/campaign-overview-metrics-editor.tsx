"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { updateCampaignOverviewMetricsAction } from "@/lib/donations/donation-reports-actions"
import {
  CAMPAIGN_OVERVIEW_METRIC_CATALOG,
  DEFAULT_CAMPAIGN_OVERVIEW_METRIC_KEYS,
  type CampaignOverviewMetricKey,
} from "@/lib/donations/campaign-overview-metrics"

type CampaignOverviewMetricsEditorProps = {
  campaignId: string
  savedKeys: CampaignOverviewMetricKey[] | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (keys: CampaignOverviewMetricKey[] | null) => void
}

export function CampaignOverviewMetricsEditor({
  campaignId,
  savedKeys,
  open,
  onOpenChange,
  onSaved,
}: CampaignOverviewMetricsEditorProps) {
  const [useAuto, setUseAuto] = useState(savedKeys == null)
  const [orderedKeys, setOrderedKeys] = useState<CampaignOverviewMetricKey[]>(
    savedKeys ?? DEFAULT_CAMPAIGN_OVERVIEW_METRIC_KEYS
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setUseAuto(savedKeys == null)
    setOrderedKeys(savedKeys ?? DEFAULT_CAMPAIGN_OVERVIEW_METRIC_KEYS)
  }, [open, savedKeys])

  const enabledKeys = useMemo(() => new Set(orderedKeys), [orderedKeys])

  function toggleMetric(key: CampaignOverviewMetricKey, checked: boolean) {
    setUseAuto(false)
    setOrderedKeys((current) => {
      if (checked) {
        if (current.includes(key)) return current
        const catalogOrder = DEFAULT_CAMPAIGN_OVERVIEW_METRIC_KEYS
        const next = [...current, key]
        next.sort((a, b) => catalogOrder.indexOf(a) - catalogOrder.indexOf(b))
        return next
      }
      return current.filter((entry) => entry !== key)
    })
  }

  function moveMetric(key: CampaignOverviewMetricKey, direction: -1 | 1) {
    setUseAuto(false)
    setOrderedKeys((current) => {
      const index = current.indexOf(key)
      if (index === -1) return current
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    const payload = useAuto ? null : orderedKeys
    const result = await updateCampaignOverviewMetricsAction(campaignId, payload)
    setSaving(false)

    if (!result.success) {
      alert(result.error || "Failed to save overview metrics")
      return
    }

    onSaved(result.overviewMetricKeys)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize overview metrics</DialogTitle>
          <DialogDescription>
            Choose which rows appear on this campaign&apos;s overview. Use automatic mode to hide
            empty source rows (Square, Ticket Sales, etc.) until they have activity.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={useAuto}
              onCheckedChange={(checked) => {
                const nextAuto = checked === true
                setUseAuto(nextAuto)
                if (nextAuto) return
                setOrderedKeys((current) =>
                  current.length > 0 ? current : DEFAULT_CAMPAIGN_OVERVIEW_METRIC_KEYS
                )
              }}
              className="mt-0.5"
            />
            <div>
              <p className="font-medium">Automatic</p>
              <p className="text-sm text-muted-foreground">
                Show source rows only when they have a balance. Always show Donors, Largest Gift,
                and Pledges.
              </p>
            </div>
          </label>

          {!useAuto ? (
            <div className="flex flex-col gap-2">
              <Label>Visible metrics</Label>
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-2">
                {CAMPAIGN_OVERVIEW_METRIC_CATALOG.map((metric) => {
                  const checked = enabledKeys.has(metric.key)
                  const orderIndex = orderedKeys.indexOf(metric.key)

                  return (
                    <div
                      key={metric.key}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleMetric(metric.key, value === true)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{metric.title}</p>
                        {metric.description ? (
                          <p className="text-xs text-muted-foreground">{metric.description}</p>
                        ) : null}
                      </div>
                      {checked ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={orderIndex <= 0}
                            onClick={() => moveMetric(metric.key, -1)}
                            aria-label={`Move ${metric.title} up`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={orderIndex === orderedKeys.length - 1}
                            onClick={() => moveMetric(metric.key, 1)}
                            aria-label={`Move ${metric.title} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {!useAuto ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setUseAuto(true)
                setOrderedKeys(DEFAULT_CAMPAIGN_OVERVIEW_METRIC_KEYS)
              }}
              disabled={saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to automatic
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || (!useAuto && orderedKeys.length === 0)}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
