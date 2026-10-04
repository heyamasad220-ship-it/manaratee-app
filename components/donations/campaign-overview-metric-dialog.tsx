"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatDonationCurrency,
} from "@/lib/donations/campaign-analytics"
import type {
  CampaignOverviewMetricDetail,
  CampaignOverviewMetricDetailLine,
} from "@/lib/donations/campaign-overview-metric-details"

type CampaignOverviewMetricDialogProps = {
  detail: CampaignOverviewMetricDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLineClick?: (line: CampaignOverviewMetricDetailLine) => void
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—"
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  const date = dateOnly ? new Date(`${dateOnly}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function CampaignOverviewMetricDialog({
  detail,
  open,
  onOpenChange,
  onLineClick,
}: CampaignOverviewMetricDialogProps) {
  const lines = detail?.lines ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{detail?.title ?? "Overview"}</DialogTitle>
          <DialogDescription>{detail?.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nothing in this total yet
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => {
                  const canOpen = Boolean(onLineClick && (line.contactId || line.donorId))
                  return (
                    <TableRow key={`${line.method}-${line.id}`}>
                      <TableCell className="font-medium">
                        {canOpen ? (
                          <button
                            type="button"
                            onClick={() => onLineClick?.(line)}
                            className="text-primary hover:underline"
                          >
                            {line.name}
                          </button>
                        ) : (
                          line.name
                        )}
                      </TableCell>
                      <TableCell>{line.method}</TableCell>
                      <TableCell>{formatShortDate(line.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDonationCurrency(line.amount)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
