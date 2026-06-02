"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type {
  AttendanceFormState,
  AttendanceStatus,
  LeaveType,
  TimeOffFormState,
  TimeOffStatus,
} from "@/lib/hr/hr-report-types"

function revalidateHrReports() {
  revalidatePath("/hr/reports")
}

export async function saveAttendanceRecord(input: AttendanceFormState & { id?: string }) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.staff_id || !input.record_date) {
    throw new Error("Employee and date are required")
  }

  const payload = {
    organization_id: organizationId,
    staff_id: input.staff_id,
    record_date: input.record_date,
    status: input.status as AttendanceStatus,
    notes: input.notes.trim() || null,
  }

  const { error } = input.id
    ? await supabase
        .from("hr_attendance_records")
        .update(payload)
        .eq("id", input.id)
        .eq("organization_id", organizationId)
    : await supabase.from("hr_attendance_records").insert(payload)

  if (error) {
    console.error("Save attendance record error:", error)
    throw new Error(error.message || "Failed to save attendance record")
  }

  revalidateHrReports()
}

export async function deleteAttendanceRecord(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("hr_attendance_records")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("Delete attendance record error:", error)
    throw new Error(error.message || "Failed to delete attendance record")
  }

  revalidateHrReports()
}

export async function saveTimeOffRecord(input: TimeOffFormState & { id?: string }) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.staff_id || !input.start_date || !input.end_date) {
    throw new Error("Employee and dates are required")
  }

  const daysCount = Number(input.days_count)
  if (!Number.isFinite(daysCount) || daysCount <= 0) {
    throw new Error("Days must be greater than zero")
  }

  const payload = {
    organization_id: organizationId,
    staff_id: input.staff_id,
    leave_type: input.leave_type as LeaveType,
    start_date: input.start_date,
    end_date: input.end_date,
    days_count: daysCount,
    status: input.status as TimeOffStatus,
    notes: input.notes.trim() || null,
  }

  const { error } = input.id
    ? await supabase
        .from("hr_time_off_records")
        .update(payload)
        .eq("id", input.id)
        .eq("organization_id", organizationId)
    : await supabase.from("hr_time_off_records").insert(payload)

  if (error) {
    console.error("Save time off record error:", error)
    throw new Error(error.message || "Failed to save time off record")
  }

  revalidateHrReports()
}

export async function deleteTimeOffRecord(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("hr_time_off_records")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("Delete time off record error:", error)
    throw new Error(error.message || "Failed to delete time off record")
  }

  revalidateHrReports()
}
