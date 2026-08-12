"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Loader2 } from "lucide-react"

import {
  ProgramOfferingsListPanel,
  type ProgramDetailOfferingRow,
} from "@/components/programs/program-offerings-list-panel"
import { Card, CardContent } from "@/components/ui/card"
import {
  fetchDepartmentProgramsAction,
  type DepartmentProgramsOfferingRow,
  type DepartmentProgramsYear,
} from "@/lib/departments/department-programs"
import {
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"

export function DepartmentProgramsPanel({
  departmentId,
  departmentName,
  initialYearProgramId = null,
}: {
  departmentId: string
  departmentName: string
  /** Year/season already selected in the department year workspace. */
  initialYearProgramId?: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [years, setYears] = useState<DepartmentProgramsYear[]>([])
  const [offerings, setOfferings] = useState<DepartmentProgramsOfferingRow[]>([])

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
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const selectedYear = useMemo(() => {
    if (
      initialYearProgramId &&
      years.some((year) => year.id === initialYearProgramId)
    ) {
      return years.find((year) => year.id === initialYearProgramId) ?? null
    }
    return years[0] ?? null
  }, [initialYearProgramId, years])

  const yearOfferings = useMemo(() => {
    if (!selectedYear) return []
    return offerings.filter((row) => row.yearProgramId === selectedYear.id)
  }, [offerings, selectedYear])

  const activeRows: ProgramDetailOfferingRow[] = useMemo(
    () =>
      yearOfferings
        .filter((row) => row.offering.status !== "archived")
        .map((row) => ({
          offering: row.offering,
          enrolled: row.enrolled,
          primaryInstructor: row.primaryInstructor,
          tuitionAmount: row.tuitionAmount,
          daysLabel: row.daysLabel,
          timesLabel: row.timesLabel,
        })),
    [yearOfferings]
  )

  const archivedRows: ProgramDetailOfferingRow[] = useMemo(
    () =>
      yearOfferings
        .filter((row) => row.offering.status === "archived")
        .map((row) => ({
          offering: row.offering,
          enrolled: row.enrolled,
          primaryInstructor: row.primaryInstructor,
          tuitionAmount: row.tuitionAmount,
          daysLabel: row.daysLabel,
          timesLabel: row.timesLabel,
        })),
    [yearOfferings]
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

  if (years.length === 0 || !selectedYear) {
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
    <ProgramOfferingsListPanel
      program={selectedYear}
      departmentId={departmentId}
      rows={activeRows}
      archivedCount={archivedRows.length}
      showArchived={archivedRows}
    />
  )
}
