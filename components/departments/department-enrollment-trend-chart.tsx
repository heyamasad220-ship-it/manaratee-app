"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { YearComparisonYearRow } from "@/lib/programs/year-comparison"

const participantsConfig = {
  kids: { label: "Participants enrolled", color: "oklch(0.52 0.16 255)" },
}

export function DepartmentEnrollmentTrendChart({
  yearRows,
  title = "Enrollment over time",
  description = "Enrolled participants by year",
  className,
}: {
  yearRows: YearComparisonYearRow[]
  title?: string
  description?: string
  className?: string
}) {
  if (yearRows.length === 0) return null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={participantsConfig} className="h-[280px] w-full aspect-auto">
          <LineChart data={yearRows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="yearLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="kids"
              name="Participants enrolled"
              stroke="var(--color-kids)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
