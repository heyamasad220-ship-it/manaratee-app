"use client"

import type { ReactNode } from "react"
import {
  Activity,
  DollarSign,
  HandCoins,
  NotebookPen,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import type {
  ContactDonorStats,
  ContactRentalStats,
  ContactTimelineItem,
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

function RailStat({
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

export function ContactProfileOverviewRail({
  modules,
  profileLoading,
  donorStats,
  rentalStats,
  timeline,
  showFinancialSummary,
  showRegisterAction,
  showActivityFeed = true,
  onAddDonation,
  onAddPledge,
  onAddNote,
  onRegisterProgram,
  onOpenFinancial,
  onOpenActivity,
}: {
  modules: ContactProfileModuleFlags
  profileLoading: boolean
  donorStats: ContactDonorStats | null
  rentalStats: ContactRentalStats | null
  timeline: ContactTimelineItem[]
  showFinancialSummary: boolean
  showRegisterAction: boolean
  showActivityFeed?: boolean
  onAddDonation?: () => void
  onAddPledge?: () => void
  onAddNote: () => void
  onRegisterProgram?: () => void
  onOpenFinancial: () => void
  onOpenActivity: () => void
}) {
  const lastGift = formatShortDate(donorStats?.lastDonationDate)
  const lastRental = formatShortDate(rentalStats?.lastRentalDate)

  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {modules.donations && onAddDonation ? (
            <Button variant="outline" className="justify-start" onClick={onAddDonation}>
              <DollarSign className="mr-2 h-4 w-4" />
              Add Donation
            </Button>
          ) : null}
          {modules.donations && onAddPledge ? (
            <Button variant="outline" className="justify-start" onClick={onAddPledge}>
              <HandCoins className="mr-2 h-4 w-4" />
              Add Pledge
            </Button>
          ) : null}
          <Button variant="outline" className="justify-start" onClick={onAddNote}>
            <NotebookPen className="mr-2 h-4 w-4" />
            Add Note
          </Button>
          {showRegisterAction && onRegisterProgram ? (
            <Button variant="outline" className="justify-start" onClick={onRegisterProgram}>
              <Users className="mr-2 h-4 w-4" />
              Register for Program
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {showFinancialSummary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profileLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {modules.donations ? (
                  <>
                    <RailStat
                      label="Lifetime giving"
                      value={formatCurrency(donorStats?.totalDonated ?? 0)}
                    />
                    <RailStat label="Gifts" value={donorStats?.donationCount ?? 0} />
                    <RailStat label="Last gift" value={lastGift ?? "—"} />
                    <RailStat label="Pledges" value={donorStats?.pledgeCount ?? 0} />
                  </>
                ) : null}
                {modules.bookings ? (
                  <>
                    <RailStat label="Venue rentals" value={rentalStats?.rentalCount ?? 0} />
                    <RailStat label="Last rental" value={lastRental ?? "—"} />
                  </>
                ) : null}
                {!modules.donations && !modules.bookings && modules.programs ? (
                  <p className="text-sm text-muted-foreground">
                    Program fees and balances are on the Financial tab.
                  </p>
                ) : null}
              </>
            )}
            <Button variant="secondary" className="w-full" onClick={onOpenFinancial}>
              View financial details
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showActivityFeed ? (
        <ContactProfileOverviewActivityCard
          profileLoading={profileLoading}
          timeline={timeline}
          onOpenActivity={onOpenActivity}
        />
      ) : null}
    </aside>
  )
}

export function ContactProfileOverviewActivityCard({
  profileLoading,
  timeline,
  onOpenActivity,
}: {
  profileLoading: boolean
  timeline: ContactTimelineItem[]
  onOpenActivity: () => void
}) {
  const recentItems = timeline.slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Activity</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {profileLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : recentItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {recentItems.map((item) => {
              const dateLabel = formatShortDate(item.date)
              return (
                <li
                  key={item.id}
                  className="min-w-0 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[item.module, dateLabel].filter(Boolean).join(" · ")}
                    {item.amount != null ? ` · ${formatCurrency(item.amount)}` : ""}
                  </p>
                  {item.subtitle ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        <Button variant="ghost" className="h-8 w-full px-0 text-sm" onClick={onOpenActivity}>
          View all activity
        </Button>
      </CardContent>
    </Card>
  )
}
