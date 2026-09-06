"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  CalendarDays,
  Layers,
  Loader2,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react"

import { DepartmentEnrollmentTrendChart } from "@/components/departments/department-enrollment-trend-chart"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import {
  fetchDepartmentWorkspaceOverviewAction,
  type DepartmentWorkspaceOverview,
} from "@/lib/departments/department-workspace-overview"
import {
  fetchDepartmentYearProgramsAction,
  type DepartmentYearProgramRow,
} from "@/lib/departments/department-year-actions"
import { programCountPhrase } from "@/lib/programs/program-display-labels"
import {
  getProgramStatusLabel,
  type ProgramStatus,
} from "@/lib/programs/program-status"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import {
  buildYearRows,
  filterYearComparisonFacts,
  type YearComparisonFact,
} from "@/lib/programs/year-comparison"
import { getYearComparisonFacts } from "@/lib/programs/year-comparison-queries"

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function enrollmentPhrase(count: number) {
  return `${count} ${count === 1 ? "enrollment" : "enrollments"}`
}

export function DepartmentOverviewPanel({
  departmentId,
}: {
  departmentId: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<DepartmentWorkspaceOverview | null>(
    null
  )
  const [programs, setPrograms] = useState<DepartmentYearProgramRow[]>([])
  const [facts, setFacts] = useState<YearComparisonFact[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [overviewResult, programsResult, factsResult] = await Promise.all([
      fetchDepartmentWorkspaceOverviewAction(departmentId),
      fetchDepartmentYearProgramsAction(departmentId),
      getYearComparisonFacts({ departmentId }),
    ])

    if (!overviewResult.success) {
      setError(overviewResult.error)
      setOverview(null)
      setPrograms([])
      setFacts([])
      setLoading(false)
      return
    }

    setOverview(overviewResult.overview)
    if (programsResult.success) {
      setPrograms(programsResult.data.openPrograms)
    } else {
      setPrograms([])
    }
    if (factsResult.success) {
      setFacts(factsResult.facts)
    } else {
      setFacts([])
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const yearRows = useMemo(
    () =>
      buildYearRows(
        filterYearComparisonFacts(facts, { departmentId, programKind: "all" })
      ),
    [facts, departmentId]
  )
  const latestYear = yearRows[yearRows.length - 1] ?? null

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading overview…
      </div>
    )
  }

  if (error || !overview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>{error || "Could not load overview."}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  const activePrograms = programs.filter((program) => program.status === "active")
  const activeOfferingsCount = activePrograms.reduce(
    (sum, program) => sum + Number(program.offeringCount || 0),
    0
  )
  const programsHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "programs",
  })
  const employeesHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "financial",
    finance: "employees",
  })
  const eventsHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "activity",
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">
          {overview.directorName
            ? `Director: ${overview.directorName}. `
            : null}
          Snapshot of programs, offerings, staff, and activity for this
          department.
        </p>
      </div>

      <StatCardsRow equal columns={6}>
        <Link href={programsHref} className="min-w-0">
          <StatCard
            fill
            tone="sky"
            icon={BookOpen}
            label="Programs"
            value={`${formatCount(activePrograms.length)} Active`}
          />
        </Link>
        <Link href={programsHref} className="min-w-0">
          <StatCard
            fill
            tone="violet"
            icon={Layers}
            label="Offerings"
            value={`${formatCount(activeOfferingsCount)} Active`}
          />
        </Link>
        <Link href={employeesHref} className="min-w-0">
          <StatCard
            fill
            tone="teal"
            icon={Users}
            label="Employees"
            value={formatCount(overview.staffCount)}
          />
        </Link>
        <Link href={programsHref} className="min-w-0">
          <StatCard
            fill
            tone="emerald"
            icon={UserCheck}
            label="Students"
            value={formatCount(overview.studentsCount)}
          />
        </Link>
        <Link href={eventsHref} className="min-w-0">
          <StatCard
            fill
            tone="amber"
            icon={CalendarDays}
            label="Upcoming events"
            value={formatCount(overview.upcomingEventsCount)}
          />
        </Link>
        <Link href={programsHref} className="min-w-0">
          <StatCard
            fill
            tone="indigo"
            icon={UsersRound}
            label="Families"
            value={formatCount(latestYear?.families ?? 0)}
            hint={
              latestYear
                ? `${formatCount(latestYear.returningFamilies)} returning, ${formatCount(latestYear.newFamilies)} new`
                : undefined
            }
          />
        </Link>
      </StatCardsRow>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Programs</h3>
              <p className="text-sm text-muted-foreground">
                Active programs only. Open one to manage offerings, registrations,
                and schedule.
              </p>
            </div>
            <Link
              href={programsHref}
              className="text-sm font-medium text-sky-800 underline-offset-4 hover:underline"
            >
              View all programs
            </Link>
          </div>

          {activePrograms.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No active programs</CardTitle>
                <CardDescription>
                  Closed and paused years stay on{" "}
                  <Link
                    href={programsHref}
                    className="font-medium text-sky-800 underline-offset-4 hover:underline"
                  >
                    View all programs
                  </Link>
                  .
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
              {activePrograms.map((program) => (
                <Link
                  key={program.id}
                  href={programWorkspaceHref(program.id)}
                  className="block px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="font-medium text-sky-800">{program.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    —{" "}
                    {getProgramStatusLabel(
                      (program.status as ProgramStatus) || "active"
                    )}{" "}
                    — {programCountPhrase(program.offeringCount)} —{" "}
                    {enrollmentPhrase(program.enrolled)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
          {yearRows.length > 0 ? (
            <DepartmentEnrollmentTrendChart className="h-full" yearRows={yearRows} />
          ) : (
            <Card className="h-full min-h-[280px]">
              <CardHeader>
                <CardTitle className="text-base">Enrollment over time</CardTitle>
                <CardDescription>
                  Enrolled participants will appear here once this department has
                  registrations.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
