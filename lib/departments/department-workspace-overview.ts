"use server"

import { fetchDepartmentDetail } from "@/lib/departments/department-actions"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { fetchDepartmentPayrollList } from "@/lib/departments/department-payroll"
import { fetchDepartmentStudentPaymentsMatrix } from "@/lib/departments/department-student-payments"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

export type DepartmentWorkspaceOverview = {
  studentsCount: number
  staffCount: number
  revenue: number
  expenses: number
  net: number
  upcomingEventsCount: number
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * KPI strip for the department workspace header:
 * students, staff, revenue, expenses, net, upcoming events.
 */
export async function fetchDepartmentWorkspaceOverview(
  departmentId: string
): Promise<DepartmentWorkspaceOverview> {
  const canView = await hasPermission(PERMISSIONS.STAFF_VIEW)
  if (!canView) {
    throw new Error("You do not have permission to view this department.")
  }

  const organizationId = await getSelectedOrganizationId()
  const empty: DepartmentWorkspaceOverview = {
    studentsCount: 0,
    staffCount: 0,
    revenue: 0,
    expenses: 0,
    net: 0,
    upcomingEventsCount: 0,
  }
  if (!organizationId) return empty

  const [detail, tuition, payroll] = await Promise.all([
    fetchDepartmentDetail(departmentId),
    fetchDepartmentStudentPaymentsMatrix(departmentId),
    fetchDepartmentPayrollList(departmentId, { scope: "all-approved-for-budget" }),
  ])

  const studentsCount = tuition.rows.length
  const staffCount = detail?.staff.length ?? 0
  const revenue = roundMoney(
    tuition.rows.reduce((sum, row) => sum + Number(row.received || 0), 0)
  )
  const expenses = roundMoney(
    payroll.rows
      .filter((row) => row.status === "approved")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
  )
  const net = roundMoney(revenue - expenses)

  let upcomingEventsCount = 0
  const supabase = await createClient()
  const { data: events, error } = await supabase
    .from("internal_events")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .gte("start_at", `${todayIsoDate()}T00:00:00.000Z`)

  if (!error) {
    upcomingEventsCount = events?.length ?? 0
  }

  return {
    studentsCount,
    staffCount,
    revenue,
    expenses,
    net,
    upcomingEventsCount,
  }
}

export async function fetchDepartmentWorkspaceOverviewAction(departmentId: string) {
  try {
    const overview = await fetchDepartmentWorkspaceOverview(departmentId)
    return { success: true as const, overview }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Could not load department overview.",
    }
  }
}
