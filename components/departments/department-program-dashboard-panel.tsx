"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Loader2,
  RotateCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { STAT_CARD_TONES, type StatCardTone } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OFFERING_REGISTRATION_STATE_LABELS } from "@/lib/programs/program-offering-display"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  fetchProgramOverviewMetricsAction,
  type ProgramOverviewActivityItem,
  type ProgramOverviewAttentionHref,
  type ProgramOverviewMetrics,
} from "@/lib/programs/program-overview-metrics"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { cn } from "@/lib/utils"

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

function formatSignedUsd(value: number) {
  if (value > 0.009) return `-${formatUsd(value)}`
  return formatUsd(0)
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function activityDayLabel(iso: string) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return "Earlier"
  const today = startOfLocalDay(new Date())
  const day = startOfLocalDay(at)
  const diffDays = Math.round((today - day) / 86_400_000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return at.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function groupActivity(items: ProgramOverviewActivityItem[]) {
  const groups: Array<{ label: string; items: ProgramOverviewActivityItem[] }> = []
  for (const item of items) {
    const label = activityDayLabel(item.at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }
  return groups
}

function HealthMetric({
  value,
  label,
  hint,
  tone,
}: {
  value: string
  label: string
  hint: string
  tone: StatCardTone
}) {
  const colors = STAT_CARD_TONES[tone]
  return (
    <div className={cn("min-w-0 rounded-lg border px-3 py-2.5", colors.card)}>
      <p className={cn("text-xl font-semibold tabular-nums tracking-tight", colors.value)}>
        {value}
      </p>
      <p className={cn("text-sm", colors.label)}>{label}</p>
      <p className={cn("mt-0.5 text-xs", colors.hint)}>{hint}</p>
    </div>
  )
}

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  )
}

function attentionIcon(id: string) {
  if (id === "balances") return CircleDollarSign
  if (id === "near-capacity" || id === "at-capacity") return AlertCircle
  return AlertTriangle
}

/** Year/program workspace Overview (`?tab=overview`). */
export function DepartmentProgramDashboardPanel({
  departmentId,
  yearProgramId,
}: {
  departmentId: string
  yearProgramId: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<ProgramOverviewMetrics | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchProgramOverviewMetricsAction(
      departmentId,
      yearProgramId
    )
    if (!result.success) {
      setError(result.error)
      setMetrics(null)
      setLoading(false)
      return
    }
    setMetrics(result.data)
    setLoading(false)
  }, [departmentId, yearProgramId])

  useEffect(() => {
    void load()
  }, [load])

  function href(section?: ProgramOverviewAttentionHref) {
    if (section === "offerings") {
      return programWorkspaceHref(yearProgramId, { tab: "offerings" })
    }
    if (section === "finance") {
      return programWorkspaceHref(yearProgramId, { tab: "finance" })
    }
    return programWorkspaceHref(yearProgramId, {
      tab: "students",
      studentsSection:
        section === "applications" ? "applications" : "enrollments",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading overview…
      </div>
    )
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>{error || "Could not load this overview."}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const attentionHref =
    metrics.attention.find((item) => item.hrefSection)?.hrefSection || "enrollments"
  const activityGroups = groupActivity(metrics.activity)
  const discountTotal = metrics.discounts + metrics.fullPayDiscounts
  const offeringHint =
    metrics.offeringsTotal === 0
      ? "No offerings yet"
      : `${formatCount(metrics.offeringsPaid)} paid · ${formatCount(metrics.offeringsFree)} free`

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Program health
          </h2>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <HealthMetric
            tone="emerald"
            value={formatCount(metrics.enrollmentsActive)}
            label="Enrollments"
            hint={`${formatCount(metrics.uniqueStudentsActive)} participant${metrics.uniqueStudentsActive === 1 ? "" : "s"}`}
          />
          <HealthMetric
            tone="violet"
            value={formatCount(metrics.offeringsTotal)}
            label="Offerings"
            hint={offeringHint}
          />
          <HealthMetric
            tone="amber"
            value={formatCount(metrics.applicationsNeedsReview)}
            label="Need review"
            hint="Applications"
          />
          <HealthMetric
            tone="rose"
            value={formatUsd(metrics.outstanding)}
            label="Outstanding"
            hint={`${formatCount(metrics.outstandingEnrollmentCount)} enrollment${metrics.outstandingEnrollmentCount === 1 ? "" : "s"}`}
          />
          <HealthMetric
            tone="sky"
            value={formatUsd(metrics.collectedNet)}
            label="Collected"
            hint="Net received"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Needs attention
          </h2>
          <SectionLink href={href(attentionHref)}>View all</SectionLink>
        </div>
        {metrics.attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs attention.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {metrics.attention.map((item) => {
              const Icon = attentionIcon(item.id)
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        item.tone === "rose"
                          ? "text-rose-600"
                          : item.tone === "slate"
                            ? "text-muted-foreground"
                            : "text-amber-600"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.detail ? (
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                  </div>
                  {item.hrefSection ? (
                    <Link
                      href={href(item.hrefSection)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      View
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Offerings
          </h2>
          <SectionLink href={href("offerings")}>View all offerings</SectionLink>
        </div>
        {metrics.offeringRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No offerings yet. Add one from the Offerings tab.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offering</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Registration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.offeringRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={programOfferingManageHref(yearProgramId, row.id)}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.instructorName || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.capacity
                        ? `${formatCount(row.enrolled)} / ${formatCount(row.capacity)}`
                        : formatCount(row.enrolled)}
                    </TableCell>
                    <TableCell>
                      {OFFERING_REGISTRATION_STATE_LABELS[row.registrationState]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Financial summary
          </h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Program charges</dt>
              <dd className="tabular-nums">{formatUsd(metrics.programCharges)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Discounts</dt>
              <dd className="tabular-nums">{formatSignedUsd(discountTotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Financial assistance</dt>
              <dd className="tabular-nums">
                {formatSignedUsd(metrics.financialAssistance)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Adjusted tuition</dt>
              <dd className="tabular-nums font-medium">
                {formatUsd(metrics.adjustedTuition)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Received</dt>
              <dd className="tabular-nums">{formatUsd(metrics.collectedGross)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Refunded</dt>
              <dd className="tabular-nums">{formatSignedUsd(metrics.refunded)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Net collected</dt>
              <dd className="tabular-nums font-medium">
                {formatUsd(metrics.collectedNet)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Outstanding</dt>
              <dd className="tabular-nums font-medium">
                {formatUsd(metrics.outstanding)}
              </dd>
            </div>
          </dl>
          <SectionLink href={href("finance")}>View Finance</SectionLink>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent activity
          </h2>
          {activityGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          ) : (
            <div className="space-y-4">
              {activityGroups.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex gap-2 text-sm">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/60" />
                        <span>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <SectionLink href={href("enrollments")}>View all activity</SectionLink>
        </section>
      </div>
    </div>
  )
}
