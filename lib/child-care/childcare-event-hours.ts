"use server"

import { revalidatePath } from "next/cache"

import { estimateHoursFromTimeRange } from "@/lib/child-care/childcare-event-hours-utils"
import { logDepartmentStaffHoursAction } from "@/lib/departments/department-payroll"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

/**
 * Log childcare provider hours from an event assignment into department payroll.
 */
export async function logChildcareEventHoursAction(input: {
  childcareEventId: string
  hours?: number | null
  notes?: string | null
  /** Required for standalone sessions (no linked internal event department). */
  departmentId?: string | null
}): Promise<
  | { success: true; periodKey?: string; staffId: string; departmentId: string }
  | { success: false; error: string }
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const { data: childcareEvent, error: eventError } = await supabase
    .from("childcare_events")
    .select(
      "id, name, event_date, start_time, end_time, assigned_provider_contact_id, source_type, source_id, organization_id"
    )
    .eq("id", input.childcareEventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (eventError || !childcareEvent) {
    return { success: false, error: "Childcare event not found." }
  }

  const providerContactId = childcareEvent.assigned_provider_contact_id as string | null
  if (!providerContactId) {
    return {
      success: false,
      error: "Assign a childcare provider to this event before logging hours.",
    }
  }

  let departmentId: string | null = input.departmentId?.trim() || null
  const sourceType = (childcareEvent.source_type as string | null) || "standalone"
  const sourceId = childcareEvent.source_id as string | null

  if (!departmentId && sourceType === "internal_event" && sourceId) {
    const { data: internalEvent } = await supabase
      .from("internal_events")
      .select("id, department_id, name")
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .maybeSingle()
    departmentId = (internalEvent?.department_id as string | null) || null
  }

  if (departmentId) {
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (!department) {
      return { success: false, error: "Selected department was not found." }
    }
  }

  if (!departmentId) {
    return {
      success: false,
      error:
        "Select a department for this childcare session so hours can post to payroll.",
    }
  }

  const { data: staffRows, error: staffError } = await supabase
    .from("staff")
    .select(
      "id, contact_id, staff_type, pay_basis, status, position, position_id, hr_positions:position_id (name)"
    )
    .eq("organization_id", organizationId)
    .eq("contact_id", providerContactId)

  if (staffError) {
    return { success: false, error: staffError.message }
  }

  const activeStaff = (staffRows || []).filter((row) => {
    const status = ((row.status as string) || "active").toLowerCase()
    return status === "active" || status === ""
  })

  const childcareStaff =
    activeStaff.find((row) => {
      const staffType = ((row.staff_type as string) || "").toLowerCase()
      const position = row.hr_positions as { name?: string | null } | { name?: string | null }[] | null
      const positionRow = Array.isArray(position) ? position[0] : position
      const positionName = (
        positionRow?.name ||
        (row.position as string | null) ||
        ""
      ).toLowerCase()
      return (
        staffType === "childcare" ||
        staffType === "childcare_provider" ||
        /child\s*care|babysit/.test(positionName)
      )
    }) || activeStaff[0]

  if (!childcareStaff) {
    return {
      success: false,
      error:
        "This provider needs an active staff record (Childcare position or staff type) before hours can go to payroll.",
    }
  }

  const estimated =
    input.hours != null && Number.isFinite(Number(input.hours))
      ? Number(input.hours)
      : estimateHoursFromTimeRange(
          childcareEvent.start_time as string | null,
          childcareEvent.end_time as string | null
        )

  if (estimated == null) {
    return {
      success: false,
      error: "Enter hours worked (could not estimate from event start/end time).",
    }
  }

  const eventName = String(childcareEvent.name || "Childcare event").trim()
  const noteParts = [
    `Event: ${eventName}`,
    input.notes?.trim() || null,
  ].filter(Boolean)

  const result = await logDepartmentStaffHoursAction({
    departmentId,
    staffId: childcareStaff.id as string,
    workDate: String(childcareEvent.event_date).slice(0, 10),
    hours: estimated,
    notes: noteParts.join(" — "),
    childcareEventId: childcareEvent.id as string,
    source: "childcare_event",
  })

  if (!result.success) {
    return result
  }

  revalidatePath(workforceDepartmentDetailPath(departmentId))
  revalidatePath("/workforce")
  revalidatePath("/finance/payroll")
  revalidatePath("/event-management/reports/childcare")
  if (sourceId) {
    revalidatePath(`/event-management/${sourceId}`)
  }

  return {
    success: true,
    periodKey: result.periodKey,
    staffId: childcareStaff.id as string,
    departmentId,
  }
}
