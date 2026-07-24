"use server"

import { revalidatePath } from "next/cache"

import { userCanAccessOfferingRoster } from "@/lib/auth/portal-capabilities"
import { createClient } from "@/lib/supabase/server"
import type { ProgramAttendanceStatus } from "@/lib/programs/program-attendance-types"

export async function upsertOfferingAttendanceMarks(input: {
  userId: string
  organizationId: string
  offeringId: string
  attendanceDate: string
  marks: Array<{
    enrollmentId: string
    status: ProgramAttendanceStatus
    notes?: string | null
  }>
}): Promise<{ success: true } | { success: false; error: string }> {
  const canAccess = await userCanAccessOfferingRoster({
    userId: input.userId,
    organizationId: input.organizationId,
    offeringId: input.offeringId,
  })

  if (!canAccess) {
    return { success: false, error: "You do not have access to this class." }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.attendanceDate)) {
    return { success: false, error: "Invalid attendance date." }
  }

  if (input.marks.length === 0) {
    return { success: true }
  }

  const supabase = await createClient()

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("auth_user_id", input.userId)
    .maybeSingle()

  const markedByContactId = (contact?.id as string | undefined) ?? null
  const now = new Date().toISOString()

  const rows = input.marks.map((mark) => ({
    organization_id: input.organizationId,
    offering_id: input.offeringId,
    enrollment_id: mark.enrollmentId,
    attendance_date: input.attendanceDate,
    status: mark.status,
    notes: mark.notes?.trim() || null,
    marked_by_contact_id: markedByContactId,
    updated_at: now,
  }))

  const { error } = await supabase.from("program_attendance").upsert(rows, {
    onConflict: "offering_id,enrollment_id,attendance_date",
  })

  if (error) {
    console.error("upsertOfferingAttendanceMarks:", error.message)
    return {
      success: false,
      error: error.message || "Failed to save attendance.",
    }
  }

  revalidatePath(`/my-classes/${input.offeringId}`)
  return { success: true }
}
