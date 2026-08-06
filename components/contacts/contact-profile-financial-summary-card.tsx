"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  ContactDonorStats,
  ContactRentalStats,
  ContactVendorStats,
} from "@/lib/contacts/contact-profile-data"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function SummaryStat({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export function ContactProfileFinancialSummaryCard({
  profileLoading,
  donorStats,
  rentalStats,
  vendorStats = null,
  showDonationsSummary = false,
  showBookingsSummary = false,
  showVendorSummary = false,
  showProgramsHint = false,
  showMembershipHint = false,
  onOpenFinancial,
}: {
  profileLoading: boolean
  donorStats: ContactDonorStats | null
  rentalStats: ContactRentalStats | null
  vendorStats?: ContactVendorStats | null
  showDonationsSummary?: boolean
  showBookingsSummary?: boolean
  showVendorSummary?: boolean
  showProgramsHint?: boolean
  showMembershipHint?: boolean
  onOpenFinancial: () => void
}) {
  const lastGift = formatShortDate(donorStats?.lastDonationDate)
  const lastRental = formatShortDate(rentalStats?.lastRentalDate)
  const hasAnySummaryRows =
    showDonationsSummary ||
    showBookingsSummary ||
    showVendorSummary ||
    showProgramsHint ||
    showMembershipHint

  if (!hasAnySummaryRows) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {profileLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {showDonationsSummary ? (
              <>
                <SummaryStat
                  label="Lifetime giving"
                  value={formatCurrency(donorStats?.totalDonated ?? 0)}
                />
                <SummaryStat label="Gifts" value={donorStats?.donationCount ?? 0} />
                <SummaryStat label="Last gift" value={lastGift ?? "—"} />
                <SummaryStat label="Pledges" value={donorStats?.pledgeCount ?? 0} />
              </>
            ) : null}
            {showBookingsSummary ? (
              <>
                <SummaryStat label="Venue rentals" value={rentalStats?.rentalCount ?? 0} />
                <SummaryStat label="Last rental" value={lastRental ?? "—"} />
              </>
            ) : null}
            {showVendorSummary ? (
              <>
                <SummaryStat
                  label="Vendor payments"
                  value={formatCurrency(vendorStats?.paymentTotal ?? 0)}
                />
                <SummaryStat label="Vendor payment count" value={vendorStats?.paymentCount ?? 0} />
                <SummaryStat
                  label="Event participations"
                  value={vendorStats?.participationCount ?? 0}
                />
              </>
            ) : null}
            {showProgramsHint ? (
              <p className="text-sm text-muted-foreground">
                Program fees and balances are on the Financial tab.
              </p>
            ) : null}
            {showMembershipHint ? (
              <p className="text-sm text-muted-foreground">
                Membership billing details are on the Financial tab.
              </p>
            ) : null}
          </>
        )}
        <Button variant="secondary" className="w-full" onClick={onOpenFinancial}>
          View financial details
        </Button>
      </CardContent>
    </Card>
  )
}
