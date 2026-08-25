"use server"

import { revalidatePath } from "next/cache"

import { canManageDepartment } from "@/lib/departments/department-access"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import {
  listMoveOfferingTargets,
} from "@/lib/programs/move-enrollment-offering-targets"
import type { MoveOfferingTarget } from "@/lib/programs/move-enrollment-offering-shared"
import { ROSTER_ENROLLMENT_STATUSES } from "@/lib/programs/enrollment-process"
import { getProgramById } from "@/lib/programs/program-queries"
import { createClient } from "@/lib/supabase/server"

const ACTIVE_ENROLLMENT_STATUSES = [
  "pending_payment",
  "pending",
  "enrolled",
  "active",
] as const

const TERMINAL_ENROLLMENT_STATUSES = [
  "cancelled",
  "withdrawn",
  "transferred",
  "expired",
] as const

export type MoveEnrollmentOfferingResult =
  | { success: true; destinationName: string }
  | { success: false; error: string }

async function canMoveProgramEnrollments(departmentId: string | null) {
  if (await hasPermission(PERMISSIONS.PROGRAMS_MANAGE)) return true
  if (departmentId && (await canManageDepartment(departmentId))) return true
  return false
}

function revalidateMovePaths(programId: string, offeringIds: string[]) {
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath("/programs/registrations")
  revalidatePath("/programs/reports/enrollments")
  for (const offeringId of offeringIds) {
    revalidatePath(`/programs/${programId}/offerings/${offeringId}`)
  }
}

export async function getMoveOfferingTargetsAction(programId: string): Promise<
  | { success: true; programName: string; targets: MoveOfferingTarget[] }
  | { success: false; error: string }
> {
  try {
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }
    const program = await getProgramById(programId)
    if (!program) {
      return { success: false, error: "Program not found." }
    }
    const targets = await listMoveOfferingTargets(programId, organizationId)
    return { success: true, programName: program.name, targets }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load offerings.",
    }
  }
}

export async function moveEnrollmentToOfferingAction(input: {
  enrollmentId: string
  fromOfferingId: string
  toOfferingId: string
}): Promise<MoveEnrollmentOfferingResult> {
  try {
    const enrollmentId = String(input.enrollmentId || "").trim()
    const fromOfferingId = String(input.fromOfferingId || "").trim()
    const toOfferingId = String(input.toOfferingId || "").trim()
    if (!enrollmentId || !fromOfferingId || !toOfferingId) {
      return { success: false, error: "Choose an offering to move this student to." }
    }
    if (fromOfferingId === toOfferingId) {
      return { success: false, error: "Pick a different offering." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const supabase = await createClient()
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select(
        "id, program_id, offering_id, status, participant_contact_id, child_person_id, child_name, notes"
      )
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (enrollmentError) throw new Error(enrollmentError.message)
    if (!enrollment) {
      return { success: false, error: "Enrollment not found." }
    }

    const programId = enrollment.program_id as string
    const currentOfferingId = (enrollment.offering_id as string | null) || ""
    if (currentOfferingId !== fromOfferingId) {
      return {
        success: false,
        error: "This student is no longer in that offering. Refresh and try again.",
      }
    }

    const status = String(enrollment.status || "").toLowerCase()
    if (
      (TERMINAL_ENROLLMENT_STATUSES as readonly string[]).includes(status)
    ) {
      return {
        success: false,
        error: "Cancelled or withdrawn enrollments cannot be moved.",
      }
    }

    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, department_id")
      .eq("organization_id", organizationId)
      .eq("id", programId)
      .maybeSingle()

    if (programError) throw new Error(programError.message)
    if (!program) {
      return { success: false, error: "Program not found." }
    }

    if (
      !(await canMoveProgramEnrollments(
        (program.department_id as string | null) || null
      ))
    ) {
      return {
        success: false,
        error: "You do not have permission to move students between offerings.",
      }
    }

    const { data: target, error: targetError } = await supabase
      .from("program_offerings")
      .select("id, name, program_id, status, capacity, capacity_mode")
      .eq("organization_id", organizationId)
      .eq("id", toOfferingId)
      .maybeSingle()

    if (targetError) throw new Error(targetError.message)
    if (!target || (target.program_id as string) !== programId) {
      return {
        success: false,
        error: "Choose another offering in this same program.",
      }
    }
    if (String(target.status || "").toLowerCase() === "archived") {
      return { success: false, error: "That offering is archived." }
    }

    const { data: source, error: sourceError } = await supabase
      .from("program_offerings")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("id", fromOfferingId)
      .maybeSingle()

    if (sourceError) throw new Error(sourceError.message)
    const sourceName = (source?.name as string) || "previous offering"
    const destinationName = (target.name as string) || "Offering"

    const participantContactId =
      (enrollment.participant_contact_id as string | null) || null
    const childPersonId = (enrollment.child_person_id as string | null) || null

    if (participantContactId || childPersonId) {
      let duplicateQuery = supabase
        .from("program_enrollments")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("offering_id", toOfferingId)
        .neq("id", enrollmentId)
        .in("status", [...ACTIVE_ENROLLMENT_STATUSES])
        .limit(1)

      if (participantContactId && childPersonId) {
        duplicateQuery = duplicateQuery.or(
          `participant_contact_id.eq.${participantContactId},child_person_id.eq.${childPersonId}`
        )
      } else if (participantContactId) {
        duplicateQuery = duplicateQuery.eq(
          "participant_contact_id",
          participantContactId
        )
      } else if (childPersonId) {
        duplicateQuery = duplicateQuery.eq("child_person_id", childPersonId)
      }

      const { data: duplicate, error: duplicateError } = await duplicateQuery
      if (duplicateError) throw new Error(duplicateError.message)
      if (duplicate && duplicate.length > 0) {
        return {
          success: false,
          error: `This student is already enrolled in ${destinationName}.`,
        }
      }
    }

    const capacityMode = String(target.capacity_mode || "unlimited").toLowerCase()
    const capacity = Number(target.capacity || 0)
    if (capacityMode === "limited" && capacity > 0) {
      const { count, error: countError } = await supabase
        .from("program_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("offering_id", toOfferingId)
        .in("status", [...ROSTER_ENROLLMENT_STATUSES])

      if (countError) throw new Error(countError.message)
      if ((count || 0) >= capacity) {
        return {
          success: false,
          error: `${destinationName} is full (${count || 0} / ${capacity}).`,
        }
      }
    }

    const movedOn = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    const moveNote = `Moved from ${sourceName} to ${destinationName} on ${movedOn}.`
    const existingNotes = String(enrollment.notes || "").trim()
    const nextNotes = existingNotes
      ? `${existingNotes}\n${moveNote}`
      : moveNote

    const { error: updateError } = await supabase
      .from("program_enrollments")
      .update({
        offering_id: toOfferingId,
        notes: nextNotes,
      })
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)

    if (updateError) {
      if (/duplicate|unique/i.test(updateError.message)) {
        return {
          success: false,
          error: `This student is already enrolled in ${destinationName}.`,
        }
      }
      throw new Error(updateError.message)
    }

    await supabase
      .from("program_charges")
      .update({ offering_id: toOfferingId })
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)

    await supabase
      .from("program_applications")
      .update({ offering_id: toOfferingId })
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)

    await supabase
      .from("program_enrollment_fa_awards")
      .update({ offering_id: toOfferingId })
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)

    await supabase
      .from("program_registration_session_access")
      .delete()
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)

    revalidateMovePaths(programId, [fromOfferingId, toOfferingId])
    return { success: true, destinationName }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to move this student.",
    }
  }
}
