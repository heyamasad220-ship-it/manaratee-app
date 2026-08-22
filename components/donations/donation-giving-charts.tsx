"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { DonationGivingBreakdown } from "@/lib/donations/donation-list-actions"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

function formatMonthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value
  const date = new Date(`${value}-01T00:00:00`)
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
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
  const byMethod = breakdown?.byMethod ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
              config={{ amount: { label: "Collected", color: "hsl(var(--chart-1))" } }}
              className="h-[280px] w-full"
            >
              <BarChart data={byMonth.map((row) => ({ ...row, monthLabel: formatMonthLabel(row.month) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} />
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
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giving by method</CardTitle>
          <CardDescription>From stored payment sources, not assumed card/ACH types</CardDescription>
        </CardHeader>
        <CardContent>
          {byMethod.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No gifts in this period.</p>
          ) : (
            <ChartContainer
              config={{ amount: { label: "Collected", color: "hsl(var(--chart-2))" } }}
              className="h-[280px] w-full"
            >
              <BarChart data={byMethod} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatDonationCurrency(Number(value || 0))}
                />
                <YAxis type="category" dataKey="method" axisLine={false} tickLine={false} width={80} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatDonationCurrency(Number(value || 0))}
                    />
                  }
                />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
