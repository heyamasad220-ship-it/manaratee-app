"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { DonationGivingBreakdown } from "@/lib/donations/donation-list-actions"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

const GIVING_LINE_COLOR = "oklch(0.52 0.16 255)"

function formatPeriodLabel(value: string) {
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

export function DonationGivingCharts({
  breakdown,
  loading,
}: {
  breakdown: DonationGivingBreakdown | null
  loading: boolean
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading charts...</p>
  }

  const byMonth = breakdown?.byMonth ?? []
  const showDots = byMonth.length <= 14

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Giving over time</CardTitle>
        <CardDescription>Net received payments in the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        {byMonth.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No gifts in this period.</p>
        ) : (
          <ChartContainer
            config={{ amount: { label: "Collected", color: GIVING_LINE_COLOR } }}
            className="h-[280px] w-full aspect-auto"
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
                tickFormatter={(value) => formatDonationCurrency(Number(value || 0))}
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
