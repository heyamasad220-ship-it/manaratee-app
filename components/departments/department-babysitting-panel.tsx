"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Baby, Loader2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  addBabysitterToDepartmentAction,
  fetchDepartmentBabysittingAction,
  upsertBabysitterPayAction,
  upsertBabysittingIncomeAction,
  type DepartmentBabysittingMatrix,
} from "@/lib/departments/department-babysitting"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function DepartmentBabysittingPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<DepartmentBabysittingMatrix | null>(null)
  const [newName, setNewName] = useState("")
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentBabysittingAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setMatrix(null)
    } else {
      setMatrix(result.matrix)
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  function saveIncome(periodKey: string, amount: number) {
    startTransition(async () => {
      const result = await upsertBabysittingIncomeAction({
        departmentId,
        periodKey,
        amount,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      await load()
    })
  }

  function savePay(input: {
    displayName: string
    contactId: string | null
    periodKey: string
    amount: number
  }) {
    startTransition(async () => {
      const result = await upsertBabysitterPayAction({
        departmentId,
        ...input,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      await load()
    })
  }

  function addBabysitter() {
    const name = newName.trim()
    if (!name) return
    startTransition(async () => {
      const result = await addBabysitterToDepartmentAction({
        departmentId,
        displayName: name,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setNewName("")
      await load()
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Baby className="size-4" />
            Babysitting
          </CardTitle>
          <CardDescription>
            Separate from tuition for {departmentName}: income collected for care, and what you
            pay babysitters each month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading babysitting...
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !matrix ? null : (
            <>
              {matrix.migrationRequired ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Run <code className="text-xs">scripts/170_department_operating_finance.sql</code>{" "}
                  in Supabase to enable babysitting ledgers.
                </p>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-medium">Babysitting income</h3>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Category</TableHead>
                        {matrix.months.map((month) => (
                          <TableHead key={month.periodKey} className="min-w-[88px] text-right">
                            {month.label}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Income</TableCell>
                        {matrix.months.map((month) => {
                          const cell = matrix.incomeByMonth[month.periodKey]
                          return (
                            <AmountCell
                              key={month.periodKey}
                              value={cell?.amount ?? 0}
                              disabled={isPending}
                              onSave={(amount) => saveIncome(month.periodKey, amount)}
                            />
                          )
                        })}
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(
                            matrix.months.reduce(
                              (sum, month) =>
                                sum + Number(matrix.incomeByMonth[month.periodKey]?.amount || 0),
                              0
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                  <h3 className="text-sm font-medium">Babysitter payments</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Babysitter name"
                      className="h-9 w-48"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={addBabysitter}
                      disabled={isPending || !newName.trim()}
                    >
                      <Plus className="mr-1.5 size-4" />
                      Add
                    </Button>
                  </div>
                </div>
                {matrix.babysitters.length === 0 ? (
                  <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
                    No babysitters yet. Add a name to start entering monthly payments.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Babysitter</TableHead>
                          {matrix.months.map((month) => (
                            <TableHead key={month.periodKey} className="min-w-[88px] text-right">
                              {month.label}
                            </TableHead>
                          ))}
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matrix.babysitters.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="font-medium">{row.displayName}</TableCell>
                            {matrix.months.map((month) => {
                              const cell = row.months[month.periodKey]
                              return (
                                <AmountCell
                                  key={month.periodKey}
                                  value={cell?.amount ?? 0}
                                  disabled={isPending}
                                  onSave={(amount) =>
                                    savePay({
                                      displayName: row.displayName,
                                      contactId: row.contactId,
                                      periodKey: month.periodKey,
                                      amount,
                                    })
                                  }
                                />
                              )
                            })}
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatCurrency(
                                matrix.months.reduce(
                                  (sum, month) =>
                                    sum + Number(row.months[month.periodKey]?.amount || 0),
                                  0
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-medium">
                          <TableCell>Totals</TableCell>
                          {matrix.months.map((month) => {
                            const total = matrix.babysitters.reduce(
                              (sum, row) =>
                                sum + Number(row.months[month.periodKey]?.amount || 0),
                              0
                            )
                            return (
                              <TableCell
                                key={month.periodKey}
                                className="text-right tabular-nums text-red-700"
                              >
                                {formatCurrency(total)}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-right tabular-nums text-red-700">
                            {formatCurrency(
                              matrix.babysitters.reduce(
                                (sum, row) =>
                                  sum +
                                  matrix.months.reduce(
                                    (inner, month) =>
                                      inner + Number(row.months[month.periodKey]?.amount || 0),
                                    0
                                  ),
                                0
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AmountCell({
  value,
  disabled,
  onSave,
}: {
  value: number
  disabled: boolean
  onSave: (amount: number) => void
}) {
  const [text, setText] = useState(value ? String(value) : "")

  useEffect(() => {
    setText(value ? String(value) : "")
  }, [value])

  return (
    <TableCell className="p-1">
      <Input
        type="number"
        min="0"
        step="0.01"
        className="h-8 text-right tabular-nums"
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const parsed = text.trim() ? Number(text.trim()) : 0
          if (!Number.isNaN(parsed) && parsed >= 0) onSave(parsed)
        }}
      />
    </TableCell>
  )
}
