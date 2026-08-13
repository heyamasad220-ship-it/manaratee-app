"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, DollarSign, PieChart, Users, Wallet } from "lucide-react"

import { DepartmentBudgetPanel } from "@/components/departments/department-budget-panel"
import { DepartmentExpensesPanel } from "@/components/departments/department-expenses-panel"
import { DepartmentPayrollPanel } from "@/components/departments/department-payroll-panel"
import { FinancePayrollQueuePanel } from "@/components/finance/finance-payroll-queue-panel"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DepartmentStaffMember } from "@/lib/departments/department-actions"
import { fetchDepartmentProgramsAction } from "@/lib/departments/department-programs"
import {
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"

type ReportSection = "employees" | "payroll" | "expenses" | "budget"

type YearOption = {
  id: string
  name: string
  status: string
}

export function DepartmentReportsPanel({
  departmentId,
  departmentName,
  staff,
  onStaffChanged,
  initialYearProgramId = null,
}: {
  departmentId: string
  departmentName: string
  staff: DepartmentStaffMember[]
  onStaffChanged: () => Promise<void> | void
  initialYearProgramId?: string | null
}) {
  const [years, setYears] = useState<YearOption[]>([])
  const [yearId, setYearId] = useState<string>(initialYearProgramId || "")
  const [section, setSection] = useState<ReportSection>("employees")
  const [loadingYears, setLoadingYears] = useState(true)

  const loadYears = useCallback(async () => {
    setLoadingYears(true)
    const result = await fetchDepartmentProgramsAction(departmentId)
    if (!result.success) {
      setYears([])
      setLoadingYears(false)
      return
    }
    const next = result.years.map((year) => ({
      id: year.id,
      name: year.name,
      status: year.status,
    }))
    setYears(next)
    setYearId((current) => {
      if (current && next.some((year) => year.id === current)) return current
      if (
        initialYearProgramId &&
        next.some((year) => year.id === initialYearProgramId)
      ) {
        return initialYearProgramId
      }
      const closed = next.find((year) => year.status === "closed")
      return closed?.id || next[0]?.id || ""
    })
    setLoadingYears(false)
  }, [departmentId, initialYearProgramId])

  useEffect(() => {
    void loadYears()
  }, [loadYears])

  const selectedYear = useMemo(
    () => years.find((year) => year.id === yearId) || null,
    [years, yearId]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="dept-reports-year">{YEAR_SEASON_LABEL}</Label>
          <select
            id="dept-reports-year"
            value={yearId}
            onChange={(event) => setYearId(event.target.value)}
            className="h-9 min-w-[16rem] rounded-md border bg-background px-3 text-sm"
            disabled={loadingYears || years.length === 0}
          >
            {years.length === 0 ? (
              <option value="">No {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}</option>
            ) : (
              years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                  {year.status === "closed" ? " (closed)" : ""}
                </option>
              ))
            )}
          </select>
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          Historical payroll, expenses, and financial summary by{" "}
          {YEAR_SEASON_LABEL.toLowerCase()}. Operating work stays under Financial
          (open years only).
        </p>
      </div>

      <Tabs
        value={section}
        onValueChange={(value) => setSection(value as ReportSection)}
      >
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="employees" className="gap-2">
            <Users className="size-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <Wallet className="size-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <DollarSign className="size-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-2">
            <PieChart className="size-4" />
            Financial Summary
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {!yearId ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          <BarChart3 className="mx-auto mb-2 size-5 opacity-60" />
          Add a {YEAR_SEASON_LABEL.toLowerCase()} on Overview to view reports.
        </p>
      ) : (
        <>
          {section === "employees" ? (
            <DepartmentPayrollPanel
              departmentId={departmentId}
              departmentName={
                selectedYear
                  ? `${departmentName} · ${selectedYear.name}`
                  : departmentName
              }
              staff={staff}
              onStaffChanged={onStaffChanged}
              openYearsOnly={false}
              programId={yearId}
              readOnly
              variant="roster"
            />
          ) : null}
          {section === "payroll" ? (
            <div className="space-y-6">
              <DepartmentPayrollPanel
                departmentId={departmentId}
                departmentName={
                  selectedYear
                    ? `${departmentName} · ${selectedYear.name}`
                    : departmentName
                }
                staff={staff}
                onStaffChanged={onStaffChanged}
                openYearsOnly={false}
                programId={yearId}
                readOnly
                variant="periods"
              />
              <FinancePayrollQueuePanel
                departmentId={departmentId}
                departmentName={
                  selectedYear
                    ? `${departmentName} · ${selectedYear.name}`
                    : departmentName
                }
              />
            </div>
          ) : null}
          {section === "expenses" ? (
            <DepartmentExpensesPanel
              departmentId={departmentId}
              departmentName={
                selectedYear
                  ? `${departmentName} · ${selectedYear.name}`
                  : departmentName
              }
              openYearsOnly={false}
              programId={yearId}
              readOnly
            />
          ) : null}
          {section === "budget" ? (
            <DepartmentBudgetPanel
              departmentId={departmentId}
              departmentName={
                selectedYear
                  ? `${departmentName} · ${selectedYear.name}`
                  : departmentName
              }
              programId={yearId}
              readOnly
            />
          ) : null}
        </>
      )}
    </div>
  )
}
