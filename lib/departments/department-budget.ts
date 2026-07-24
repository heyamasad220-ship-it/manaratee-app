"use server"

import {
  canManageDepartment,
  canViewDepartment,
} from "@/lib/departments/department-access"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { fetchDepartmentPayrollList } from "@/lib/departments/department-payroll"
import { fetchDepartmentStudentPaymentsMatrix } from "@/lib/departments/department-student-payments"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type DepartmentBudgetPeriodTotals = {
  id: string
  periodStart: string
  periodEnd: string
  label: string
  studentTuition: number
  teacherSalaries: number
  profit: number
}

export type DepartmentBudgetMonthTotals = {
  periodKey: string
  label: string
  studentTuition: number
  teacherSalaries: number
  profit: number
}

export type DepartmentBudgetSummary = {
  periods: DepartmentBudgetPeriodTotals[]
  /** @deprecated use periods — kept for older callers */
  byMonth: DepartmentBudgetPeriodTotals[]
  /** Calendar-month breakdown (student payments − approved payroll). */
  monthly: DepartmentBudgetMonthTotals[]
  totals: {
    studentTuition: number
    teacherSalaries: number
    profit: number
  }
  canManage: boolean
  migrationRequired: boolean
}

const emptyTotals = {
  studentTuition: 0,
  teacherSalaries: 0,
  profit: 0,
}

function isMissingTableError(message: string | undefined) {
  if (!message) return false
  return (
    /relation ["'].*["'] does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /\b42P01\b/.test(message)
  )
}

function formatPeriodLabel(start: string, end: string) {
  const fmt = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function formatMonthLabel(periodKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (!match) return periodKey
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** YYYY-MM calendar month overlaps [rangeStart, rangeEnd] (inclusive dates). */
function monthOverlapsRange(periodKey: string, rangeStart: string, rangeEnd: string) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return false
  const monthStart = `${periodKey}-01`
  const startDate = new Date(`${monthStart}T00:00:00Z`)
  const monthEndDate = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0)
  )
  const monthEnd = monthEndDate.toISOString().slice(0, 10)
  return monthStart <= rangeEnd && monthEnd >= rangeStart
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  return aStart <= bEnd && aEnd >= bStart
}

function monthKeysBetween(rangeStart: string, rangeEnd: string): string[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(rangeStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(rangeEnd) ||
    rangeEnd < rangeStart
  ) {
    return []
  }
  const keys: string[] = []
  let year = Number(rangeStart.slice(0, 4))
  let month = Number(rangeStart.slice(5, 7))
  const endYear = Number(rangeEnd.slice(0, 4))
  const endMonth = Number(rangeEnd.slice(5, 7))
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return keys
}

function payEntryMonthKey(entry: { periodKey: string; periodStart: string }) {
  if (/^\d{4}-\d{2}$/.test(entry.periodKey)) return entry.periodKey
  const fromStart = entry.periodStart?.slice(0, 7)
  return /^\d{4}-\d{2}$/.test(fromStart || "") ? fromStart! : null
}

/**
 * Operating Budget P&L for a department (not Group giving donations).
 * Periods are custom start/end ranges you create (different each year).
 * Income: student payments (tuition + childcare) in months that overlap the range
 * Expense: approved payroll whose pay period overlaps the range
 */
export async function fetchDepartmentBudgetSummary(
  departmentId: string
): Promise<DepartmentBudgetSummary> {
  const allowed = await canViewDepartment(departmentId)
  if (!allowed) {
    throw new Error("You do not have permission to view the budget.")
  }

  const canManage = await canManageDepartment(departmentId)
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return {
      periods: [],
      byMonth: [],
      monthly: [],
      totals: { ...emptyTotals },
      canManage: false,
      migrationRequired: false,
    }
  }

  const supabase = await createClient()
  const [tuition, payroll, periodsResult] = await Promise.all([
    fetchDepartmentStudentPaymentsMatrix(departmentId),
    fetchDepartmentPayrollList(departmentId, { scope: "all-approved-for-budget" }),
    supabase
      .from("department_budget_periods")
      .select("id, period_start, period_end")
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .order("period_start", { ascending: true }),
  ])

  if (periodsResult.error) {
    if (isMissingTableError(periodsResult.error.message)) {
      return {
        periods: [],
        byMonth: [],
        monthly: [],
        totals: { ...emptyTotals },
        canManage,
        migrationRequired: true,
      }
    }
    throw new Error(periodsResult.error.message)
  }

  const approvedPay = payroll.rows.filter(
    (row) => row.status === "approved" || row.status === "paid"
  )

  const tuitionByMonth = new Map<string, number>()
  for (const enrollment of tuition.rows) {
    for (const [monthKey, cell] of Object.entries(enrollment.months)) {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) continue
      tuitionByMonth.set(
        monthKey,
        roundMoney(Number(tuitionByMonth.get(monthKey) || 0) + Number(cell?.amount || 0))
      )
    }
    for (const [monthKey, amount] of Object.entries(enrollment.childcareMonths || {})) {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) continue
      tuitionByMonth.set(
        monthKey,
        roundMoney(Number(tuitionByMonth.get(monthKey) || 0) + Number(amount || 0))
      )
    }
  }

  const payrollByMonth = new Map<string, number>()
  for (const entry of approvedPay) {
    const monthKey = payEntryMonthKey(entry)
    if (!monthKey) continue
    payrollByMonth.set(
      monthKey,
      roundMoney(Number(payrollByMonth.get(monthKey) || 0) + entry.amount)
    )
  }

  const periods: DepartmentBudgetPeriodTotals[] = (periodsResult.data || []).map(
    (row) => {
      const periodStart = row.period_start as string
      const periodEnd = row.period_end as string

      const studentTuition = roundMoney(
        tuition.rows.reduce((sum, enrollment) => {
          let rowSum = 0
          for (const [monthKey, cell] of Object.entries(enrollment.months)) {
            if (monthOverlapsRange(monthKey, periodStart, periodEnd)) {
              rowSum += Number(cell?.amount || 0)
            }
          }
          for (const [monthKey, amount] of Object.entries(
            enrollment.childcareMonths || {}
          )) {
            if (monthOverlapsRange(monthKey, periodStart, periodEnd)) {
              rowSum += Number(amount || 0)
            }
          }
          return sum + rowSum
        }, 0)
      )

      const teacherSalaries = roundMoney(
        approvedPay.reduce((sum, entry) => {
          if (
            rangesOverlap(
              entry.periodStart,
              entry.periodEnd,
              periodStart,
              periodEnd
            )
          ) {
            return sum + entry.amount
          }
          return sum
        }, 0)
      )

      const profit = roundMoney(studentTuition - teacherSalaries)

      return {
        id: row.id as string,
        periodStart,
        periodEnd,
        label: formatPeriodLabel(periodStart, periodEnd),
        studentTuition,
        teacherSalaries,
        profit,
      }
    }
  )

  const totals = periods.reduce(
    (acc, period) => ({
      studentTuition: roundMoney(acc.studentTuition + period.studentTuition),
      teacherSalaries: roundMoney(acc.teacherSalaries + period.teacherSalaries),
      profit: roundMoney(acc.profit + period.profit),
    }),
    { ...emptyTotals }
  )

  let monthKeys: string[]
  if (periods.length > 0) {
    const rangeStart = periods.reduce(
      (min, p) => (p.periodStart < min ? p.periodStart : min),
      periods[0].periodStart
    )
    const rangeEnd = periods.reduce(
      (max, p) => (p.periodEnd > max ? p.periodEnd : max),
      periods[0].periodEnd
    )
    monthKeys = monthKeysBetween(rangeStart, rangeEnd)
  } else {
    monthKeys = [
      ...new Set([...tuitionByMonth.keys(), ...payrollByMonth.keys()]),
    ].sort()
  }

  const monthly: DepartmentBudgetMonthTotals[] = monthKeys.map((periodKey) => {
    const studentTuition = roundMoney(Number(tuitionByMonth.get(periodKey) || 0))
    const teacherSalaries = roundMoney(Number(payrollByMonth.get(periodKey) || 0))
    return {
      periodKey,
      label: formatMonthLabel(periodKey),
      studentTuition,
      teacherSalaries,
      profit: roundMoney(studentTuition - teacherSalaries),
    }
  })

  return {
    periods,
    byMonth: periods,
    monthly,
    totals,
    canManage,
    migrationRequired:
      tuition.migrationRequired ||
      payroll.migrationRequired ||
      false,
  }
}

export async function fetchDepartmentBudgetAction(departmentId: string) {
  try {
    const summary = await fetchDepartmentBudgetSummary(departmentId)
    return { success: true as const, summary }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load budget.",
    }
  }
}

export async function createDepartmentBudgetPeriodAction(input: {
  departmentId: string
  periodStart: string
  periodEnd: string
}) {
  const allowed = await canManageDepartment(input.departmentId)
  if (!allowed) {
    return {
      success: false as const,
      error: "Only a department head / manager can create budget periods.",
    }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)
  ) {
    return { success: false as const, error: "Enter a valid start and end date." }
  }

  if (input.periodEnd < input.periodStart) {
    return { success: false as const, error: "End date must be on or after the start date." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("department_budget_periods").insert({
    organization_id: organizationId,
    department_id: input.departmentId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    created_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        success: false as const,
        error: "Run scripts/173_department_budget_periods.sql in Supabase first.",
      }
    }
    if (/unique|duplicate/i.test(error.message || "")) {
      return {
        success: false as const,
        error: "A budget period with these dates already exists.",
      }
    }
    return { success: false as const, error: error.message }
  }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}

export async function deleteDepartmentBudgetPeriodAction(input: {
  departmentId: string
  periodId: string
}) {
  const allowed = await canManageDepartment(input.departmentId)
  if (!allowed) {
    return {
      success: false as const,
      error: "Only a department head / manager can delete budget periods.",
    }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("department_budget_periods")
    .delete()
    .eq("id", input.periodId)
    .eq("organization_id", organizationId)
    .eq("department_id", input.departmentId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}
