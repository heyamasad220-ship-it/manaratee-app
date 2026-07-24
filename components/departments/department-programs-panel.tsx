"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Loader2 } from "lucide-react"

import {
  ProgramOfferingsListPanel,
  type ProgramDetailOfferingRow,
} from "@/components/programs/program-offerings-list-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchDepartmentProgramsAction,
  type DepartmentProgramsOfferingRow,
  type DepartmentProgramsYear,
} from "@/lib/departments/department-programs"
import { formatOfferingEnrollmentLabel } from "@/lib/programs/program-catalog-capacity"
import {
  PROGRAM_LABEL,
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"
import { formatOfferingDateRange } from "@/lib/programs/program-offering-display"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  OFFERING_DELIVERY_FORMAT_LABELS,
  PROGRAM_OFFERING_STATUS_LABELS,
} from "@/lib/programs/program-offering-types"

const OFFERING_TYPE_LABELS: Record<string, string> = {
  standard: "Standard",
  academic_year: "Academic year",
  summer: "Summer",
  season: "Season",
  recurring: "Recurring",
}

const ALL_YEARS = "all"

function defaultYearFilter(
  years: DepartmentProgramsYear[],
  initialYearProgramId?: string | null
) {
  if (
    initialYearProgramId &&
    years.some((year) => year.id === initialYearProgramId)
  ) {
    return initialYearProgramId
  }
  return years[0]?.id ?? ALL_YEARS
}

export function DepartmentProgramsPanel({
  departmentId,
  departmentName,
  initialYearProgramId = null,
}: {
  departmentId: string
  departmentName: string
  /** Prefill year/season filter (e.g. redirect from year detail Programs tab). */
  initialYearProgramId?: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [years, setYears] = useState<DepartmentProgramsYear[]>([])
  const [offerings, setOfferings] = useState<DepartmentProgramsOfferingRow[]>([])
  const [yearFilter, setYearFilter] = useState<string>(
    initialYearProgramId || ALL_YEARS
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentProgramsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setYears([])
      setOfferings([])
      setLoading(false)
      return
    }
    setYears(result.years)
    setOfferings(result.offerings)
    setYearFilter((current) => {
      if (current !== ALL_YEARS && result.years.some((y) => y.id === current)) {
        return current
      }
      return defaultYearFilter(result.years, initialYearProgramId)
    })
    setLoading(false)
  }, [departmentId, initialYearProgramId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!initialYearProgramId) return
    if (years.some((year) => year.id === initialYearProgramId)) {
      setYearFilter(initialYearProgramId)
    }
  }, [initialYearProgramId, years])

  const selectedYear = useMemo(
    () => years.find((year) => year.id === yearFilter) ?? null,
    [years, yearFilter]
  )

  const yearOfferings = useMemo(() => {
    if (!selectedYear) return []
    return offerings.filter((row) => row.yearProgramId === selectedYear.id)
  }, [offerings, selectedYear])

  const activeRows: ProgramDetailOfferingRow[] = useMemo(
    () =>
      yearOfferings
        .filter((row) => row.offering.status !== "archived")
        .map((row) => ({ offering: row.offering, enrolled: row.enrolled })),
    [yearOfferings]
  )

  const archivedRows: ProgramDetailOfferingRow[] = useMemo(
    () =>
      yearOfferings
        .filter((row) => row.offering.status === "archived")
        .map((row) => ({ offering: row.offering, enrolled: row.enrolled })),
    [yearOfferings]
  )

  const allActiveOfferings = useMemo(
    () => offerings.filter((row) => row.offering.status !== "archived"),
    [offerings]
  )

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading {PROGRAM_LABEL_PLURAL.toLowerCase()}...
      </p>
    )
  }

  if (error) {
    return <p className="py-6 text-sm text-destructive">{error}</p>
  }

  if (years.length === 0) {
    return (
      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-2 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <BookOpen className="size-4" />
            {PROGRAM_LABEL_PLURAL}
          </h2>
          <p className="text-sm text-muted-foreground">
            No open {YEAR_SEASON_LABEL_PLURAL.toLowerCase()} for {departmentName}.
            Add a {YEAR_SEASON_LABEL.toLowerCase()} on Overview first, then create{" "}
            {PROGRAM_LABEL_PLURAL.toLowerCase()} here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {years.length > 1 ? (
        <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="dept-programs-year">{YEAR_SEASON_LABEL}</Label>
            <select
              id="dept-programs-year"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="h-9 min-w-[14rem] rounded-md border bg-background px-3 text-sm"
            >
              <option value={ALL_YEARS}>
                All {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}
              </option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {selectedYear ? (
        <ProgramOfferingsListPanel
          program={selectedYear}
          rows={activeRows}
          archivedCount={archivedRows.length}
          showArchived={archivedRows}
        />
      ) : (
        <AllYearsOfferingsTable
          departmentName={departmentName}
          rows={allActiveOfferings}
        />
      )}
    </div>
  )
}

function AllYearsOfferingsTable({
  departmentName,
  rows,
}: {
  departmentName: string
  rows: DepartmentProgramsOfferingRow[]
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {PROGRAM_LABEL_PLURAL}
          </h2>
          <p className="text-sm text-muted-foreground">
            All open {YEAR_SEASON_LABEL_PLURAL.toLowerCase()} for {departmentName}.
            Select a {YEAR_SEASON_LABEL.toLowerCase()} above to add or manage{" "}
            {PROGRAM_LABEL_PLURAL.toLowerCase()}.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No {PROGRAM_LABEL_PLURAL.toLowerCase()} yet across open{" "}
            {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{PROGRAM_LABEL}</TableHead>
                  <TableHead>{YEAR_SEASON_LABEL}</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ offering, enrolled, yearProgramId, yearProgramName }) => {
                  const dateRange = formatOfferingDateRange(
                    offering.start_date,
                    offering.end_date
                  )
                  return (
                    <TableRow key={offering.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={programOfferingManageHref(
                            yearProgramId,
                            offering.id
                          )}
                          className="text-sky-600 hover:text-sky-700 hover:underline"
                        >
                          {offering.name}
                        </Link>
                      </TableCell>
                      <TableCell>{yearProgramName}</TableCell>
                      <TableCell>
                        {
                          OFFERING_DELIVERY_FORMAT_LABELS[
                            offering.delivery_format ?? "in_person"
                          ]
                        }
                      </TableCell>
                      <TableCell>
                        {OFFERING_TYPE_LABELS[offering.offering_type] ||
                          offering.offering_type}
                      </TableCell>
                      <TableCell>{dateRange}</TableCell>
                      <TableCell>
                        {formatOfferingEnrollmentLabel(enrolled, offering)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {PROGRAM_OFFERING_STATUS_LABELS[offering.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
