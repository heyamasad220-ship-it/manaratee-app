"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  BookMarked,
  BookOpen,
  Flower2,
  GraduationCap,
  Heart,
  Languages,
  Layers,
  Leaf,
  Loader2,
  Snowflake,
  Sparkles,
  Waves,
} from "lucide-react"

import { DepartmentEnrollmentTrendChart } from "@/components/departments/department-enrollment-trend-chart"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  fetchDepartmentYearProgramsAction,
  type DepartmentYearProgramsBundle,
} from "@/lib/departments/department-year-actions"
import { programCountPhrase } from "@/lib/programs/program-display-labels"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import {
  buildProgramSeriesSummaries,
  buildYearRows,
  filterYearComparisonFacts,
  programSeriesKey,
  type YearComparisonFact,
} from "@/lib/programs/year-comparison"
import { getYearComparisonFacts } from "@/lib/programs/year-comparison-queries"
import { cn } from "@/lib/utils"

function enrollmentPhrase(count: number) {
  return `${count} ${count === 1 ? "enrollment" : "enrollments"}`
}

const FALLBACK_TONES = [
  {
    card: "border-sky-200 bg-sky-50 hover:bg-sky-100/80",
    title: "text-sky-800",
    icon: "text-sky-600",
    number: "text-sky-950",
    label: "text-sky-700",
    ring: "ring-sky-600",
  },
  {
    card: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80",
    title: "text-emerald-800",
    icon: "text-emerald-600",
    number: "text-emerald-950",
    label: "text-emerald-700",
    ring: "ring-emerald-600",
  },
  {
    card: "border-violet-200 bg-violet-50 hover:bg-violet-100/80",
    title: "text-violet-800",
    icon: "text-violet-600",
    number: "text-violet-950",
    label: "text-violet-700",
    ring: "ring-violet-600",
  },
  {
    card: "border-amber-200 bg-amber-50 hover:bg-amber-100/80",
    title: "text-amber-800",
    icon: "text-amber-600",
    number: "text-amber-950",
    label: "text-amber-700",
    ring: "ring-amber-600",
  },
] as const

const SERIES_CARD_STYLES: Record<
  string,
  {
    Icon: LucideIcon
    card: string
    title: string
    icon: string
    number: string
    label: string
    ring: string
  }
> = {
  "summer camp": {
    Icon: Waves,
    card: "border-sky-200 bg-sky-50 hover:bg-sky-100/80",
    title: "text-sky-800",
    icon: "text-sky-600",
    number: "text-sky-950",
    label: "text-sky-700",
    ring: "ring-sky-600",
  },
  "fall camp": {
    Icon: Leaf,
    card: "border-orange-200 bg-orange-50 hover:bg-orange-100/80",
    title: "text-orange-800",
    icon: "text-orange-600",
    number: "text-orange-950",
    label: "text-orange-700",
    ring: "ring-orange-600",
  },
  "winter camp": {
    Icon: Snowflake,
    card: "border-indigo-200 bg-indigo-50 hover:bg-indigo-100/80",
    title: "text-indigo-800",
    icon: "text-indigo-500",
    number: "text-indigo-950",
    label: "text-indigo-700",
    ring: "ring-indigo-600",
  },
  "spring camp": {
    Icon: Flower2,
    card: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80",
    title: "text-emerald-800",
    icon: "text-emerald-600",
    number: "text-emerald-950",
    label: "text-emerald-700",
    ring: "ring-emerald-600",
  },
  "youth intensive": {
    Icon: Sparkles,
    card: "border-violet-200 bg-violet-50 hover:bg-violet-100/80",
    title: "text-violet-800",
    icon: "text-violet-600",
    number: "text-violet-950",
    label: "text-violet-700",
    ring: "ring-violet-600",
  },
  "sunday school": {
    Icon: BookOpen,
    card: "border-teal-200 bg-teal-50 hover:bg-teal-100/80",
    title: "text-teal-800",
    icon: "text-teal-600",
    number: "text-teal-950",
    label: "text-teal-700",
    ring: "ring-teal-600",
  },
  "quran for little hearts": {
    Icon: Heart,
    card: "border-rose-200 bg-rose-50 hover:bg-rose-100/80",
    title: "text-rose-800",
    icon: "text-rose-500",
    number: "text-rose-950",
    label: "text-rose-700",
    ring: "ring-rose-600",
  },
  "saturday quranic arabic": {
    Icon: Languages,
    card: "border-cyan-200 bg-cyan-50 hover:bg-cyan-100/80",
    title: "text-cyan-800",
    icon: "text-cyan-600",
    number: "text-cyan-950",
    label: "text-cyan-700",
    ring: "ring-cyan-600",
  },
  "kids saturday quranic arabic": {
    Icon: Languages,
    card: "border-lime-200 bg-lime-50 hover:bg-lime-100/80",
    title: "text-lime-800",
    icon: "text-lime-600",
    number: "text-lime-950",
    label: "text-lime-700",
    ring: "ring-lime-600",
  },
  "quran institute junior": {
    Icon: GraduationCap,
    card: "border-blue-200 bg-blue-50 hover:bg-blue-100/80",
    title: "text-blue-800",
    icon: "text-blue-600",
    number: "text-blue-950",
    label: "text-blue-700",
    ring: "ring-blue-600",
  },
  "the companion of the quran": {
    Icon: BookMarked,
    card: "border-violet-200 bg-violet-50 hover:bg-violet-100/80",
    title: "text-violet-800",
    icon: "text-violet-600",
    number: "text-violet-950",
    label: "text-violet-700",
    ring: "ring-violet-600",
  },
  "companion of the quran": {
    Icon: BookMarked,
    card: "border-violet-200 bg-violet-50 hover:bg-violet-100/80",
    title: "text-violet-800",
    icon: "text-violet-600",
    number: "text-violet-950",
    label: "text-violet-700",
    ring: "ring-violet-600",
  },
  "quran institute for ladies": {
    Icon: BookOpen,
    card: "border-fuchsia-200 bg-fuchsia-50 hover:bg-fuchsia-100/80",
    title: "text-fuchsia-800",
    icon: "text-fuchsia-600",
    number: "text-fuchsia-950",
    label: "text-fuchsia-700",
    ring: "ring-fuchsia-600",
  },
}

function seriesCardStyle(seriesRaw: string, index: number) {
  const key = seriesRaw.trim().toLowerCase()
  const named = SERIES_CARD_STYLES[key]
  if (named) return named
  const fallback = FALLBACK_TONES[index % FALLBACK_TONES.length]!
  return { Icon: Layers, ...fallback }
}

/** Department Programs tab — summary doorway into the Programs module. */
export function DepartmentProgramsDoorwayPanel({
  departmentId,
}: {
  departmentId: string
  departmentName?: string
}) {
  const [bundle, setBundle] = useState<DepartmentYearProgramsBundle | null>(null)
  const [facts, setFacts] = useState<YearComparisonFact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [programsResult, factsResult] = await Promise.all([
      fetchDepartmentYearProgramsAction(departmentId),
      getYearComparisonFacts({ departmentId }),
    ])
    if (!programsResult.success) {
      setError(programsResult.error)
      setBundle(null)
      setFacts([])
    } else {
      setBundle(programsResult.data)
      setFacts(factsResult.success ? factsResult.facts : [])
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    setSelectedSeriesKey(null)
    void load()
  }, [departmentId, load])

  const seriesCards = useMemo(
    () =>
      bundle
        ? buildProgramSeriesSummaries(bundle.openPrograms, departmentId, {
            minPrograms: 2,
          })
        : [],
    [bundle, departmentId]
  )

  const selectedSeries =
    seriesCards.find((series) => series.seriesKey === selectedSeriesKey) ?? null

  const programs = useMemo(() => {
    const rows = bundle?.openPrograms ?? []
    if (!selectedSeriesKey) return rows
    return rows.filter(
      (program) =>
        programSeriesKey(departmentId, program.name, program.startDate) ===
        selectedSeriesKey
    )
  }, [bundle, departmentId, selectedSeriesKey])

  const chartRows = useMemo(() => {
    if (!selectedSeriesKey) return []
    return buildYearRows(
      filterYearComparisonFacts(facts, {
        departmentId,
        seriesKey: selectedSeriesKey,
        programKind: "all",
      })
    )
  }, [departmentId, facts, selectedSeriesKey])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading programs…
      </div>
    )
  }

  if (error || !bundle) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Programs</CardTitle>
          <CardDescription>{error || "Could not load programs."}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Programs</h2>
        <p className="text-sm text-muted-foreground">
          Programs for this department. Open a card to see enrollment over the
          years, then open a year to manage it in Programs.
        </p>
      </div>

      {seriesCards.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {seriesCards.map((series, index) => {
            const selected = series.seriesKey === selectedSeriesKey
            const style = seriesCardStyle(series.seriesRaw, index)
            const Icon = style.Icon
            return (
              <button
                key={series.seriesKey}
                type="button"
                title={series.shortLabel}
                aria-pressed={selected}
                onClick={() =>
                  setSelectedSeriesKey((current) =>
                    current === series.seriesKey ? null : series.seriesKey
                  )
                }
                className={cn(
                  "min-w-[12rem] flex-1 rounded-xl border px-4 py-3 text-left shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2",
                  style.card,
                  style.ring,
                  selected && "ring-2"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5 shrink-0", style.icon)} />
                  <p
                    className={cn(
                      "truncate text-sm font-semibold leading-tight",
                      style.title
                    )}
                  >
                    {series.shortLabel}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                  <div>
                    <p className={cn("text-2xl font-bold tabular-nums", style.number)}>
                      {series.activeCount}
                    </p>
                    <p className={cn("text-xs", style.label)}>active</p>
                  </div>
                  <div>
                    <p className={cn("text-2xl font-bold tabular-nums", style.number)}>
                      {series.closedCount}
                    </p>
                    <p className={cn("text-xs", style.label)}>closed</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold tracking-tight">
                {selectedSeries ? `${selectedSeries.shortLabel} years` : "All years"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedSeries
                  ? "Years in this program. Click a card again to show every program."
                  : "Open a year to manage it in Programs."}
              </p>
            </div>
            {selectedSeries ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-0 text-sm font-medium text-sky-800 hover:bg-transparent hover:underline"
                onClick={() => setSelectedSeriesKey(null)}
              >
                Show all programs
              </Button>
            ) : null}
          </div>

          {programs.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedSeries ? `No ${selectedSeries.shortLabel} years` : "No programs"}
                </CardTitle>
                <CardDescription>
                  {selectedSeries
                    ? "This program has no active or closed years in the list."
                    : "Add a year or season in the Programs module."}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
              {programs.map((program) => (
                <Link
                  key={program.id}
                  href={programWorkspaceHref(program.id)}
                  className="block px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="font-medium text-sky-800">{program.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {getProgramStatusLabel((program.status as ProgramStatus) || "active")}{" "}
                    — {programCountPhrase(program.offeringCount)} —{" "}
                    {enrollmentPhrase(program.enrolled)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
          {selectedSeries && chartRows.length > 0 ? (
            <DepartmentEnrollmentTrendChart
              className="h-full"
              yearRows={chartRows}
              title={`${selectedSeries.shortLabel} enrollment`}
              description="Enrolled participants by year for this program"
            />
          ) : (
            <Card className="h-full min-h-[280px]">
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedSeries
                    ? `${selectedSeries.shortLabel} enrollment`
                    : "Enrollment over the years"}
                </CardTitle>
                <CardDescription>
                  {selectedSeries
                    ? "No enrollments recorded for this program yet."
                    : "Select a program card to see enrollment over the years."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
