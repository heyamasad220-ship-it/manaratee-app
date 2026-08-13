"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { GraduationCap, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchDepartmentStudentPaymentsAction,
  type DepartmentStudentPaymentsMatrix,
} from "@/lib/departments/department-student-payments"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatMonthAmount(value: number | null) {
  if (value == null) return "—"
  if (value === 0) return "$0"
  return formatCurrency(value)
}

export function DepartmentStudentPaymentsPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<DepartmentStudentPaymentsMatrix | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentStudentPaymentsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setMatrix(null)
      setLoading(false)
      return
    }
    setMatrix(result.matrix)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const monthTotals =
    matrix?.months.map((month) => {
      const total = (matrix.rows || []).reduce((sum, row) => {
        const cell = row.months[month.periodKey]
        return sum + Number(cell?.amount || 0)
      }, 0)
      return { periodKey: month.periodKey, total }
    }) ?? []

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-4" />
          Program Fee Transactions
        </CardTitle>
        <CardDescription>
          One row per enrollment for programs in {departmentName}: course fee, tuition months,
          childcare add-on fees, and amounts received. Month columns follow each course
          offering&apos;s billing calendar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading tuition transactions...
          </p>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No program enrollments for this department yet. Register participants under Programs linked
            to this department to see them here.
          </p>
        ) : (
          <>
            {matrix.migrationRequired ? (
              <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Billing calendar migrations are not applied yet, so monthly columns may be empty.
                Course fee, discount, received, and remaining still come from enrollment charges.
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] sticky left-0 z-10 bg-background">
                      Participant
                    </TableHead>
                    <TableHead className="min-w-[120px]">Teacher</TableHead>
                    <TableHead className="min-w-[140px]">Course</TableHead>
                    <TableHead className="text-right">Course fee</TableHead>
                    <TableHead className="text-right">Childcare fee</TableHead>
                    {matrix.months.map((month) => (
                      <TableHead key={month.periodKey} className="min-w-[72px] text-right">
                        {month.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Paid in full</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.rows.map((row) => (
                    <TableRow key={row.enrollmentId}>
                      <TableCell className="sticky left-0 z-10 bg-background font-medium">
                        {row.studentName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.teacherName || "—"}
                      </TableCell>
                      <TableCell>
                        {row.offeringId ? (
                          <Link
                            href={programOfferingManageHref(
                              row.programId,
                              row.offeringId,
                              { departmentId }
                            )}
                            className="text-primary hover:underline"
                          >
                            {row.courseName}
                          </Link>
                        ) : (
                          <Link
                            href={`/programs/${row.programId}`}
                            className="text-primary hover:underline"
                          >
                            {row.courseName}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.courseFee)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.childcareFee > 0 ? formatCurrency(row.childcareFee) : "—"}
                      </TableCell>
                      {matrix.months.map((month) => {
                        const cell = row.months[month.periodKey]
                        return (
                          <TableCell
                            key={month.periodKey}
                            className={cn(
                              "text-right tabular-nums",
                              cell?.status === "paid" && "text-emerald-700",
                              cell?.status === "past_due" && "text-red-600"
                            )}
                          >
                            {formatMonthAmount(cell?.amount ?? null)}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.discount > 0 ? formatCurrency(row.discount) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.received)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.remaining > 0 && "text-amber-700"
                        )}
                      >
                        {formatCurrency(row.remaining)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-normal",
                            row.paidInFull
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {row.paidInFull ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {matrix.months.length > 0 || matrix.rows.length > 0 ? (
                    <TableRow className="bg-muted/40 font-medium">
                      <TableCell className="sticky left-0 z-10 bg-muted/40">Totals</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          matrix.rows.reduce((sum, row) => sum + row.courseFee, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          matrix.rows.reduce((sum, row) => sum + row.childcareFee, 0)
                        )}
                      </TableCell>
                      {monthTotals.map((month) => (
                        <TableCell
                          key={month.periodKey}
                          className="text-right tabular-nums text-red-700"
                        >
                          {formatCurrency(month.total)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          matrix.rows.reduce((sum, row) => sum + row.discount, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          matrix.rows.reduce((sum, row) => sum + row.received, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          matrix.rows.reduce((sum, row) => sum + row.remaining, 0)
                        )}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
