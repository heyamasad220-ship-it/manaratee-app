"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { saveCampaignAskLevelsAction } from "@/lib/donations/campaign-ask-level-actions"
import {
  askLevelTargetValue,
  draftsToAskLevelWriteInputs,
  emptyAskLevelDraft,
  askLevelDraftsFromRows,
  type CampaignAskLevelDraft,
  type CampaignAskLevelMetrics,
  type CampaignAskLevelRow,
} from "@/lib/donations/campaign-ask-level-types"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

type CampaignStrategyTabProps = {
  campaignId: string
  askLevels: CampaignAskLevelRow[]
  askLevelMetrics: CampaignAskLevelMetrics[]
  canManage: boolean
  onSaved: () => void
}

export function CampaignStrategyTab({
  campaignId,
  askLevels,
  askLevelMetrics,
  canManage,
  onSaved,
}: CampaignStrategyTabProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<CampaignAskLevelDraft[]>([])

  useEffect(() => {
    if (!editing) {
      setDrafts(askLevelDraftsFromRows(askLevels))
    }
  }, [askLevels, editing])

  const totals = useMemo(() => {
    const targetGifts = askLevelMetrics.reduce((sum, row) => sum + row.targetCount, 0)
    const targetValue = askLevelMetrics.reduce((sum, row) => sum + row.targetValue, 0)
    const amountSecured = askLevelMetrics.reduce((sum, row) => sum + row.amountSecured, 0)
    const gap = askLevelMetrics.reduce((sum, row) => sum + row.gap, 0)
    return { targetGifts, targetValue, amountSecured, gap }
  }, [askLevelMetrics])

  const draftTotals = useMemo(() => {
    return drafts.reduce(
      (acc, draft) => {
        const askAmount = Number(draft.askAmount) || 0
        const targetCount = Math.max(0, Math.floor(Number(draft.targetCount) || 0))
        acc.targetGifts += targetCount
        acc.targetValue += askLevelTargetValue(askAmount, targetCount)
        return acc
      },
      { targetGifts: 0, targetValue: 0 }
    )
  }, [drafts])

  function updateDraft(clientKey: string, patch: Partial<CampaignAskLevelDraft>) {
    setDrafts((prev) =>
      prev.map((draft) => (draft.clientKey === clientKey ? { ...draft, ...patch } : draft))
    )
  }

  function addDraft() {
    setDrafts((prev) => [...prev, emptyAskLevelDraft(prev.length)])
  }

  function removeDraft(clientKey: string) {
    setDrafts((prev) =>
      prev
        .filter((draft) => draft.clientKey !== clientKey)
        .map((draft, index) => ({ ...draft, sortOrder: index }))
    )
  }

  async function handleSave() {
    const payload = draftsToAskLevelWriteInputs(drafts)
    if (drafts.some((d) => d.askAmount.trim() && !(Number(d.askAmount) > 0))) {
      alert("Each ask level needs a positive Ask Amount.")
      return
    }

    setSaving(true)
    const result = await saveCampaignAskLevelsAction(campaignId, payload)
    setSaving(false)

    if (!result.success) {
      alert(result.error || "Failed to save strategy")
      return
    }

    setEditing(false)
    onSaved()
  }

  function handleCancel() {
    setDrafts(askLevelDraftsFromRows(askLevels))
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Gift / Ask Level Chart</h2>
          <p className="text-sm text-muted-foreground">
            Plan how many gifts you need at each ask amount. Prospects can exceed the target
            count.
          </p>
        </div>
        {canManage ? (
          editing ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving..." : "Save Strategy"}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit Strategy</Button>
          )
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Targeted Gifts
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {editing ? draftTotals.targetGifts : totals.targetGifts}
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target Value
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {formatDonationCurrency(editing ? draftTotals.targetValue : totals.targetValue)}
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Amount Secured
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {formatDonationCurrency(totals.amountSecured)}
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Gap
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xl font-semibold tabular-nums">
            {formatDonationCurrency(totals.gap)}
          </CardContent>
        </Card>
      </div>

      {editing ? (
        <Card className="border border-border shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No ask levels yet. Add one to start your gift chart.
              </p>
            ) : null}

            {drafts.map((draft, index) => {
              const askAmount = Number(draft.askAmount) || 0
              const targetCount = Math.max(0, Math.floor(Number(draft.targetCount) || 0))
              const targetValue = askLevelTargetValue(askAmount, targetCount)

              return (
                <div
                  key={draft.clientKey}
                  className="grid gap-3 rounded-md border border-dashed border-border p-3 lg:grid-cols-[1fr_1fr_auto_auto]"
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`ask-amount-${draft.clientKey}`}>Ask Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id={`ask-amount-${draft.clientKey}`}
                        type="number"
                        className="pl-7"
                        value={draft.askAmount}
                        onChange={(event) =>
                          updateDraft(draft.clientKey, { askAmount: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`ask-target-${draft.clientKey}`}>Target # of Gifts</Label>
                    <Input
                      id={`ask-target-${draft.clientKey}`}
                      type="number"
                      min={0}
                      value={draft.targetCount}
                      onChange={(event) =>
                        updateDraft(draft.clientKey, { targetCount: event.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Target Value</Label>
                    <p className="flex h-9 items-center text-sm font-medium tabular-nums">
                      {formatDonationCurrency(targetValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">Ask × Target #</p>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-red-600"
                      onClick={() => removeDraft(draft.clientKey)}
                      aria-label={`Remove ask level ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}

            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addDraft}>
              <Plus className="mr-2 h-4 w-4" />
              Add Ask Level
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ask Level</TableHead>
                  <TableHead className="text-right">Target #</TableHead>
                  <TableHead className="text-right">Target Value</TableHead>
                  <TableHead className="text-right">Prospects</TableHead>
                  <TableHead className="text-right">Asked</TableHead>
                  <TableHead className="text-right">Secured</TableHead>
                  <TableHead className="text-right">Amount Secured</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {askLevelMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      {canManage
                        ? "No ask levels yet. Click Edit Strategy to build your gift chart."
                        : "No ask levels configured for this campaign."}
                    </TableCell>
                  </TableRow>
                ) : (
                  askLevelMetrics.map((row) => (
                    <TableRow key={row.askLevelId}>
                      <TableCell className="font-medium tabular-nums">
                        {formatDonationCurrency(row.askAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.targetCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDonationCurrency(row.targetValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.prospects}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.asked}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.securedCount}/{row.targetCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDonationCurrency(row.amountSecured)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDonationCurrency(row.gap)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {askLevelMetrics.length > 0 ? (
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.targetGifts}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(totals.targetValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {askLevelMetrics.reduce((sum, row) => sum + row.prospects, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {askLevelMetrics.reduce((sum, row) => sum + row.asked, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {askLevelMetrics.reduce((sum, row) => sum + row.securedCount, 0)}/
                      {totals.targetGifts}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(totals.amountSecured)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(totals.gap)}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Prospects and Asked update when you add prospects on the Prospects tab. Secured uses
        pledges linked to an ask level (or matching ask amount until then). Prospects may exceed
        the target number of gifts.
      </p>
    </div>
  )
}
