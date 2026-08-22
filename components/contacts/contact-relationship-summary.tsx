"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Building2,
  GraduationCap,
  Heart,
  Store,
  Ticket,
  UsersRound,
} from "lucide-react"
import type { ContactActivityRecord, ContactActivitySummary } from "@/lib/contacts/contact-activities"
import type { ContactRelationshipSummary } from "@/lib/contacts/contact-profile-data"
import { formatContactMoney } from "@/lib/contacts/contact-profile-data"
import {
  ACCENT_STYLES,
  type DonationMetricAccent,
} from "@/components/donations/donation-metric-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ContactRelationshipSummaryCardProps = {
  contactId: string
  summary: ContactRelationshipSummary | null
  activity: ContactActivitySummary | null
  loading?: boolean
  hideTeams?: boolean
}

type ModuleCardConfig = {
  label: string
  value: string | number
  icon: LucideIcon
  records: ContactActivityRecord[]
  href?: string
  viewLabel: string
  accent: DonationMetricAccent
}

function isPaymentDonation(record: ContactActivityRecord) {
  return record.activityType === "donation_made" || record.activityType === "donation"
}

function activitySubtitle(records: ContactActivityRecord[]) {
  if (records.length === 0) return null
  const first = records[0]?.title?.trim()
  if (!first) return null
  return records.length > 1 ? `${first} and ${records.length - 1} more` : first
}

function ActivityMetricCardGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-stretch gap-3">{children}</div>
}

function ModuleMetricCard({
  label,
  value,
  icon: Icon,
  records,
  href,
  viewLabel,
  accent,
}: ModuleCardConfig) {
  const styles = ACCENT_STYLES[accent]
  const subtitle = activitySubtitle(records)

  return (
    <Card className={cn("flex w-[240px] flex-col", styles.card)}>
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className={cn("mt-0.5 text-xl font-bold tabular-nums", styles.value)}>{value}</div>
            <p className="mt-1.5 min-h-8 text-[11px] leading-4 text-muted-foreground line-clamp-2">
              {subtitle ?? "\u00A0"}
            </p>
          </div>
          <div className={cn(styles.iconWrap, "shrink-0 p-2")}>
            <Icon className={cn("h-4 w-4", styles.icon)} />
          </div>
        </div>
        {href ? (
          <div className="mt-auto pt-3">
            <Button variant="outline" size="sm" asChild className="h-8 w-full text-xs">
              <Link href={href}>{viewLabel}</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TeamsMetricCard({ count }: { count: number }) {
  const styles = ACCENT_STYLES.blue

  return (
    <Card className={cn("flex w-[240px] flex-col", styles.card)}>
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Teams</p>
            <div className="mt-0.5 text-xl font-bold tabular-nums">{count}</div>
          </div>
          <div className={cn(styles.iconWrap, "shrink-0 p-2")}>
            <UsersRound className={cn("h-4 w-4", styles.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCardSkeleton() {
  return (
    <Card className="h-[132px] w-[240px] border-l-4 border-l-muted">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-6 w-12 rounded bg-muted" />
            <div className="h-6 w-full rounded bg-muted" />
          </div>
          <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
        </div>
        <div className="mt-auto h-8 w-full rounded bg-muted" />
      </CardContent>
    </Card>
  )
}

function hasProgramActivity(summary: ContactRelationshipSummary, activity: ContactActivitySummary) {
  return summary.programsCount > 0 || activity.programs.length > 0
}

function hasTicketActivity(summary: ContactRelationshipSummary, activity: ContactActivitySummary) {
  return summary.ticketsCount > 0 || activity.ticketing.length > 0
}

function hasBookingActivity(summary: ContactRelationshipSummary, activity: ContactActivitySummary) {
  return summary.bookingsCount > 0 || activity.spaces.length > 0
}

function hasDonationActivity(summary: ContactRelationshipSummary, activity: ContactActivitySummary) {
  const donationPayments = activity.donations.filter(isPaymentDonation)
  return (
    summary.donationsCount > 0 ||
    summary.donationsTotal > 0 ||
    donationPayments.length > 0
  )
}

function hasVendorActivity(summary: ContactRelationshipSummary, activity: ContactActivitySummary) {
  return summary.vendorActivityCount > 0 || activity.vendorHub.length > 0
}

export function ContactRelationshipSummaryCard({
  contactId,
  summary,
  activity,
  loading = false,
  hideTeams = false,
}: ContactRelationshipSummaryCardProps) {
  if (loading || !summary || !activity) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Activity at a glance</h2>
          <p className="text-sm text-muted-foreground">
            Cross-module participation for this contact.
          </p>
        </div>
        <ActivityMetricCardGrid>
          {Array.from({ length: 3 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </ActivityMetricCardGrid>
      </section>
    )
  }

  const donationPayments = activity.donations.filter(isPaymentDonation)

  const moduleMetrics: ModuleCardConfig[] = []

  if (hasProgramActivity(summary, activity)) {
    moduleMetrics.push({
      label: "Program enrollments",
      value: summary.programsCount,
      icon: GraduationCap,
      records: activity.programs,
      href: "/programs/registrations",
      viewLabel: "View enrollments",
      accent: "purple",
    })
  }

  if (hasTicketActivity(summary, activity)) {
    moduleMetrics.push({
      label: "Tickets",
      value: summary.ticketsCount,
      icon: Ticket,
      records: activity.ticketing,
      href: "/event-management/ticketing",
      viewLabel: "View purchases",
      accent: "cyan",
    })
  }

  if (hasBookingActivity(summary, activity)) {
    moduleMetrics.push({
      label: "Bookings",
      value: summary.bookingsCount,
      icon: Building2,
      records: activity.spaces,
      href: "/bookings/overview",
      viewLabel: "View bookings",
      accent: "amber",
    })
  }

  if (hasDonationActivity(summary, activity)) {
    moduleMetrics.push({
      label: "Donations",
      value: formatContactMoney(summary.donationsTotal),
      icon: Heart,
      records: donationPayments,
      href: "/donations/payments/transactions",
      viewLabel: "View giving history",
      accent: "rose",
    })
  }

  if (hasVendorActivity(summary, activity)) {
    moduleMetrics.push({
      label: "Vendor activity",
      value: summary.vendorActivityCount,
      icon: Store,
      records: activity.vendorHub,
      href: `/vendor-hub/network/history?contact=${contactId}`,
      viewLabel: "View vendor activity",
      accent: "violet",
    })
  }

  const showTeams = !hideTeams && summary.teamsCount > 0
  const hasAnyMetric = showTeams || moduleMetrics.length > 0

  if (!hasAnyMetric) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Activity at a glance</h2>
        <p className="text-sm text-muted-foreground">
          No program, financial, or vendor activity recorded yet.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Activity at a glance</h2>
        <p className="text-sm text-muted-foreground">
          Cross-module participation for this contact.
        </p>
      </div>

      <ActivityMetricCardGrid>
        {showTeams ? <TeamsMetricCard count={summary.teamsCount} /> : null}
        {moduleMetrics.map((metric) => (
          <ModuleMetricCard key={metric.label} {...metric} />
        ))}
      </ActivityMetricCardGrid>
    </section>
  )
}
