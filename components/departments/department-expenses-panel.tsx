"use client"

import { useCallback, useEffect, useState } from "react"
import { DollarSign, Loader2, Receipt, Store } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"

type DepartmentExpenseRow = {
  id: string
  vendor: string | null
  category: string | null
  amount: number | null
  expense_date: string | null
  department_id: string | null
  program_id?: string | null
  program?: {
    id: string
    name: string | null
    department_id: string | null
    status: string | null
    start_date: string | null
    end_date: string | null
  } | null
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function dateWithinOpenPrograms(
  date: string | null,
  programs: Array<{ start_date: string | null; end_date: string | null }>
) {
  if (programs.length === 0) return false
  const dated = programs.filter((program) => program.start_date || program.end_date)
  if (dated.length === 0) return true
  if (!date) return true
  return dated.some((program) => {
    if (program.start_date && date < program.start_date) return false
    if (program.end_date && date > program.end_date) return false
    return true
  })
}

/** Temporary department expenses view moved from Programs → Reports (to clean up later). */
export function DepartmentExpensesPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<DepartmentExpenseRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [{ data: openPrograms, error: programsError }, { data, error: queryError }] =
      await Promise.all([
        supabase
          .from("programs")
          .select("id, start_date, end_date")
          .eq("department_id", departmentId)
          .in("status", ["draft", "active", "paused", "closed"]),
        supabase
          .from("program_expenses")
          .select(`
            id,
            vendor,
            category,
            amount,
            expense_date,
            department_id,
            program_id,
            program:program_id (
              id,
              name,
              department_id,
              status,
              start_date,
              end_date
            )
          `)
          .order("expense_date", { ascending: false }),
      ])

    if (programsError) {
      setError(programsError.message)
      setItems([])
      setLoading(false)
      return
    }

    if (queryError) {
      console.warn("program_expenses could not be loaded:", queryError.message)
      setError(queryError.message)
      setItems([])
      setLoading(false)
      return
    }

    const openProgramList = openPrograms || []
    const openProgramIds = new Set(openProgramList.map((row) => row.id as string))

    // Open years only — archived-year expenses are excluded from operating Financial.
    const rows = ((data || []) as DepartmentExpenseRow[]).filter((row) => {
      const programId = row.program_id || row.program?.id || null
      if (programId) {
        return openProgramIds.has(programId)
      }
      if (row.department_id !== departmentId) return false
      return dateWithinOpenPrograms(row.expense_date, openProgramList)
    })
    setItems(rows)
    setLoading(false)
  }, [departmentId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const totalSpent = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const vendorCount = new Set(items.map((item) => item.vendor).filter(Boolean)).size

  return (
    <div className="space-y-6">
      {!loading && !error ? (
        <StatCardsRow equal columns={3}>
          <StatCard
            layout="header"
            fill
            tone="amber"
            label="Expenses"
            value={items.length}
            icon={Receipt}
            hint="Department expense rows"
          />
          <StatCard
            layout="header"
            fill
            tone="rose"
            label="Total spent"
            value={formatCurrency(totalSpent)}
            icon={DollarSign}
            hint="Sum of amounts"
          />
          <StatCard
            layout="header"
            fill
            tone="violet"
            label="Vendors"
            value={vendorCount}
            icon={Store}
            hint="Distinct vendors"
          />
        </StatCardsRow>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" />
            Expenses
          </CardTitle>
          <CardDescription>
            Program expenses attributed to {departmentName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading expenses...
            </p>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses found for this department yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.vendor || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.program?.name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.category || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.expense_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
