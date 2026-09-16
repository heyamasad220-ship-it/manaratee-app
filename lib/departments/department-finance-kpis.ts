"use server"

import {
  dateWithinOpenPrograms,
  loadDepartmentOpenPrograms,
} from "@/lib/departments/department-active-programs"
import { canViewDepartment } from "@/lib/departments/department-access"
import { fetchDepartmentBudgetSummary } from "@/lib/departments/department-budget"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

export type DepartmentFinanceKpiExtras = {
  received: number
  expenses: number
  profit: number
}

const emptyExtras: DepartmentFinanceKpiExtras = {
  received: 0,
  expenses: 0,
  profit: 0,
}

export async function fetchDepartmentFinanceKpiExtrasAction(
  departmentId: string
): Promise<
  | { success: true; extras: DepartmentFinanceKpiExtras }
  | { success: false; error: string }
> {
  try {
    const allowed = await canViewDepartment(departmentId)
    if (!allowed) {
      return { success: false, error: "You do not have permission to view this department." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: true, extras: emptyExtras }
    }

    const supabase = await createClient()
    const [summary, programs, expensesResult] = await Promise.all([
      fetchDepartmentBudgetSummary(departmentId),
      loadDepartmentOpenPrograms(organizationId, departmentId),
      supabase
        .from("program_expenses")
        .select("id, vendor, amount, department_id, program_id, expense_date"),
    ])

    const programIds = new Set(programs.map((program) => program.id))
    const datedPrograms = programs.map((program) => ({
      startDate: program.startDate,
      endDate: program.endDate,
    }))

    const expenseRows = (expensesResult.data || []).filter((row) => {
      const programId = (row.program_id as string | null) || null
      if (programId) return programIds.has(programId)
      if ((row.department_id as string | null) !== departmentId) return false
      return dateWithinOpenPrograms(row.expense_date as string | null, datedPrograms)
    })

    const received = roundMoney(
      summary.monthly.reduce((sum, month) => sum + Number(month.studentTuition || 0), 0)
    )
    const payroll = roundMoney(
      summary.monthly.reduce((sum, month) => sum + Number(month.teacherSalaries || 0), 0)
    )
    const operating = roundMoney(
      expenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    )
    const expenses = roundMoney(payroll + operating)
    const profit = roundMoney(received - expenses)

    return {
      success: true,
      extras: {
        received,
        expenses,
        profit,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load financial snapshot.",
    }
  }
}
