"use client"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

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
}

function isPaymentDonation(record: ContactActivityRecord) {
  return record.activityType === "donation_made" || record.activityType === "donation"
}

function ModuleMetricCard({ label, value, icon: Icon, records, href, viewLabel }: ModuleCardConfig) {
  return (
    <Card className="flex w-fit flex-col">
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <p className="mt-2 text-xs text-muted-foreground">
          {records[0]?.title}
          {records.length > 1 ? ` and ${records.length - 1} more` : ""}
        </p>
        {href ? (
          <div className="mt-auto pt-3">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href={href}>{viewLabel}</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TeamsMetricCard({ count }: { count: number }) {
  return (
    <Card className="w-fit">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-muted-foreground" />
          <div className="text-2xl font-bold tabular-nums">{count}</div>
        </div>
        <div className="text-sm text-muted-foreground">Teams</div>
      </CardContent>
    </Card>
  )
}

function MetricCardSkeleton() {
  return (
    <Card className="w-fit">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-8 w-16 rounded bg-muted" />
        </div>
        <div className="mt-1 h-4 w-24 rounded bg-muted" />
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
        <div className="flex flex-wrap gap-4 [&>*]:w-fit">
          {Array.from({ length: 3 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
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
    })
  }

  if (hasDonationActivity(summary, activity)) {
    moduleMetrics.push({
      label: "Donations",
      value: formatContactMoney(summary.donationsTotal),
      icon: Heart,
      records: donationPayments,
      href: "/donations/payments",
      viewLabel: "View giving history",
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Activity at a glance</h2>
          <p className="text-sm text-muted-foreground">
            Cross-module participation for this contact.
          </p>
        </div>
        {activity.hasTransactionalActivity ? (
          <Badge variant="outline" className="w-fit shrink-0">
            Active participant
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4 [&>*]:w-fit">
        {showTeams ? <TeamsMetricCard count={summary.teamsCount} /> : null}
        {moduleMetrics.map((metric) => (
          <ModuleMetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  )
}
