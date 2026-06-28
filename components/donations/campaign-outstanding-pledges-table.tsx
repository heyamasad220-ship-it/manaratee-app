import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  type CampaignOutstandingPledgeRow,
} from "@/lib/donations/campaign-analytics"
import { formatPledgeStatusLabel } from "@/lib/donations/donation-status"

type CampaignOutstandingPledgesTableProps = {
  pledges: CampaignOutstandingPledgeRow[]
  pledgesPageHref?: string
  onDonorClick?: (pledge: CampaignOutstandingPledgeRow) => void
}

function formatPledgeDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function statusBadgeVariant(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "partial") return "secondary" as const
  if (normalized === "fulfilled" || normalized === "paid") return "default" as const
  return "outline" as const
}

export function CampaignOutstandingPledgesTable({
  pledges,
  pledgesPageHref = "/donations/pledges",
  onDonorClick,
}: CampaignOutstandingPledgesTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base">Outstanding Pledges</CardTitle>
        <a href={pledgesPageHref} className="text-sm text-primary hover:underline">
          View all pledges
        </a>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Donor</TableHead>
              <TableHead>Amount Pledged</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pledge Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pledges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No outstanding pledges for this campaign.
                </TableCell>
              </TableRow>
            ) : (
              pledges.map((pledge) => (
                <TableRow key={pledge.id}>
                  <TableCell>
                    {onDonorClick && (pledge.contactId || pledge.donorId) ? (
                      <button
                        type="button"
                        onClick={() => onDonorClick(pledge)}
                        className="font-medium text-primary hover:underline"
                      >
                        {pledge.donorName}
                      </button>
                    ) : (
                      <span className="font-medium">{pledge.donorName}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatDonationCurrency(pledge.amountPledged)}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums text-emerald-600">
                    {formatDonationCurrency(pledge.amountPaid)}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums text-amber-600">
                    {formatDonationCurrency(pledge.balanceRemaining)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(pledge.status)}>
                      {formatPledgeStatusLabel(pledge.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatPledgeDate(pledge.pledgeDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
