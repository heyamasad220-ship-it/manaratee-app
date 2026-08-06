"use client"

import {
  Activity,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ContactTimelineItem } from "@/lib/contacts/contact-profile-data"

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
