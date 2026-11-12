"use client"

import { useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DonationGivingBreakdown } from "@/lib/donations/donation-list-actions"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { cn } from "@/lib/utils"

type GivingInterval = "12m" | "all" | "quarter"
type GivingPoint = { month: string; amount: number; count: number }
type YearMonth = { year: number; month: number }

const GIVING_LINE_COLOR = "oklch(0.52 0.16 255)"

function formatPeriodLabel(value: string) {
  const quarter = /^(\d{4})-Q([1-4])$/.exec(value)
  if (quarter) return `Q${quarter[2]} ${quarter[1].slice(2)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(`${value}-01T12:00:00`)
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
  }
  return value
}

function parseYearMonth(value: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})/.exec(value)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year: Number(match[1]), month }
}

function monthKey(value: YearMonth) {
  return `${value.year}-${String(value.month).padStart(2, "0")}`
}

function shiftMonth(value: YearMonth, delta: number): YearMonth {
  const date = new Date(value.year, value.month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

function compareYearMonth(a: YearMonth, b: YearMonth) {
  return a.year === b.year ? a.month - b.month : a.year - b.year
}

function fillMonths(points: GivingPoint[], start: YearMonth, end: YearMonth): GivingPoint[] {
  const amounts = new Map<string, GivingPoint>()
  for (const point of points) {
    const parsed = parseYearMonth(point.month)
    if (!parsed) continue
    const key = monthKey(parsed)
    const current = amounts.get(key) || { month: key, amount: 0, count: 0 }
    current.amount += point.amount
    current.count += point.count
    amounts.set(key, current)
  }

  const filled: GivingPoint[] = []
  let cursor = start
  while (compareYearMonth(cursor, end) <= 0 && filled.length < 240) {
    const key = monthKey(cursor)
    filled.push(amounts.get(key) || { month: key, amount: 0, count: 0 })
    cursor = shiftMonth(cursor, 1)
  }
  return filled
}

function givingSeries(points: GivingPoint[], interval: GivingInterval, now = new Date()): GivingPoint[] {
  const dated = points.filter((point) => parseYearMonth(point.month))
  if (dated.length === 0) return []

  const end = { year: now.getFullYear(), month: now.getMonth() + 1 }
  if (interval === "12m") {
    return fillMonths(dated, shiftMonth(end, -11), end)
  }

  const first = dated.reduce<YearMonth>((earliest, point) => {
    const parsed = parseYearMonth(point.month) as YearMonth
    return compareYearMonth(parsed, earliest) < 0 ? parsed : earliest
  }, parseYearMonth(dated[0].month) as YearMonth)

  if (interval === "all") {
    const start = compareYearMonth(first, end) > 0 ? end : first
    return fillMonths(dated, start, end)
  }

  const quarterStartMonth = Math.floor((first.month - 1) / 3) * 3 + 1
  const start = { year: first.year, month: quarterStartMonth }
  const endQuarterMonth = Math.floor((end.month - 1) / 3) * 3 + 1
  const quarterEnd = shiftMonth({ year: end.year, month: endQuarterMonth }, 2)
  const monthly = fillMonths(dated, start, quarterEnd)
  const quarters = new Map<string, GivingPoint>()
  for (const point of monthly) {
    const parsed = parseYearMonth(point.month) as YearMonth
    const quarter = Math.floor((parsed.month - 1) / 3) + 1
    const key = `${parsed.year}-Q${quarter}`
    const current = quarters.get(key) || { month: key, amount: 0, count: 0 }
    current.amount += point.amount
    current.count += point.count
    quarters.set(key, current)
  }
  return [...quarters.values()]
}

function formatAxisCurrency(value: number) {
  const amount = Math.abs(value)
  if (amount >= 1000) {
    const compact = value / 1000
    const digits = Math.abs(compact) >= 10 || Number.isInteger(compact) ? 0 : 1
    return `$${compact.toFixed(digits)}k`
  }
  return formatDonationCurrency(value)
}

export function DonationGivingCharts({
  breakdown,
  loading,
  description = "Net received payments in the selected period",
  compact = false,
}: {
  breakdown: DonationGivingBreakdown | null
  loading: boolean
  description?: string
  compact?: boolean
}) {
  const [interval, setInterval] = useState<GivingInterval>("12m")

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading charts...</p>
  }

  const byMonth = compact ? givingSeries(breakdown?.byMonth ?? [], interval) : (breakdown?.byMonth ?? [])
  const showDots = byMonth.length <= 14

  return (
    <Card className={cn("h-full", compact && "gap-3")}>
      <CardHeader
        className={
          compact
            ? "flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2"
            : undefined
        }
      >
        <div className="min-w-0">
          <CardTitle className={compact ? "text-sm" : "text-base"}>Giving over time</CardTitle>
          <CardDescription className={compact ? "text-xs" : undefined}>{description}</CardDescription>
        </div>
        {compact ? (
          <Select value={interval} onValueChange={(value) => setInterval(value as GivingInterval)}>
            <SelectTrigger className="h-7 w-[9.25rem] shrink-0 text-xs" aria-label="Giving over time interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="quarter">By quarter</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col", compact && "p-4 pt-2")}>
        {byMonth.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No gifts in this period.</p>
        ) : (
          <ChartContainer
            config={{ amount: { label: "Collected", color: GIVING_LINE_COLOR } }}
            className={cn("w-full aspect-auto", compact ? "h-full min-h-[180px]" : "h-[280px]")}
          >
            <LineChart
              data={byMonth.map((row) => ({ ...row, monthLabel: formatPeriodLabel(row.month) }))}
              margin={{ left: 8, right: 12, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={compact ? 36 : 48}
                tick={{ fontSize: compact ? 11 : 12 }}
                tickFormatter={(value) =>
                  compact
                    ? formatAxisCurrency(Number(value || 0))
                    : formatDonationCurrency(Number(value || 0))
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatDonationCurrency(Number(value || 0))}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="amount"
                name="Collected"
                stroke={GIVING_LINE_COLOR}
                fill="none"
                strokeWidth={2.5}
                dot={showDots ? { r: 3, fill: GIVING_LINE_COLOR, strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: GIVING_LINE_COLOR, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
