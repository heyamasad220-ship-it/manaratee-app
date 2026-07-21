"use server"

import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { fetchDepartmentPayrollList } from "@/lib/departments/department-payroll"
import { fetchDepartmentStudentPaymentsMatrix } from "@/lib/departments/department-student-payments"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
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

export type DepartmentBudgetSummary = {
  periods: DepartmentBudgetPeriodTotals[]
  /** @deprecated use periods — kept for older callers */
  byMonth: DepartmentBudgetPeriodTotals[]
  totals: {
    studentTuition: number
    teacherSalaries: number
    profit: number
  }
  canManage: boolean
  migrationRequired: boolean
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

/**
 * Operating Budget P&L for a department (not Group giving donations).
 * Periods are custom start/end ranges you create (different each year).
 * Income: student payments (tuition + childcare) in months that overlap the range
 * Expense: approved payroll whose pay period overlaps the range
 */
export async function fetchDepartmentBudgetSummary(
  departmentId: string
): Promise<DepartmentBudgetSummary> {
  const allowed = await hasPermission(PERMISSIONS.STAFF_VIEW)
  if (!allowed) {
    throw new Error("You do not have permission to view the budget.")
  }

  const canManage = await hasPermission(PERMISSIONS.STAFF_MANAGE)
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return {
      periods: [],
      byMonth: [],
      totals: { studentTuition: 0, teacherSalaries: 0, profit: 0 },
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
        totals: { studentTuition: 0, teacherSalaries: 0, profit: 0 },
        canManage,
        migrationRequired: true,
      }
    }
    throw new Error(periodsResult.error.message)
  }

  const approvedPay = payroll.rows.filter((row) => row.status === "approved")

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
    {
      studentTuition: 0,
      teacherSalaries: 0,
      profit: 0,
    }
  )

  return {
    periods,
    byMonth: periods,
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
  const allowed = await hasPermission(PERMISSIONS.STAFF_MANAGE)
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
  const allowed = await hasPermission(PERMISSIONS.STAFF_MANAGE)
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
