"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, Loader2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  fetchDepartmentActivityAction,
  fetchGroupActivityAction,
  type GroupActivityItem,
} from "@/lib/donations/donation-group-activity-actions"

type DonationGroupActivityPanelProps = {
  groupContactId?: string | null
  departmentId?: string | null
  refreshToken?: number
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfMonth() {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

export function DonationGroupActivityPanel({
  groupContactId = null,
  departmentId = null,
  refreshToken = 0,
}: DonationGroupActivityPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<GroupActivityItem[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const result = departmentId
        ? await fetchDepartmentActivityAction(departmentId)
        : groupContactId
          ? await fetchGroupActivityAction(groupContactId, { departmentId })
          : { success: false as const, error: "Nothing to load for activity." }

      if (!result.success) {
        setError(result.error)
        setItems([])
      } else {
        setItems(result.items)
      }
      setLoading(false)
    }
    void load()
  }, [groupContactId, departmentId, refreshToken])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading activity...
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  const today = startOfToday()
  const monthStart = startOfMonth()
  const upcomingCount = items.filter((item) => new Date(item.date) >= today).length
  const pastCount = items.length - upcomingCount
  const thisMonthCount = items.filter((item) => {
    const date = new Date(item.date)
    return date >= monthStart
  }).length

  return (
    <div className="space-y-6">
      <StatCardsRow equal columns={4}>
        <StatCard
          layout="header"
          fill
          tone="violet"
          label="Events"
          value={items.length}
          icon={CalendarDays}
          hint="Department activity"
        />
        <StatCard
          layout="header"
          fill
          tone="blue"
          label="Upcoming"
          value={upcomingCount}
          icon={CalendarDays}
          hint="From today forward"
        />
        <StatCard
          layout="header"
          fill
          tone="slate"
          label="Past"
          value={pastCount}
          icon={CalendarDays}
          hint="Already occurred"
        />
        <StatCard
          layout="header"
          fill
          tone="emerald"
          label="This month"
          value={thisMonthCount}
          icon={CalendarDays}
          hint="Current calendar month"
        />
      </StatCardsRow>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Events</CardTitle>
          <CardDescription>
            Department events and other non-gift activity. Individual donations are listed under
            Group giving by campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events yet. Gift totals stay under Group giving.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const content = (
                  <div className="flex items-start gap-3 rounded-md border px-3 py-2.5">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(item.date)}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </p>
                    </div>
                  </div>
                )
                return item.href ? (
                  <li key={item.id}>
                    <Link href={item.href} className="block hover:opacity-90">
                      {content}
                    </Link>
                  </li>
                ) : (
                  <li key={item.id}>{content}</li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
