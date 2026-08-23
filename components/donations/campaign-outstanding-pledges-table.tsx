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
import { PledgeDonorSubline } from "@/components/donations/pledge-donor-subline"
import {
  formatDonationCurrency,
  type CampaignOutstandingPledgeRow,
} from "@/lib/donations/campaign-analytics"
import { formatPledgeStatusLabel } from "@/lib/donations/donation-status"
import { DONATION_PLEDGES_PATH } from "@/lib/donations/donation-pledge-paths"

type CampaignOutstandingPledgesTableProps = {
  pledges: CampaignOutstandingPledgeRow[]
  pledgesPageHref?: string
  onDonorClick?: (pledge: CampaignOutstandingPledgeRow) => void
  onPledgeClick?: (pledgeId: string) => void
}

function formatPledgeDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function renderStatusBadge(status: string) {
  const normalized = status.toLowerCase()
  const label = formatPledgeStatusLabel(status)

  if (normalized === "open") {
    return (
      <Badge className="border-transparent bg-orange-100 text-orange-700 hover:bg-orange-100">
        {label}
      </Badge>
    )
  }

  if (normalized === "partial") {
    return <Badge variant="secondary">{label}</Badge>
  }

  if (normalized === "fulfilled" || normalized === "paid") {
    return <Badge variant="default">{label}</Badge>
  }

  return <Badge variant="outline">{label}</Badge>
}

export function CampaignOutstandingPledgesTable({
  pledges,
  pledgesPageHref = DONATION_PLEDGES_PATH,
  onDonorClick,
  onPledgeClick,
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
                <TableRow
                  key={pledge.id}
                  className={onPledgeClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                  onClick={onPledgeClick ? () => onPledgeClick(pledge.id) : undefined}
                >
                  <TableCell>
                    <div>
                      {onDonorClick && (pledge.contactId || pledge.donorId) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onDonorClick(pledge)
                          }}
                          className="font-medium text-primary hover:underline"
                        >
                          {pledge.donorName}
                        </button>
                      ) : (
                        <span className="font-medium">{pledge.donorName}</span>
                      )}
                      <PledgeDonorSubline
                        contactType={pledge.contactType}
                        primaryContactName={pledge.primaryContactName}
                        memberGroups={pledge.memberGroups}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatDonationCurrency(pledge.amountPledged)}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums text-emerald-600">
                    {formatDonationCurrency(pledge.amountPaid)}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums text-red-600">
                    {formatDonationCurrency(pledge.balanceRemaining)}
                  </TableCell>
                  <TableCell>{renderStatusBadge(pledge.status)}</TableCell>
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
