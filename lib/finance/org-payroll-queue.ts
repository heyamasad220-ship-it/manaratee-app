"use server"

import { revalidatePath } from "next/cache"

import {
  type PayPeriodStatus,
  type StaffPayBasis,
} from "@/lib/departments/department-payroll"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createClient } from "@/lib/supabase/server"

function isChildcareProvider(input: {
  staffType?: string | null
  positionName?: string | null
}) {
  const staffType = (input.staffType || "").toLowerCase()
  if (staffType === "childcare" || staffType === "childcare_provider") return true
  return /child\s*care|babysit/.test((input.positionName || "").toLowerCase())
}

export type FinancePayrollQueueStatus = Extract<
  PayPeriodStatus,
  "approved" | "paid"
>

export type FinancePayrollQueueRow = {
  id: string
  staffId: string
  workerName: string
  positionName: string | null
  isChildcareProvider: boolean
  departmentId: string
  departmentName: string
  periodKey: string
  periodStart: string
  periodEnd: string
  hoursWorked: number | null
  amount: number
  payBasis: StaffPayBasis | null
  status: FinancePayrollQueueStatus
  notes: string | null
  paidAt: string | null
  /** Childcare / other event names from hour logs in this period. */
  eventLabels: string[]
}

function periodBounds(periodKey: string) {
  const custom = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(periodKey)
  if (custom) {
    return { periodStart: custom[1], periodEnd: custom[2] }
  }
  const start = `${periodKey}-01`
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0)
  )
  return { periodStart: start, periodEnd: endDate.toISOString().slice(0, 10) }
}

function isMissingColumnError(message: string | undefined) {
  if (!message) return false
  return /paid_at|column .* does not exist/i.test(message)
}

/**
 * Org-wide payroll queue for Finance: approved (ready to pay) and paid rows.
 */
export async function fetchFinancePayrollQueue(input?: {
  status?: "approved" | "paid" | "all"
}): Promise<{
  rows: FinancePayrollQueueRow[]
  migrationRequired: boolean
  canManage: boolean
}> {
  const canView = await hasPermission(PERMISSIONS.FINANCE_VIEW)
  if (!canView) {
    throw new Error("You do not have permission to view Finance payroll.")
  }

  const canManage = await hasPermission(PERMISSIONS.FINANCE_MANAGE)
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { rows: [], migrationRequired: false, canManage }
  }

  const statusFilter = input?.status || "approved"
  const supabase = await createClient()

  let query = supabase
    .from("department_staff_pay_entries")
    .select(
      `
      id,
      department_id,
      staff_id,
      period_key,
      hours_worked,
      amount,
      pay_basis,
      status,
      notes,
      paid_at,
      department:department_id ( id, name ),
      staff:staff_id (
        id,
        staff_type,
        contact:contact_id ( full_name ),
        position:position_id ( name )
      )
    `
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })

  if (statusFilter === "all") {
    query = query.in("status", ["approved", "paid"])
  } else {
    query = query.eq("status", statusFilter)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingColumnError(error.message)) {
      // Pre-migration: paid_at missing — retry without it, approved only.
      const fallback = await supabase
        .from("department_staff_pay_entries")
        .select(
          `
          id,
          department_id,
          staff_id,
          period_key,
          hours_worked,
          amount,
          pay_basis,
          status,
          notes,
          department:department_id ( id, name ),
          staff:staff_id (
            id,
            staff_type,
            contact:contact_id ( full_name ),
            position:position_id ( name )
          )
        `
        )
        .eq("organization_id", organizationId)
        .eq("status", "approved")
        .order("updated_at", { ascending: false })

      if (fallback.error) {
        throw new Error(fallback.error.message)
      }

      return {
        rows: await attachEventLabels(
          supabase,
          organizationId,
          mapRows(fallback.data || [], true)
        ),
        migrationRequired: true,
        canManage,
      }
    }
    throw new Error(error.message)
  }

  return {
    rows: await attachEventLabels(
      supabase,
      organizationId,
      mapRows(data || [], false)
    ),
    migrationRequired: false,
    canManage,
  }
}

async function attachEventLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  rows: FinancePayrollQueueRow[]
): Promise<FinancePayrollQueueRow[]> {
  if (rows.length === 0) return rows

  const staffIds = [...new Set(rows.map((row) => row.staffId))]
  const departmentIds = [...new Set(rows.map((row) => row.departmentId))]
  const minStart = rows.reduce(
    (min, row) => (row.periodStart < min ? row.periodStart : min),
    rows[0].periodStart
  )
  const maxEnd = rows.reduce(
    (max, row) => (row.periodEnd > max ? row.periodEnd : max),
    rows[0].periodEnd
  )

  const { data: logs } = await supabase
    .from("department_staff_hour_logs")
    .select(
      `
      staff_id,
      department_id,
      work_date,
      notes,
      childcare_event:childcare_event_id ( name )
    `
    )
    .eq("organization_id", organizationId)
    .in("staff_id", staffIds)
    .in("department_id", departmentIds)
    .gte("work_date", minStart)
    .lte("work_date", maxEnd)

  if (!logs?.length) return rows

  return rows.map((row) => {
    const labels = new Set<string>()
    for (const log of logs) {
      if (
        (log.staff_id as string) !== row.staffId ||
        (log.department_id as string) !== row.departmentId
      ) {
        continue
      }
      const workDate = String(log.work_date || "")
      if (workDate < row.periodStart || workDate > row.periodEnd) continue
      const event = log.childcare_event as
        | { name?: string | null }
        | { name?: string | null }[]
        | null
      const eventRow = Array.isArray(event) ? event[0] : event
      const eventName = eventRow?.name?.trim()
      if (eventName) {
        labels.add(eventName)
        continue
      }
      const notes = String(log.notes || "")
      const match = /^Event:\s*(.+?)(?:\s*—|$)/i.exec(notes)
      if (match?.[1]) labels.add(match[1].trim())
    }
    return { ...row, eventLabels: [...labels] }
  })
}

function mapRows(
  data: Array<Record<string, unknown>>,
  forceApprovedOnly: boolean
): FinancePayrollQueueRow[] {
  const rows: FinancePayrollQueueRow[] = []

  for (const row of data) {
    const status = String(row.status || "")
    if (forceApprovedOnly && status !== "approved") continue
    if (status !== "approved" && status !== "paid") continue

    const department = row.department as
      | { id?: string; name?: string | null }
      | { id?: string; name?: string | null }[]
      | null
    const dept = Array.isArray(department) ? department[0] : department
    const staff = row.staff as
      | {
          id?: string
          staff_type?: string | null
          contact?: { full_name?: string | null } | { full_name?: string | null }[] | null
          position?: { name?: string | null } | { name?: string | null }[] | null
        }
      | Array<{
          id?: string
          staff_type?: string | null
          contact?: { full_name?: string | null } | { full_name?: string | null }[] | null
          position?: { name?: string | null } | { name?: string | null }[] | null
        }>
      | null
    const staffRow = Array.isArray(staff) ? staff[0] : staff
    const contact = staffRow?.contact
    const contactRow = Array.isArray(contact) ? contact[0] : contact
    const position = staffRow?.position
    const positionRow = Array.isArray(position) ? position[0] : position
    const positionName = positionRow?.name?.trim() || null
    const periodKey = String(row.period_key || "")
    const bounds = periodBounds(periodKey)

    rows.push({
      id: String(row.id),
      staffId: String(row.staff_id),
      workerName: contactRow?.full_name?.trim() || "Staff",
      positionName,
      isChildcareProvider: isChildcareProvider({
        staffType: staffRow?.staff_type,
        positionName,
      }),
      departmentId: String(row.department_id),
      departmentName: dept?.name?.trim() || "Department",
      periodKey,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      hoursWorked:
        row.hours_worked == null ? null : Number(row.hours_worked),
      amount: roundMoney(Number(row.amount || 0)),
      payBasis:
        row.pay_basis === "hourly" || row.pay_basis === "monthly"
          ? row.pay_basis
          : null,
      status: status as FinancePayrollQueueStatus,
      notes: (row.notes as string | null) || null,
      paidAt: (row.paid_at as string | null) || null,
      eventLabels: [],
    })
  }

  return rows
}

export async function fetchFinancePayrollQueueAction(input?: {
  status?: "approved" | "paid" | "all"
}) {
  try {
    const result = await fetchFinancePayrollQueue(input)
    return { success: true as const, ...result }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not load Finance payroll queue.",
    }
  }
}

export async function markFinancePayrollPaidAction(input: {
  entryIds: string[]
}) {
  const canManage = await hasPermission(PERMISSIONS.FINANCE_MANAGE)
  if (!canManage) {
    return {
      success: false as const,
      error: "Only Finance managers can mark payroll as paid.",
    }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const ids = [
    ...new Set(
      (input.entryIds || []).map((id) => String(id || "").trim()).filter(Boolean)
    ),
  ]
  if (ids.length === 0) {
    return { success: false as const, error: "Select at least one pay entry." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("department_staff_pay_entries")
    .update({
      status: "paid",
      paid_at: now,
      paid_by_user_id: user?.id ?? null,
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .in("id", ids)
    .eq("status", "approved")
    .select("id")

  if (error) {
    if (isMissingColumnError(error.message)) {
      return {
        success: false as const,
        error: "Run scripts/187_finance_module_and_payroll_paid.sql in Supabase first.",
      }
    }
    return { success: false as const, error: error.message }
  }

  revalidatePath("/finance")
  revalidatePath("/finance/payroll")
  return {
    success: true as const,
    updated: (data || []).length,
  }
}
