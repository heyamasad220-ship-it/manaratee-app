"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Download, RefreshCw, UserPlus, UsersRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ListPagination } from "@/components/ui/list-pagination"
import { PhoneText } from "@/components/ui/phone-text"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  buildCampFamilyRows,
  buildCampProgramSummary,
  buildCampTrend,
  formatCampDate,
  type CampParticipationFact,
  type CampSeason,
} from "@/lib/programs/camp-enrollment"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"

const ALL = "all"

const CHART_BLUE = "oklch(0.52 0.16 255)"
const CHART_BLUE_LIGHT = "oklch(0.74 0.10 245)"
const CHART_AMBER = "oklch(0.75 0.12 75)"
const CHART_TEAL = "oklch(0.62 0.10 180)"

const trendConfig = {
  Summer: { label: "Summer", color: CHART_BLUE },
  Fall: { label: "Fall", color: CHART_AMBER },
  Winter: { label: "Winter", color: CHART_TEAL },
  Spring: { label: "Spring", color: CHART_BLUE_LIGHT },
}

function csvEscape(value: string | number) {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
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

function seasonOptions(facts: CampParticipationFact[]) {
  const seasons = new Set<CampSeason>()
  for (const fact of facts) seasons.add(fact.season)
  return ["Summer", "Fall", "Winter", "Spring", "Specialty"].filter((season) =>
    seasons.has(season as CampSeason)
  ) as CampSeason[]
}

function yearOptions(facts: CampParticipationFact[]) {
  return [...new Set(facts.map((fact) => fact.year).filter(Boolean))].sort(
    (a, b) => b - a
  )
}

export function CampEnrollmentReport({
  facts,
}: {
  facts: CampParticipationFact[]
}) {
  const [view, setView] = useState("trend")
  const [seasonFilter, setSeasonFilter] = useState(ALL)
  const [yearFilter, setYearFilter] = useState(ALL)
  const [familySearch, setFamilySearch] = useState("")
  const [minPrograms, setMinPrograms] = useState(ALL)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)

  const filteredFacts = useMemo(() => {
    return facts.filter((fact) => {
      if (seasonFilter !== ALL && fact.season !== seasonFilter) return false
      if (yearFilter !== ALL && String(fact.year) !== yearFilter) return false
      return true
    })
  }, [facts, seasonFilter, yearFilter])

  const trend = useMemo(() => buildCampTrend(filteredFacts), [filteredFacts])
  const programRows = useMemo(
    () => buildCampProgramSummary(filteredFacts),
    [filteredFacts]
  )
  const familyRows = useMemo(
    () => buildCampFamilyRows(filteredFacts),
    [filteredFacts]
  )

  const visibleFamilies = useMemo(() => {
    const needle = familySearch.trim().toLowerCase()
    const min = minPrograms === ALL ? 0 : Number(minPrograms)
    return familyRows.filter((row) => {
      if (min > 0 && row.programCount < min) return false
      if (!needle) return true
      return (
        row.familyName.toLowerCase().includes(needle) ||
        (row.email || "").toLowerCase().includes(needle) ||
        (row.phone || "").includes(needle) ||
        row.programs.some((name) => name.toLowerCase().includes(needle))
      )
    })
  }, [familyRows, familySearch, minPrograms])

  const pagedFamilies = useMemo(
    () => slicePageItems(visibleFamilies, page, pageSize),
    [familyRows, visibleFamilies, page, pageSize]
  )

  const uniqueFamilies = useMemo(
    () => new Set(filteredFacts.map((fact) => fact.familyId)).size,
    [filteredFacts]
  )
  const returningShare = useMemo(() => {
    if (programRows.length === 0) return 0
    const last = programRows[programRows.length - 1]
    return last?.returningFamilies || 0
  }, [programRows])

  function exportTrend() {
    downloadCsv(
      "camp-enrollment-trend.csv",
      ["Year", "Fall", "Spring", "Summer", "Winter", "Specialty"],
      trend.map((row) => [
        row.year,
        row.Fall,
        row.Spring,
        row.Summer,
        row.Winter,
        row.Specialty,
      ])
    )
  }

  function exportPrograms() {
    downloadCsv(
      "camp-program-summary.csv",
      [
        "Season",
        "Year",
        "Program",
        "Families",
        "New families",
        "Returning families",
        "Dropped families",
        "Start",
        "End",
      ],
      programRows.map((row) => [
        row.season,
        row.year,
        row.programName,
        row.families,
        row.newFamilies,
        row.returningFamilies,
        row.droppedFamilies,
        row.startDate || "",
        row.endDate || "",
      ])
    )
  }

  function exportFamilies() {
    downloadCsv(
      "camp-family-participation.csv",
      [
        "Family",
        "Email",
        "Phone",
        "Programs",
        "Program list",
        "Last program",
        "Last date",
      ],
      visibleFamilies.map((row) => [
        row.familyName,
        row.email || "",
        row.phone || "",
        row.programCount,
        row.programs.join("; "),
        row.lastProgramName || "",
        row.lastProgramDate || "",
      ])
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Season</Label>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All seasons</SelectItem>
              {seasonOptions(facts).map((season) => (
                <SelectItem key={season} value={season}>
                  {season}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Year</Label>
          <Select
            value={yearFilter}
            onValueChange={(value) => {
              setYearFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All years</SelectItem>
              {yearOptions(facts).map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StatCardsRow equal columns={3} className="gap-3">
        <StatCard
          layout="compact"
          fill
          tone="violet"
          label="Families"
          value={uniqueFamilies}
          icon={UsersRound}
          hint="Unique households in the filtered camps"
          valueClassName="text-xl"
        />
        <StatCard
          layout="compact"
          fill
          tone="emerald"
          label="Camps"
          value={programRows.length}
          icon={RefreshCw}
          hint="Camp 1 and Camp 2 count as two programs"
          valueClassName="text-xl"
        />
        <StatCard
          layout="compact"
          fill
          tone="sky"
          label="Returned last camp"
          value={returningShare}
          icon={UserPlus}
          hint="Families from the previous camp who came back"
          valueClassName="text-xl"
        />
      </StatCardsRow>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="trend">Enrollment trend</TabsTrigger>
          <TabsTrigger value="programs">Program summary</TabsTrigger>
          <TabsTrigger value="families">Family participation</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={exportTrend}
              disabled={trend.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No camp enrollments match these filters.
            </p>
          ) : (
            <>
              <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                      Families by season
                    </CardTitle>
                    <CardDescription>
                      A household counts once per season even if they joined
                      both Camp 1 and Camp 2.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={trendConfig}
                    className="h-[280px] w-full aspect-auto"
                  >
                    <LineChart data={trend} margin={{ left: 4, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        type="monotone"
                        dataKey="Summer"
                        stroke="var(--color-Summer)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Fall"
                        stroke="var(--color-Fall)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Winter"
                        stroke="var(--color-Winter)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Spring"
                        stroke="var(--color-Spring)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Fall</TableHead>
                      <TableHead className="text-right">Spring</TableHead>
                      <TableHead className="text-right">Summer</TableHead>
                      <TableHead className="text-right">Winter</TableHead>
                      <TableHead className="text-right">Specialty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trend.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-medium">{row.year}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.Fall}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.Spring}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.Summer}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.Winter}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.Specialty}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="programs" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPrograms}
              disabled={programRows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {programRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No camp programs match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Season</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead className="text-right">Families</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Returning</TableHead>
                    <TableHead className="text-right">Dropped</TableHead>
                    <TableHead>Last date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programRows.map((row) => (
                    <TableRow key={row.instanceKey}>
                      <TableCell>{row.season}</TableCell>
                      <TableCell>{row.year}</TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={programWorkspaceHref(row.programId, {
                            tab: "reports",
                            reportsSection: "year-comparison",
                          })}
                          className="text-primary hover:underline"
                        >
                          {row.programName}
                        </Link>
                      </TableCell>
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
                      <TableCell>{formatCampDate(row.endDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="families" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="family-search">Search families</Label>
              <Input
                id="family-search"
                value={familySearch}
                onChange={(event) => {
                  setFamilySearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Name, email, or program"
                className="w-[240px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Minimum programs</Label>
              <Select
                value={minPrograms}
                onValueChange={(value) => {
                  setMinPrograms(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any</SelectItem>
                  <SelectItem value="2">2 or more</SelectItem>
                  <SelectItem value="3">3 or more</SelectItem>
                  <SelectItem value="4">4 or more</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={exportFamilies}
              disabled={visibleFamilies.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {visibleFamilies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No families match these filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Family</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Programs</TableHead>
                      <TableHead>Last program</TableHead>
                      <TableHead>Last date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedFamilies.map((row) => (
                      <TableRow key={row.familyId}>
                        <TableCell className="font-medium">
                          <Link
                            href={contactProfileHref(row.familyId, {
                              section: "family",
                            })}
                            className="text-primary hover:underline"
                          >
                            {row.familyName}
                          </Link>
                        </TableCell>
                        <TableCell>{row.email || "—"}</TableCell>
                        <TableCell>
                          {row.phone ? <PhoneText value={row.phone} /> : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.programCount}
                        </TableCell>
                        <TableCell>
                          {row.lastProgramId ? (
                            <Link
                              href={programWorkspaceHref(row.lastProgramId)}
                              className="text-primary hover:underline"
                            >
                              {row.lastProgramName}
                            </Link>
                          ) : (
                            row.lastProgramName || "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {formatCampDate(row.lastProgramDate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={visibleFamilies.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                entryLabel="families"
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
