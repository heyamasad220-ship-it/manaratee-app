"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  Layers,
  Loader2,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react"

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

function formatUsd(value: number) {
  const rounded = Math.round(value * 100) / 100
  const whole = Math.abs(rounded - Math.round(rounded)) < 0.009
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded)
}

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [overviewResult, programsResult] = await Promise.all([
      fetchDepartmentWorkspaceOverviewAction(departmentId),
      fetchDepartmentYearProgramsAction(departmentId),
    ])

    if (!overviewResult.success) {
      setError(overviewResult.error)
      setOverview(null)
      setPrograms([])
      setLoading(false)
      return
    }

    setOverview(overviewResult.overview)
    if (programsResult.success) {
      setPrograms(programsResult.data.openPrograms)
    } else {
      setPrograms([])
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

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

  const offeringsCount = programs.reduce(
    (sum, program) => sum + Number(program.offeringCount || 0),
    0
  )
  const programsHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "programs",
  })
  const employeesHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "employees",
  })
  const eventsHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "activity",
  })
  const financialHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "financial",
    finance: "budget",
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

      <StatCardsRow equal columns={5}>
        <Link href={programsHref} className="min-w-0">
          <StatCard
            fill
            tone="sky"
            icon={BookOpen}
            label="Programs"
            value={formatCount(programs.length)}
            hint="Years and seasons"
          />
        </Link>
        <Link href={programsHref} className="min-w-0">
          <StatCard
            fill
            tone="violet"
            icon={Layers}
            label="Offerings"
            value={formatCount(offeringsCount)}
            hint="Courses and classes"
          />
        </Link>
        <Link href={employeesHref} className="min-w-0">
          <StatCard
            fill
            tone="teal"
            icon={Users}
            label="Employees"
            value={formatCount(overview.staffCount)}
            hint="Assigned to this department"
          />
        </Link>
        <Link href={programsHref} className="min-w-0">
          <StatCard
            fill
            tone="emerald"
            icon={UserCheck}
            label="Students"
            value={formatCount(overview.studentsCount)}
            hint="On open programs"
          />
        </Link>
        <Link href={eventsHref} className="min-w-0">
          <StatCard
            fill
            tone="amber"
            icon={CalendarDays}
            label="Upcoming events"
            value={formatCount(overview.upcomingEventsCount)}
            hint="From today forward"
          />
        </Link>
      </StatCardsRow>

      <StatCardsRow equal columns={3}>
        <Link href={financialHref} className="min-w-0">
          <StatCard
            fill
            tone="blue"
            icon={CircleDollarSign}
            label="Collected"
            value={formatUsd(overview.revenue)}
            hint="Open programs"
          />
        </Link>
        <Link href={financialHref} className="min-w-0">
          <StatCard
            fill
            tone="orange"
            icon={Wallet}
            label="Payroll"
            value={formatUsd(overview.expenses)}
            hint="Approved payroll"
          />
        </Link>
        <Link href={financialHref} className="min-w-0">
          <StatCard
            fill
            tone={overview.net >= 0 ? "emerald" : "rose"}
            icon={CircleDollarSign}
            label="Net"
            value={formatUsd(overview.net)}
            hint="Collected minus payroll"
          />
        </Link>
      </StatCardsRow>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Programs</h3>
            <p className="text-sm text-muted-foreground">
              Open a program to manage offerings, registrations, and schedule.
            </p>
          </div>
          <Link
            href={programsHref}
            className="text-sm font-medium text-sky-800 underline-offset-4 hover:underline"
          >
            View all programs
          </Link>
        </div>

        {programs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No programs</CardTitle>
              <CardDescription>
                Add a year or season in the Programs module.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="divide-y rounded-lg border">
            {programs.map((program) => (
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
    </div>
  )
}
