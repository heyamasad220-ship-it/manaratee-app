"use client"

import Link from "next/link"
import { useState } from "react"
import {
  DollarSign,
  LayoutGrid,
  Mail,
  Star,
  Store,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BazaarEventFlyerSharePanel } from "@/components/vendor-hub/events/bazaar-event-flyer-share-panel"
import { BazaarEventLifecycleActions } from "@/components/vendor-hub/events/bazaar-event-lifecycle-actions"
import { CopyBazaarEventButton } from "@/components/vendor-hub/events/copy-bazaar-event-button"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"
import type { VendorHubDashboardMetrics } from "@/lib/vendor-hub/vendor-hub-types"

function isPastEvent(eventDate: string | null) {
  if (!eventDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(eventDate) < today
}

export function BazaarEventOverviewClient({
  event,
  metrics,
}: {
  event: VendorHubEventWithInternal
  metrics: VendorHubDashboardMetrics
}) {
  const eventHasPassed = isPastEvent(event.event_date)
  const showEvaluationPrompt =
    eventHasPassed &&
    metrics.vendorsParticipated > 0 &&
    metrics.vendorsPendingEvaluation > 0

  const stats = [
    { label: "Booth reservations", value: metrics.boothsAssigned, icon: Store },
    {
      label: "Booth occupancy",
      value: `${metrics.boothsAssigned}/${metrics.boothsTotal}`,
      icon: LayoutGrid,
    },
    {
      label: "Revenue collected",
      value: `$${metrics.revenueCollected.toFixed(2)}`,
      icon: DollarSign,
    },
    {
      label: "Evaluations pending",
      value: metrics.vendorsPendingEvaluation,
      icon: Star,
    },
  ]

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

      <BazaarEventLifecycleActions event={event} />

      <BazaarEventFlyerSharePanel event={event} />

      {event.description ? (
        <p className="text-sm text-muted-foreground">{event.description}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={VENDOR_HUB_ROUTES.events.applications(event.id)}>
          <Button variant="outline">View reservations</Button>
        </Link>
        <Link href={VENDOR_HUB_ROUTES.events.messages(event.id)}>
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Message vendors
          </Button>
        </Link>
        <Link href={VENDOR_HUB_ROUTES.network.onboarding}>
          <Button variant="outline">Vendor onboarding</Button>
        </Link>
        <Link href={VENDOR_HUB_ROUTES.events.booths(event.id)}>
          <Button variant="outline">Manage booths</Button>
        </Link>
        <Link href={VENDOR_HUB_ROUTES.events.payments(event.id)}>
          <Button variant="outline">Record payments</Button>
        </Link>
        <Link href={VENDOR_HUB_ROUTES.events.evaluations(event.id)}>
          <Button variant="outline">Vendor evaluations</Button>
        </Link>
        <CopyBazaarEventButton eventId={event.id} eventName={event.name} />
      </div>
    </div>
  )
}
