"use client"

import * as React from "react"
import Link from "next/link"
import { Download, Loader2, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  fetchProgramEnrollmentReportAction,
  type ProgramEnrollmentReportRow,
} from "@/lib/programs/program-enrollment-report"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"

function formatDate(value: string | null) {
  if (!value) return "—"
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatStatus(status: string | null) {
  if (!status) return "—"
  return status.replace(/_/g, " ")
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\n")
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * F6: Program-scoped enrollment report across offerings.
 */
export function ProgramEnrollmentsReportPanel({
  programId,
  programName,
  offerings,
}: {
  programId: string
  programName: string
  offerings: ProgramOffering[]
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ProgramEnrollmentReportRow[]>([])
  const [offeringFilter, setOfferingFilter] = React.useState<string>("all")
  const [includeInactive, setIncludeInactive] = React.useState(false)

  const activeOfferings = React.useMemo(
    () => offerings.filter((offering) => offering.status !== "archived"),
    [offerings]
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchProgramEnrollmentReportAction(programId, {
      offeringId: offeringFilter === "all" ? null : offeringFilter,
      includeInactive,
    })
    if (!result.success) {
      setError(result.error)
      setRows([])
      setLoading(false)
      return
    }
    setRows(result.rows)
    setLoading(false)
  }, [programId, offeringFilter, includeInactive])

  React.useEffect(() => {
    void load()
  }, [load])

  const uniqueStudents = new Set(
    rows
      .map((row) => row.studentContactId || row.studentName)
      .filter(Boolean)
  ).size
  const byOffering = new Set(rows.map((row) => row.offeringId).filter(Boolean))
    .size
  const pendingCount = rows.filter((row) => {
    const status = (row.status || "").toLowerCase()
    return status === "pending" || status === "pending_payment"
  }).length
  const activeCount = rows.filter((row) => {
    const status = (row.status || "").toLowerCase()
    return status === "enrolled" || status === "active"
  }).length

  function handleExport() {
    downloadCsv(
      `${programName.replace(/[^\w-]+/g, "-").toLowerCase()}-enrollments.csv`,
      [
        [
          "Student",
          "Offering",
          "Teacher",
          "Status",
          "Parent",
          "Parent email",
          "Parent phone",
          "Enrolled",
        ],
        ...rows.map((row) => [
          row.studentName,
          row.offeringName,
          row.teacherName || "",
          row.status || "",
          row.parentName || "",
          row.parentEmail || "",
          row.parentPhone || "",
          row.enrolledAt || "",
        ]),
      ]
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Enrollments</h2>
          <p className="text-sm text-muted-foreground">
            Students registered across offerings for this program.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={loading || rows.length === 0}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-offering">Offering</Label>
          <select
            id="report-offering"
            value={offeringFilter}
            onChange={(event) => setOfferingFilter(event.target.value)}
            className="h-9 min-w-[12rem] rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All offerings</option>
            {activeOfferings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="size-3.5"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Include cancelled / withdrawn
        </label>
      </div>

      <StatCardsRow equal columns={5}>
        <StatCard
          layout="header"
          fill
          tone="blue"
          label="Rows"
          value={rows.length}
          icon={Users}
        />
        <StatCard
          layout="header"
          fill
          tone="sky"
          label="Unique students"
          value={uniqueStudents}
        />
        <StatCard
          layout="header"
          fill
          tone="violet"
          label="Offerings"
          value={byOffering}
        />
        <StatCard
          layout="header"
          fill
          tone="emerald"
          label="Active / enrolled"
          value={activeCount}
        />
        <StatCard
          layout="header"
          fill
          tone="amber"
          label="Pending"
          value={pendingCount}
        />
      </StatCardsRow>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading enrollments…
        </div>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No enrollments match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Offering</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Parent / Guardian</TableHead>
                <TableHead>Enrolled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.enrollmentId}>
                  <TableCell className="font-medium">
                    <div>
                      {row.studentContactId ? (
                        <Link
                          href={contactProfileHref(row.studentContactId)}
                          className="text-sky-600 hover:underline"
                        >
                          {row.studentName}
                        </Link>
                      ) : (
                        row.studentName
                      )}
                    </div>
                    <Link
                      href={`/programs/registrations/${row.enrollmentId}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      View registration
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.offeringId ? (
                      <Link
                        href={programOfferingManageHref(
                          programId,
                          row.offeringId
                        )}
                        className="text-sky-600 hover:underline"
                      >
                        {row.offeringName}
                      </Link>
                    ) : (
                      row.offeringName
                    )}
                  </TableCell>
                  <TableCell>{row.teacherName || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-full">
                      {formatStatus(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{row.parentName || "—"}</div>
                    {row.parentEmail ? (
                      <div className="text-xs text-muted-foreground">
                        {row.parentEmail}
                      </div>
                    ) : null}
                    {row.parentPhone ? (
                      <div className="text-xs text-muted-foreground">
                        {row.parentPhone}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(row.enrolledAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
