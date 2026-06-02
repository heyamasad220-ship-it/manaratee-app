"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Building2,
  GraduationCap,
  Heart,
  Store,
  Tags,
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
  summary: ContactRelationshipSummary | null
  activity: ContactActivitySummary | null
  loading?: boolean
}

type MetricCardConfig = {
  label: string
  value: string | number
  icon: LucideIcon
}

type ModuleCardConfig = {
  label: string
  value: string | number
  icon: LucideIcon
  records: ContactActivityRecord[]
  href?: string
  emptyStatus: string
  viewLabel: string
}

function isPaymentDonation(record: ContactActivityRecord) {
  return record.activityType === "donation_made" || record.activityType === "donation"
}

function MetricCard({ label, value, icon: Icon }: MetricCardConfig) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function ModuleMetricCard({
  label,
  value,
  icon: Icon,
  records,
  href,
  emptyStatus,
  viewLabel,
}: ModuleCardConfig) {
  const hasRecords = records.length > 0

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>

        {hasRecords ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {records[0]?.title}
            {records.length > 1 ? ` and ${records.length - 1} more` : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{emptyStatus}</p>
        )}

        <div className="mt-auto pt-3">
          {hasRecords && href ? (
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href={href}>{viewLabel}</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled className="w-full">
              {hasRecords ? viewLabel : "No records"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCardSkeleton() {
  return (
    <Card>
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

export function ContactRelationshipSummaryCard({
  summary,
  activity,
  loading = false,
}: ContactRelationshipSummaryCardProps) {
  if (loading || !summary || !activity) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Relationship Summary</h2>
          <p className="text-sm text-muted-foreground">
            360° overview of affiliations, teams, and cross-module activity.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
      </section>
    )
  }

  const donationPayments = activity.donations.filter(isPaymentDonation)
  const donationsDisplay =
    summary.donationsCount > 0 || summary.donationsTotal > 0
      ? formatContactMoney(summary.donationsTotal)
      : "$0"

  const overviewMetrics: MetricCardConfig[] = [
    { label: "Affiliations", value: summary.affiliationsCount, icon: Tags },
    { label: "Teams", value: summary.teamsCount, icon: UsersRound },
  ]

  const moduleMetrics: ModuleCardConfig[] = [
    {
      label: "Programs",
      value: summary.programsCount,
      icon: GraduationCap,
      records: activity.programs,
      href: "/programs/registrations",
      emptyStatus: "No program registrations yet.",
      viewLabel: "View registrations",
    },
    {
      label: "Tickets",
      value: summary.ticketsCount,
      icon: Ticket,
      records: activity.ticketing,
      href: "/events/tickets",
      emptyStatus: "No ticket purchases yet.",
      viewLabel: "View purchases",
    },
    {
      label: "Bookings",
      value: summary.bookingsCount,
      icon: Building2,
      records: activity.spaces,
      href: "/bookings/overview",
      emptyStatus: "No venue bookings yet.",
      viewLabel: "View bookings",
    },
    {
      label: "Donations",
      value: donationsDisplay,
      icon: Heart,
      records: donationPayments,
      href: "/donations/payments",
      emptyStatus: "No donations or pledges yet.",
      viewLabel: "View giving history",
    },
    {
      label: "Vendor Activity",
      value: summary.vendorActivityCount,
      icon: Store,
      records: activity.vendorHub,
      href: "/vendor-hub/vendors",
      emptyStatus: "No vendor applications or participation yet.",
      viewLabel: "View vendor activity",
    },
  ]

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Relationship Summary</h2>
          <p className="text-sm text-muted-foreground">
            360° overview of affiliations, teams, and cross-module activity.
          </p>
        </div>
        {activity.hasTransactionalActivity ? (
          <Badge variant="outline" className="w-fit shrink-0">
            Active participant
          </Badge>
        ) : (
          <Badge variant="secondary" className="w-fit shrink-0">
            No transactional activity yet
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
        {moduleMetrics.map((metric) => (
          <ModuleMetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  )
}
