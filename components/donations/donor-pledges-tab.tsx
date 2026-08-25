"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, Plus } from "lucide-react"

import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { formatPledgeStatusLabel } from "@/lib/donations/donation-status"
import {
  getDonorPledgeCollectionSummaryAction,
  getDonorPledgesAction,
} from "@/lib/donations/pledge-reminder-actions"
import { type PledgeReminderRecord } from "@/lib/donations/pledge-reminder-types"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"
import {
  formatPledgePaymentPlanSummary,
  pledgeHasPaymentPlan,
} from "@/lib/donations/pledge-payment-plan"

type DonorPledgeRow = {
  id: string
  campaignName: string | null
  amountPledged: number
  amountPaid: number
  balanceRemaining: number
  status: string | null
  pledgeDate: string | null
  frequency: string | null
  installmentAmount: number | null
  totalPayments: number | null
  firstPaymentDate: string | null
  nextPaymentDate: string | null
}

type DonorPledgesTabProps = {
  donorId: string
  donorName?: string
  contactId?: string | null
  embedded?: boolean
  onUpdated?: () => void
  onCountChange?: (count: number) => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatFrequency(pledge: DonorPledgeRow) {
  if (pledgeHasPaymentPlan(pledge)) {
    return formatPledgePaymentPlanSummary({
      totalAmount: pledge.amountPledged,
      installmentAmount: pledge.installmentAmount,
      totalPayments: pledge.totalPayments,
      frequency: pledge.frequency,
    })
  }

  if (!pledge.frequency) return "—"
  return pledge.frequency.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function DonorPledgesTab({
  donorId,
  donorName,
  contactId = null,
  embedded = false,
  onUpdated,
  onCountChange,
}: DonorPledgesTabProps) {
  const [pledges, setPledges] = useState<DonorPledgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reminderHistory, setReminderHistory] = useState<PledgeReminderRecord[]>([])
  const [reminderHistoryOpen, setReminderHistoryOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsPledgeId, setDetailsPledgeId] = useState<string | null>(null)
  const [detailsIsAdd, setDetailsIsAdd] = useState(false)

  const loadReminderHistory = useCallback(async () => {
    if (!embedded) return

    const result = await getDonorPledgeCollectionSummaryAction(donorId)
    if (result.success) {
      setReminderHistory(result.summary.reminderHistory)
    }
  }, [donorId, embedded])

  const loadPledges = useCallback(async () => {
    setError(null)
    const result = await getDonorPledgesAction(donorId)
    if (!result.success) {
      setError(result.error)
      setPledges([])
      onCountChange?.(0)
    } else {
      setPledges(result.pledges)
      onCountChange?.(result.pledges.length)
    }
    setLoading(false)

    if (embedded) {
      await loadReminderHistory()
    }
  }, [donorId, embedded, loadReminderHistory, onCountChange])

  useEffect(() => {
    setLoading(true)
    void loadPledges()
  }, [loadPledges])

  function openPledge(pledgeId: string) {
    setDetailsIsAdd(false)
    setDetailsPledgeId(pledgeId)
    setDetailsOpen(true)
  }

  function openAddPledge() {
    setDetailsIsAdd(true)
    setDetailsPledgeId(null)
    setDetailsOpen(true)
  }

  const tableContent = (
    <>
      {contactId ? (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={openAddPledge}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pledge
          </Button>
        </div>
      ) : null}

      {pledges.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          There are no pledges for this donor.
        </p>
      ) : (
        <div className="w-full rounded-md border">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Campaign</th>
                <th className="px-3 py-2 text-left font-medium">Pledge Date</th>
                <th className="px-3 py-2 text-left font-medium">Frequency</th>
                <th className="px-3 py-2 text-right font-medium">Pledged</th>
                <th className="px-3 py-2 text-right font-medium">Paid</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((pledge) => (
                <tr
                  key={pledge.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  onClick={() => openPledge(pledge.id)}
                >
                  <td className="truncate px-3 py-2 font-medium">
                    {pledge.campaignName || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(pledge.pledgeDate)}
                  </td>
                  <td className="px-3 py-2">{formatFrequency(pledge)}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(pledge.amountPledged)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-700">
                    {formatCurrency(pledge.amountPaid)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      pledge.balanceRemaining > 0 ? "text-amber-700" : "text-muted-foreground"
                    }`}
                  >
                    {formatCurrency(pledge.balanceRemaining)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="whitespace-nowrap">
                      {formatPledgeStatusLabel(pledge.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pledges.length > 0 && !embedded ? (
        <div className="border-t px-1 pt-3 text-right">
          <Link href={donationPledgesHref()} className="text-sm text-primary hover:underline">
            View all pledges
          </Link>
        </div>
      ) : null}

      {embedded && reminderHistory.length > 0 ? (
        <Collapsible
          open={reminderHistoryOpen}
          onOpenChange={setReminderHistoryOpen}
          className="mt-4 border-t pt-4"
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-0 hover:bg-transparent">
              <ChevronDown
                className={`size-4 transition-transform ${
                  reminderHistoryOpen ? "rotate-180" : ""
                }`}
              />
              Reminder history ({reminderHistory.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2">
              {reminderHistory.slice(0, 10).map((row) => (
                <div key={row.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{row.reminder_type}</span>
                    <span className="text-muted-foreground">
                      {formatDate(row.sent_at || row.created_at)}
                    </span>
                  </div>
                  {row.contact_notes ? (
                    <p className="mt-1 text-muted-foreground">{row.contact_notes}</p>
                  ) : null}
                  {!row.delivered_externally && row.reminder_type !== "contacted" ? (
                    <p className="mt-1 text-xs text-amber-700">Recorded only — not emailed</p>
                  ) : null}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </>
  )

  const pledgeDetailsDialog = (
    <PledgeDetailsDialog
      open={detailsOpen}
      onOpenChange={(open) => {
        setDetailsOpen(open)
        if (!open) {
          setDetailsPledgeId(null)
          setDetailsIsAdd(false)
        }
      }}
      pledgeId={detailsIsAdd ? null : detailsPledgeId}
      defaultContactId={detailsIsAdd ? contactId : null}
      defaultContactLabel={detailsIsAdd ? donorName : null}
      onSaved={() => {
        void loadPledges()
        onUpdated?.()
      }}
      onDeleted={() => {
        setDetailsOpen(false)
        setDetailsPledgeId(null)
        setDetailsIsAdd(false)
        void loadPledges()
        onUpdated?.()
      }}
    />
  )

  if (loading) {
    return (
      <>
        <div className="py-8 text-center text-sm text-muted-foreground">Loading pledges...</div>
        {pledgeDetailsDialog}
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="py-8 text-center text-sm text-destructive">{error}</div>
        {pledgeDetailsDialog}
      </>
    )
  }

  return (
    <>
      {embedded ? (
        tableContent
      ) : (
        <div className="rounded-lg border bg-white">
          <div className="border-b px-6 py-4">
            <h3 className="text-lg font-semibold">Pledges</h3>
            <p className="text-sm text-muted-foreground">
              All pledge commitments for this donor
            </p>
          </div>
          <div className="p-6">{tableContent}</div>
        </div>
      )}
      {pledgeDetailsDialog}
    </>
  )
}
