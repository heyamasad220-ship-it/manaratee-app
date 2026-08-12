"use client"

import Link from "next/link"
import { ClipboardList, DollarSign, LayoutGrid, Star } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard, StatCardsRow, type StatCardTone } from "@/components/ui/stat-card"
import { BazaarEventFlyerSharePanel } from "@/components/vendor-hub/events/bazaar-event-flyer-share-panel"
import { BazaarEventQuickActions } from "@/components/vendor-hub/events/bazaar-event-quick-actions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"
import type { VendorHubDashboardMetrics } from "@/lib/vendor-hub/vendor-hub-types"

function isPastEvent(eventDate: string | null) {
  if (!eventDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(eventDate) < today
}

function isImportDescription(description: string | null | undefined) {
  if (!description) return false
  return /Imported from BazaarVendors\.csv/i.test(description)
}

export function BazaarEventOverviewClient({
  event,
  metrics,
  deleteBlockedReason,
}: {
  event: VendorHubEventWithInternal
  metrics: VendorHubDashboardMetrics
  deleteBlockedReason: string | null
}) {
  const eventHasPassed = isPastEvent(event.event_date)
  const showEvaluationPrompt =
    eventHasPassed &&
    metrics.vendorsParticipated > 0 &&
    metrics.vendorsPendingEvaluation > 0

  const stats: Array<{
    label: string
    value: string | number
    icon: typeof LayoutGrid
    tone: StatCardTone
    href?: string
  }> = [
    {
      label: "Booth occupancy",
      value: `${metrics.boothsAssigned}/${metrics.boothsTotal}`,
      icon: LayoutGrid,
      tone: "amber",
      href: VENDOR_HUB_ROUTES.events.booths(event.id),
    },
    {
      label: "Booth registrations",
      value: metrics.boothRegistrations,
      icon: ClipboardList,
      tone: "sky",
      href: VENDOR_HUB_ROUTES.events.booths(event.id),
    },
    {
      label: "Revenue collected",
      value: `$${metrics.revenueCollected.toFixed(2)}`,
      icon: DollarSign,
      tone: "violet",
    },
    {
      label: "Evaluations pending",
      value: metrics.vendorsPendingEvaluation,
      icon: Star,
      tone: "emerald",
      href: VENDOR_HUB_ROUTES.events.evaluations(event.id),
    },
  ]

  const description =
    event.description && !isImportDescription(event.description) ? event.description : null

  return (
    <div className="flex flex-col gap-6">
      {showEvaluationPrompt ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Rate vendors from this bazaar</p>
              <p className="text-sm text-muted-foreground">
                {metrics.vendorsPendingEvaluation} of {metrics.vendorsParticipated} participating
                vendor{metrics.vendorsParticipated === 1 ? "" : "s"} still need evaluation.
              </p>
            </div>
            <Link href={VENDOR_HUB_ROUTES.events.evaluations(event.id)}>
              <Button>Evaluate vendors</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <StatCardsRow equal columns={4}>
        {stats.map((stat) => {
          const card = (
            <StatCard
              fill
              layout="header"
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              tone={stat.tone}
              className={stat.href ? "h-full transition-shadow hover:shadow-sm" : "h-full"}
            />
          )

          if (!stat.href) {
            return (
              <div key={stat.label} className="min-w-0">
                {card}
              </div>
            )
          }

          return (
            <Link key={stat.label} href={stat.href} className="min-w-0">
              {card}
            </Link>
          )
        })}
      </StatCardsRow>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <BazaarEventFlyerSharePanel event={event} />
        <BazaarEventQuickActions event={event} deleteBlockedReason={deleteBlockedReason} />
      </div>

      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}
