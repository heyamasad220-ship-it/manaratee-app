"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"

import {
  CampaignFundraisingPlanDialog,
  type FundraisingPlanSaveInput,
} from "@/components/donations/campaign-fundraising-plan-dialog"
import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"

export type { FundraisingPlanSaveInput }
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  campaignProspectAskAmount,
  isProspectFollowUpOverdue,
  isProspectFollowUpToday,
  isProspectFollowUpUpcoming,
  type CampaignProspectListItem,
} from "@/lib/donations/campaign-prospect-types"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { cn } from "@/lib/utils"

function dateInputValue(value: string | null | undefined) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || ""
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(`${dateInputValue(value)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function CampaignFundraisingPlanTable({
  campaignId,
  organizationId,
  prospects,
  canManage,
  followUpFilter,
  assigneeFilter,
  saving,
  errorMessage,
  onSaveProspect,
  onAddProspect,
  onDeleteProspect,
  onPledgeChanged,
}: {
  campaignId: string
  organizationId: string
  prospects: CampaignProspectListItem[]
  canManage: boolean
  followUpFilter: "overdue" | "upcoming" | null
  assigneeFilter: string | null
  saving: boolean
  errorMessage: string | null
  onSaveProspect: (prospectId: string, input: FundraisingPlanSaveInput) => Promise<boolean>
  onAddProspect: (input: FundraisingPlanSaveInput) => Promise<boolean>
  onDeleteProspect: (prospectId: string) => Promise<boolean>
  onPledgeChanged: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CampaignProspectListItem | null>(null)
  const [pledgeProspectId, setPledgeProspectId] = useState<string | null>(null)
  const [pledgeId, setPledgeId] = useState<string | null>(null)
  const [showPledgeDialog, setShowPledgeDialog] = useState(false)

  const visibleProspects = useMemo(() => {
    return prospects.filter((prospect) => {
      if (assigneeFilter === "unassigned" && (prospect.assignedToName || prospect.assigned_to_contact_id)) {
        return false
      }
      if (
        assigneeFilter &&
        assigneeFilter !== "unassigned" &&
        prospect.assigned_to_contact_id !== assigneeFilter
      ) {
        return false
      }
      if (followUpFilter === "overdue") {
        return (
          !prospect.converted_pledge_id &&
          isProspectFollowUpOverdue(prospect.next_follow_up_at, prospect.stage)
        )
      }
      if (followUpFilter === "upcoming") {
        return (
          !prospect.converted_pledge_id &&
          isProspectFollowUpUpcoming(prospect.next_follow_up_at)
        )
      }
      return true
    })
  }, [assigneeFilter, followUpFilter, prospects])

  function openAdd() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openRow(prospect: CampaignProspectListItem) {
    setEditing(prospect)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Click a row to edit it, record a pledge, or remove it.
        </p>
        {canManage ? (
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add prospect
          </Button>
        ) : null}
      </div>

      {errorMessage && !dialogOpen ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead className="text-right">Ask level</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Last contact</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No donation prospects yet. Click Add prospect to get started.
                  </TableCell>
                </TableRow>
              ) : (
                visibleProspects.map((prospect) => {
                  const amount = campaignProspectAskAmount(prospect)
                  const overdue =
                    !prospect.converted_pledge_id &&
                    isProspectFollowUpOverdue(prospect.next_follow_up_at, prospect.stage)
                  const today = isProspectFollowUpToday(prospect.next_follow_up_at)
                  return (
                    <TableRow
                      key={prospect.id}
                      className="cursor-pointer hover:bg-muted/40"
                      tabIndex={0}
                      onClick={() => openRow(prospect)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          openRow(prospect)
                        }
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">{prospect.contactName}</div>
                        {prospect.pledgeAmount != null ? (
                          <div className="text-xs text-muted-foreground">
                            Pledged {formatDonationCurrency(prospect.pledgeAmount)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {amount == null ? "—" : formatDonationCurrency(amount)}
                      </TableCell>
                      <TableCell>{prospect.assignedToName || "—"}</TableCell>
                      <TableCell>{formatShortDate(prospect.last_contacted_at)}</TableCell>
                      <TableCell
                        className={cn(
                          overdue && "font-medium text-red-600",
                          today && !overdue && "font-medium text-amber-700"
                        )}
                      >
                        {formatShortDate(prospect.next_follow_up_at)}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {prospect.notes || "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CampaignFundraisingPlanDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        organizationId={organizationId}
        prospect={editing}
        canManage={canManage}
        saving={saving}
        errorMessage={errorMessage}
        onSave={async (input) => {
          if (editing) return onSaveProspect(editing.id, input)
          return onAddProspect(input)
        }}
        onDelete={async () => {
          if (!editing) return false
          return onDeleteProspect(editing.id)
        }}
        onRecordPledge={() => {
          if (!editing) return
          setDialogOpen(false)
          setPledgeProspectId(editing.id)
          setPledgeId(editing.converted_pledge_id)
          setShowPledgeDialog(true)
        }}
      />

      <PledgeDetailsDialog
        open={showPledgeDialog}
        onOpenChange={(open) => {
          setShowPledgeDialog(open)
          if (!open) {
            setPledgeProspectId(null)
            setPledgeId(null)
          }
        }}
        pledgeId={pledgeId}
        prospectId={pledgeId ? null : pledgeProspectId}
        organizationId={organizationId}
        defaultCampaignId={campaignId}
        canManage={canManage}
        onSaved={() => {
          setShowPledgeDialog(false)
          setPledgeProspectId(null)
          setPledgeId(null)
          onPledgeChanged()
        }}
        onDeleted={() => {
          setShowPledgeDialog(false)
          setPledgeProspectId(null)
          setPledgeId(null)
          onPledgeChanged()
        }}
      />
    </div>
  )
}
