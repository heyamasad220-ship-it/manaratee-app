"use client"

import { useCallback, useEffect, useState } from "react"

import { CampaignSponsorshipDialog } from "@/components/donations/campaign-sponsorship-dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { fetchCampaignSponsorshipsAction } from "@/lib/donations/campaign-sponsorship-actions"
import {
  SPONSORSHIP_PAYMENT_STATUS_LABELS,
  SPONSORSHIP_STATUS_LABELS,
  SPONSORSHIP_TYPE_LABELS,
  type CampaignSponsorshipListItem,
} from "@/lib/donations/campaign-sponsorship-types"

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

export function CampaignSponsorsTab({
  campaignId,
  canManage,
  onChanged,
}: {
  campaignId: string
  canManage: boolean
  onChanged: () => void
}) {
  const [sponsorships, setSponsorships] = useState<CampaignSponsorshipListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const loadSponsorships = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await fetchCampaignSponsorshipsAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setSponsorships([])
      setLoading(false)
      return
    }
    setSponsorships(result.sponsorships)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void loadSponsorships()
  }, [loadSponsorships])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Sponsors</h2>
        <p className="text-sm text-muted-foreground">
          Committed sponsorships for this campaign. Outreach stays on Prospects until conversion.
        </p>
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sponsor</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading sponsors…
                  </TableCell>
                </TableRow>
              ) : sponsorships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No committed sponsorships yet. Convert sponsorship prospects from Prospects.
                  </TableCell>
                </TableRow>
              ) : (
                sponsorships.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => {
                      setSelectedId(row.id)
                      setShowDialog(true)
                    }}
                  >
                    <TableCell>
                      <div className="font-medium">{row.contactName}</div>
                      {row.contactEmail ? (
                        <div className="text-xs text-muted-foreground">{row.contactEmail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.eventName || "—"}</TableCell>
                    <TableCell>{row.packageName || "Custom"}</TableCell>
                    <TableCell>{SPONSORSHIP_TYPE_LABELS[row.sponsorship_type]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(row.committed_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{SPONSORSHIP_STATUS_LABELS[row.status]}</Badge>
                    </TableCell>
                    <TableCell>{SPONSORSHIP_PAYMENT_STATUS_LABELS[row.payment_status]}</TableCell>
                    <TableCell>{formatShortDate(row.committed_date)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CampaignSponsorshipDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open)
          if (!open) setSelectedId(null)
        }}
        campaignId={campaignId}
        canManage={canManage}
        sponsorshipId={selectedId}
        onSaved={() => {
          void loadSponsorships()
          onChanged()
        }}
      />
    </div>
  )
}
