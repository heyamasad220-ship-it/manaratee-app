"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  Download,
  RefreshCw,
  UserMinus,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useProgramKindReportPreset } from "@/hooks/use-program-kind-report-preset"
import type { ProgramKind } from "@/lib/programs/program-kind"
import {
  buildSeriesBreakdown,
  buildYearRows,
  filterYearComparisonFacts,
  formatKidsPerFamily,
  formatPct,
  type YearComparisonFact,
  type YearComparisonYearRow,
} from "@/lib/programs/year-comparison"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"

const ALL = "all"

const CHART_BLUE = "oklch(0.52 0.16 255)"
const CHART_BLUE_LIGHT = "oklch(0.74 0.10 245)"

const participantsConfig = {
  kids: { label: "Participants enrolled", color: CHART_BLUE },
}

const familyMixConfig = {
  returningFamilies: { label: "Returning families", color: CHART_BLUE },
  newFamilies: { label: "New families", color: CHART_BLUE_LIGHT },
}

function csvEscape(value: string | number) {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ]
  const blob = new Blob([`${lines.join("\n")}\n`], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function uniqueSorted(
  facts: YearComparisonFact[],
  getId: (fact: YearComparisonFact) => string,
  getLabel: (fact: YearComparisonFact) => string
) {
  const map = new Map<string, string>()
  for (const fact of facts) {
    const id = getId(fact)
    if (!id || map.has(id)) continue
    map.set(id, getLabel(fact))
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function yearRowCsv(row: YearComparisonYearRow): Array<string | number> {
  return [
    row.yearLabel,
    row.kids,
    row.families,
    row.newFamilies,
    row.returningFamilies,
    row.droppedFamilies,
    row.newKids,
    row.returningKids,
    row.droppedKids,
    formatKidsPerFamily(row.kidsPerFamily),
    formatPct(row.kidsChangePct),
    formatPct(row.familiesChangePct),
  ]
}

function WorkspaceNameLink({
  programId,
  children,
}: {
  programId: string | null
  children: ReactNode
}) {
  if (!programId) return children
  return (
    <Link
      href={programWorkspaceHref(programId, {
        tab: "reports",
        reportsSection: "year-comparison",
      })}
      className="font-medium text-primary hover:underline"
    >
      {children}
    </Link>
  )
}

type YearComparisonReportProps = {
  facts: YearComparisonFact[]
  lockedSeriesKey?: string | null
  lockedDepartmentId?: string | null
  initialYearKey?: string | null
  hideToolbar?: boolean
  showTables?: boolean
}

export function YearComparisonReport(props: YearComparisonReportProps) {
  if (props.hideToolbar) {
    return <YearComparisonReportView {...props} kindFilter="all" />
  }
  return <YearComparisonReportWithKindPreset {...props} />
}

function YearComparisonReportWithKindPreset(props: YearComparisonReportProps) {
  const { kindFilter, setKindFilter } = useProgramKindReportPreset()
  return (
    <YearComparisonReportView
      {...props}
      kindFilter={kindFilter}
      onKindFilterChange={setKindFilter}
    />
  )
}

function YearComparisonReportView({
  facts,
  lockedSeriesKey = null,
  lockedDepartmentId = null,
  initialYearKey = null,
  hideToolbar = false,
  showTables = true,
  kindFilter,
  onKindFilterChange,
}: YearComparisonReportProps & {
  kindFilter: ProgramKind | "all"
  onKindFilterChange?: (value: ProgramKind | "all") => void
}) {
  const locked = Boolean(lockedSeriesKey)
  const [departmentFilter, setDepartmentFilter] = useState(
    lockedDepartmentId || ALL
  )
  const [seriesFilter, setSeriesFilter] = useState(lockedSeriesKey || ALL)
  const [yearFilter, setYearFilter] = useState(initialYearKey || ALL)

  const departmentOptions = useMemo(
    () => uniqueSorted(facts, (fact) => fact.departmentId, (fact) => fact.departmentName),
    [facts]
  )

  const seriesOptions = useMemo(() => {
    let scoped = facts
    if (departmentFilter !== ALL) {
      scoped = scoped.filter((fact) => fact.departmentId === departmentFilter)
    }
    if (kindFilter !== "all") {
      scoped = scoped.filter((fact) => fact.programKind === kindFilter)
    }
    return uniqueSorted(scoped, (fact) => fact.seriesKey, (fact) => fact.seriesLabel)
  }, [facts, departmentFilter, kindFilter])

  const safeSeriesFilter = useMemo(() => {
    if (locked && lockedSeriesKey) return lockedSeriesKey
    if (seriesFilter === ALL) return ALL
    return seriesOptions.some((option) => option.id === seriesFilter)
      ? seriesFilter
      : ALL
  }, [locked, lockedSeriesKey, seriesFilter, seriesOptions])

  useEffect(() => {
    if (seriesFilter !== safeSeriesFilter) setSeriesFilter(safeSeriesFilter)
  }, [seriesFilter, safeSeriesFilter])

  const filteredFacts = useMemo(
    () =>
      filterYearComparisonFacts(facts, {
        departmentId:
          locked || hideToolbar
            ? lockedDepartmentId ||
              (departmentFilter === ALL ? null : departmentFilter)
            : departmentFilter === ALL
              ? null
              : departmentFilter,
        seriesKey:
          hideToolbar || safeSeriesFilter === ALL ? null : safeSeriesFilter,
        programKind: locked || hideToolbar ? "all" : kindFilter,
      }),
    [
      facts,
      locked,
      hideToolbar,
      lockedDepartmentId,
      departmentFilter,
      safeSeriesFilter,
      kindFilter,
    ]
  )

  const yearRows = useMemo(() => buildYearRows(filteredFacts), [filteredFacts])

  const safeYearFilter = useMemo(() => {
    if (yearRows.length === 0) return ALL
    if (yearFilter !== ALL && yearRows.some((row) => row.yearKey === yearFilter)) {
      return yearFilter
    }
    return yearRows[yearRows.length - 1]!.yearKey
  }, [yearFilter, yearRows])

  useEffect(() => {
    if (yearFilter !== safeYearFilter) setYearFilter(safeYearFilter)
  }, [yearFilter, safeYearFilter])

  const selectedYear = yearRows.find((row) => row.yearKey === safeYearFilter) || null
  const seriesBreakdown = useMemo(
    () =>
      safeSeriesFilter === ALL && selectedYear
        ? buildSeriesBreakdown(filteredFacts, selectedYear.yearKey)
        : [],
    [filteredFacts, safeSeriesFilter, selectedYear]
  )

  const scopeLabel = useMemo(() => {
    const series = seriesOptions.find((option) => option.id === safeSeriesFilter)
    if (series) return series.label
    const department = departmentOptions.find((option) => option.id === departmentFilter)
    if (department) return department.label
    return "All programs"
  }, [seriesOptions, safeSeriesFilter, departmentOptions, departmentFilter])

  const selectedSeriesLabel =
    seriesOptions.find((option) => option.id === safeSeriesFilter)?.label || null

  function exportYearTable() {
    downloadCsv(
      `year-comparison-${scopeLabel.replace(/\s+/g, "-").toLowerCase()}.csv`,
      [
        "Year",
        "Participants enrolled",
        "Families",
        "New families",
        "Returning families",
        "Dropped families",
        "New participants",
        "Returning participants",
        "Dropped participants",
        "Participants per family",
        "Participants vs last year",
        "Families vs last year",
      ],
      yearRows.map(yearRowCsv)
    )
  }

  if (facts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No enrolled students yet. Year-to-year comparison appears after
        registrations are imported or submitted.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {hideToolbar ? null : (
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {locked ? null : (
          <>
        <div className="space-y-1.5 sm:w-48">
          <Label>Department</Label>
          <Select
            value={departmentFilter}
            onValueChange={(value) => {
              setDepartmentFilter(value)
              setSeriesFilter(ALL)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departmentOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-40">
          <Label>Type</Label>
          <Select
            value={kindFilter}
            onValueChange={(value) => {
              onKindFilterChange?.(value as ProgramKind | "all")
              setSeriesFilter(ALL)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="academic">Academic</SelectItem>
              <SelectItem value="seasonal">Seasonal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:min-w-[14rem] sm:flex-1">
          <Label>Program</Label>
          <Select value={safeSeriesFilter} onValueChange={setSeriesFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All programs</SelectItem>
              {seriesOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
          </>
        )}
        <div className="space-y-1.5 sm:w-44">
          <Label>Year</Label>
          <Select value={safeYearFilter} onValueChange={setYearFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearRows.map((row) => (
                <SelectItem key={row.yearKey} value={row.yearKey}>
                  {row.yearLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="sm:mb-0"
          onClick={exportYearTable}
          disabled={yearRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
      )}

      {selectedYear ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {scopeLabel}
            {selectedSeriesLabel
              ? " · returning families were in this program the previous year"
              : " · returning families were in this department the previous year"}
          </p>
          <StatCardsRow equal columns={6} className="gap-3">
            <StatCard
              layout="compact"
              fill
              tone="blue"
              label="Participants enrolled"
              value={selectedYear.kids}
              icon={Users}
              hint={formatPct(selectedYear.kidsChangePct)}
              valueClassName="text-xl"
            />
            <StatCard
              layout="compact"
              fill
              tone="violet"
              label="Families"
              value={selectedYear.families}
              icon={UsersRound}
              hint={formatPct(selectedYear.familiesChangePct)}
              valueClassName="text-xl"
            />
            <StatCard
              layout="compact"
              fill
              tone="emerald"
              label="Returning families"
              value={selectedYear.returningFamilies}
              icon={RefreshCw}
              valueClassName="text-xl"
            />
            <StatCard
              layout="compact"
              fill
              tone="sky"
              label="New families"
              value={selectedYear.newFamilies}
              icon={UserPlus}
              valueClassName="text-xl"
            />
            <StatCard
              layout="compact"
              fill
              tone="amber"
              label="Dropped families"
              value={selectedYear.droppedFamilies}
              icon={UserMinus}
              valueClassName="text-xl"
            />
            <StatCard
              layout="compact"
              fill
              tone="slate"
              label="Participants per family"
              value={formatKidsPerFamily(selectedYear.kidsPerFamily)}
              valueClassName="text-xl"
            />
          </StatCardsRow>
        </div>
      ) : null}

      {yearRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No enrollments match these filters.
        </p>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Enrollment over time</CardTitle>
                <CardDescription>
                  Enrolled participants in {scopeLabel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={participantsConfig} className="h-[280px] w-full aspect-auto">
                  <LineChart data={yearRows} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="yearLabel" axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New vs returning families</CardTitle>
                <CardDescription>
                  Compared with the previous year of the same program
                  {selectedSeriesLabel ? "" : " or department"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={familyMixConfig} className="h-[280px] w-full aspect-auto">
                  <BarChart data={yearRows} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="yearLabel" axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="returningFamilies"
                      stackId="families"
                      fill="var(--color-returningFamilies)"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="newFamilies"
                      stackId="families"
                      fill="var(--color-newFamilies)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {showTables ? (
            <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Participants</TableHead>
                  <TableHead className="text-right">Families</TableHead>
                  <TableHead className="text-right">New families</TableHead>
                  <TableHead className="text-right">Returning</TableHead>
                  <TableHead className="text-right">Dropped</TableHead>
                  <TableHead className="text-right">Participants / family</TableHead>
                  <TableHead className="text-right">Participants vs last year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearRows.map((row) => (
                  <TableRow
                    key={row.yearKey}
                    className={row.yearKey === selectedYear?.yearKey ? "bg-muted/40" : undefined}
                  >
                    <TableCell className="font-medium">
                      <WorkspaceNameLink programId={row.programId}>
                        {row.yearLabel}
                      </WorkspaceNameLink>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.kids}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.families}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.newFamilies}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.returningFamilies}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.droppedFamilies}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatKidsPerFamily(row.kidsPerFamily)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPct(row.kidsChangePct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {seriesBreakdown.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">
                Programs in {selectedYear?.yearLabel}
              </h2>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Participants</TableHead>
                      <TableHead className="text-right">Families</TableHead>
                      <TableHead className="text-right">New families</TableHead>
                      <TableHead className="text-right">Returning</TableHead>
                      <TableHead className="text-right">Dropped</TableHead>
                      <TableHead className="text-right">Participants vs last year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seriesBreakdown.map((row) => (
                      <TableRow key={row.seriesKey}>
                        <TableCell className="font-medium">
                          <WorkspaceNameLink programId={row.programId}>
                            {row.seriesLabel}
                          </WorkspaceNameLink>
                        </TableCell>
                        <TableCell>{row.departmentName}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.kids}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.families}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.newFamilies}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.returningFamilies}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.droppedFamilies}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPct(row.kidsChangePct)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
