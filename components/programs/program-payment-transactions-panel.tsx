"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  fetchProgramPaymentTransactionsAction,
  type ProgramPaymentTransactionRow,
} from "@/lib/programs/program-payment-transactions"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function statusClass(status: ProgramPaymentTransactionRow["status"]) {
  switch (status) {
    case "Succeeded":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "Refunded":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "Voided":
      return "border-red-200 bg-red-50 text-red-800"
    default:
      return "border-red-200 bg-red-50 text-red-800"
  }
}

type DepartmentOption = { id: string; name: string }
type ProgramOption = { id: string; name: string; departmentId: string | null }

/** Reports → Payment transactions (pipeline step 1). */
export function ProgramPaymentTransactionsPanel() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ProgramPaymentTransactionRow[]>([])
  const [departments, setDepartments] = React.useState<DepartmentOption[]>([])
  const [departmentId, setDepartmentId] = React.useState("")
  const [programId, setProgramId] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const [result, departmentsResult] = await Promise.all([
        fetchProgramPaymentTransactionsAction({ limit: 500 }),
        supabase.from("departments").select("id, name").order("name"),
      ])
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setRows([])
      } else {
        setRows(result.rows)
      }
      if (!departmentsResult.error) {
        setDepartments(
          (departmentsResult.data || []).map((row) => ({
            id: row.id as string,
            name: (row.name as string) || "Department",
          }))
        )
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const programs = React.useMemo(() => {
    const byId = new Map<string, ProgramOption>()
    for (const row of rows) {
      if (byId.has(row.programId)) continue
      byId.set(row.programId, {
        id: row.programId,
        name: row.programName,
        departmentId: row.departmentId,
      })
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [rows])

  const programsForDepartment = React.useMemo(() => {
    if (!departmentId) return programs
    return programs.filter(
      (program) => program.departmentId === departmentId
    )
  }, [programs, departmentId])

  React.useEffect(() => {
    if (!programId) return
    if (programsForDepartment.some((program) => program.id === programId)) {
      return
    }
    setProgramId("")
  }, [programsForDepartment, programId])

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (departmentId && row.departmentId !== departmentId) return false
      if (programId && row.programId !== programId) return false
      return true
    })
  }, [rows, departmentId, programId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment transactions…
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Payment transactions
          </h2>
          <p className="text-sm text-muted-foreground">
            Paid and refunded program charge schedule rows (ledger view).
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="payment-department-filter">Department</Label>
            <select
              id="payment-department-filter"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="payment-program-filter">{YEAR_SEASON_LABEL}</Label>
            <select
              id="payment-program-filter"
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}</option>
              {programsForDepartment.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No {YEAR_SEASON_LABEL.toLowerCase()} payment transactions yet.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No payment transactions match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>{PROGRAM_LABEL}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.paidAt)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/programs/registrations/${row.enrollmentId}`}
                      className="font-medium text-sky-600 hover:underline"
                    >
                      {row.participantName}
                    </Link>
                    {row.label ? (
                      <div className="text-xs text-muted-foreground">
                        {row.label}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.offeringName || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("rounded-full", statusClass(row.status))}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
