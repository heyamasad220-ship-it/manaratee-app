"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getProgramEnrollmentSummaryAction } from "@/lib/programs/program-enrollment-summary-queries"
import type {
  EnrollmentByOfferingRow,
  EnrollmentSummaryTotals,
  EnrollmentTrendRow,
} from "@/lib/programs/program-enrollment-summary"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { cn } from "@/lib/utils"

function CountLink({
  href,
  value,
}: {
  href: string
  value: number
}) {
  return (
    <Link
      href={href}
      className="tabular-nums text-primary hover:underline"
    >
      {value}
    </Link>
  )
}

export function ProgramEnrollmentOverviewPanel({
  programId,
}: {
  programId: string
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [totals, setTotals] = React.useState<EnrollmentSummaryTotals | null>(null)
  const [rows, setRows] = React.useState<EnrollmentByOfferingRow[]>([])
  const [hasCapacity, setHasCapacity] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getProgramEnrollmentSummaryAction(programId)
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setTotals(null)
        setRows([])
        setHasCapacity(false)
      } else {
        setTotals(result.summary.totals)
        setRows(result.summary.byOffering)
        setHasCapacity(result.summary.hasCapacity)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [programId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading enrollment summary…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!totals) return null

  const enrolledHref = programWorkspaceHref(programId, {
    tab: "students",
    registrationStatus: "active",
  })
  const waitlistedHref = programWorkspaceHref(programId, {
    tab: "students",
    registrationStatus: "waitlisted",
  })
  const cancelledHref = programWorkspaceHref(programId, {
    tab: "students",
    registrationStatus: "cancelled",
  })

  return (
    <div className="space-y-6">
      <StatCardsRow equal columns={hasCapacity ? 5 : 4} className="gap-3">
        <StatCard
          layout="compact"
          fill
          tone="emerald"
          label="Total Enrolled"
          value={<CountLink href={enrolledHref} value={totals.enrolled} />}
          valueClassName="text-xl"
        />
        <StatCard
          layout="compact"
          fill
          tone="sky"
          label="Waitlisted"
          value={<CountLink href={waitlistedHref} value={totals.waitlisted} />}
          valueClassName="text-xl"
        />
        <StatCard
          layout="compact"
          fill
          tone="slate"
          label="Cancelled"
          value={<CountLink href={cancelledHref} value={totals.cancelled} />}
          valueClassName="text-xl"
        />
        {hasCapacity ? (
          <StatCard
            layout="compact"
            fill
            tone="violet"
            label="Available Seats"
            value={totals.availableSeats ?? "—"}
            valueClassName="text-xl"
          />
        ) : null}
        <StatCard
          layout="compact"
          fill
          tone="blue"
          label="Total Offerings"
          value={totals.offerings}
          valueClassName="text-xl"
        />
      </StatCardsRow>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Enrollment by Offering</h3>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offering</TableHead>
                <TableHead>Teacher</TableHead>
                {hasCapacity ? (
                  <TableHead className="text-right">Capacity</TableHead>
                ) : null}
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead className="text-right">Waitlisted</TableHead>
                <TableHead className="text-right">Cancelled</TableHead>
                {hasCapacity ? (
                  <TableHead className="text-right">Available</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={hasCapacity ? 7 : 5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No offerings yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.offeringId}>
                    <TableCell className="font-medium">{row.offeringName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.teacherName || "—"}
                    </TableCell>
                    {hasCapacity ? (
                      <TableCell className="text-right tabular-nums">
                        {row.capacity ?? "—"}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right">
                      <CountLink
                        href={programWorkspaceHref(programId, {
                          tab: "students",
                          registrationStatus: "active",
                          offeringId: row.offeringId,
                        })}
                        value={row.enrolled}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountLink
                        href={programWorkspaceHref(programId, {
                          tab: "students",
                          registrationStatus: "waitlisted",
                          offeringId: row.offeringId,
                        })}
                        value={row.waitlisted}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountLink
                        href={programWorkspaceHref(programId, {
                          tab: "students",
                          registrationStatus: "cancelled",
                          offeringId: row.offeringId,
                        })}
                        value={row.cancelled}
                      />
                    </TableCell>
                    {hasCapacity ? (
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.available == null && "text-muted-foreground"
                        )}
                      >
                        {row.available ?? "—"}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export function ProgramEnrollmentTrendsPanel({
  programId,
}: {
  programId: string
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [trends, setTrends] = React.useState<EnrollmentTrendRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getProgramEnrollmentSummaryAction(programId)
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setTrends([])
      } else {
        setTrends(result.summary.trends)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [programId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading registration trends…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Registrations by month</h3>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Registrations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trends.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Not enough registration dates to show a trend yet.
                </TableCell>
              </TableRow>
            ) : (
              trends.map((row) => (
                <TableRow key={row.monthKey}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.registered}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
