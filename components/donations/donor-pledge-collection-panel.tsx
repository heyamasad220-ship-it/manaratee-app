"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"
import { getDonorPledgeCollectionSummaryAction } from "@/lib/donations/pledge-reminder-actions"
import { formatPledgeStatusLabel } from "@/lib/donations/donation-status"

type DonorPledgeCollectionPanelProps = {
  donorId: string
  donorName: string
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

export function DonorPledgeCollectionPanel({
  donorId,
}: DonorPledgeCollectionPanelProps) {
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof getDonorPledgeCollectionSummaryAction>
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsPledgeId, setDetailsPledgeId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const result = await getDonorPledgeCollectionSummaryAction(donorId)
    setSummary(result)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [donorId])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading pledge collection info...</div>
  }

  if (!summary?.success) return null

  const data = summary.summary

  if (data.activePledges.length === 0 && data.reminderHistory.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pledge reminders</CardTitle>
        <CardDescription>
          Outstanding pledges and reminder history
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.activePledges.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.activePledges.map((pledge) => (
                <TableRow
                  key={pledge.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setDetailsPledgeId(pledge.id)
                    setDetailsOpen(true)
                  }}
                >
                  <TableCell>{pledge.campaignName || "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(pledge.balanceRemaining)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {formatPledgeStatusLabel(pledge.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No outstanding pledges.</p>
        )}

        {data.reminderHistory.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Reminder History</p>
            <div className="space-y-2">
              {data.reminderHistory.slice(0, 5).map((row) => (
                <div key={row.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{row.reminder_type}</span>
                    <span className="text-muted-foreground">{formatDate(row.sent_at || row.created_at)}</span>
                  </div>
                  {row.contact_notes && (
                    <p className="mt-1 text-muted-foreground">{row.contact_notes}</p>
                  )}
                  {!row.delivered_externally && row.reminder_type !== "contacted" && (
                    <p className="mt-1 text-xs text-amber-700">Recorded only — not emailed</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <PledgeDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) setDetailsPledgeId(null)
        }}
        pledgeId={detailsPledgeId}
        onSaved={() => {
          void load()
        }}
        onDeleted={() => {
          setDetailsOpen(false)
          setDetailsPledgeId(null)
          void load()
        }}
      />
    </Card>
  )
}
