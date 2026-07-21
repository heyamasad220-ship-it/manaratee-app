"use server"

import { revalidatePath } from "next/cache"

import {
  loadDepartmentOpenPrograms,
  type DepartmentYearProgramRow,
} from "@/lib/departments/department-active-programs"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  canViewOrganizationBilling,
} from "@/lib/organizations/organization-system-admin"
import { isPlatformAdminOrgSupportSession } from "@/lib/platform/platform-org-access"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import {
  getCurrentUserPermissionContext,
  hasPermission,
} from "@/lib/permissions/permissions"
import { createProgram } from "@/lib/programs/program-actions"
import { createProgramOffering } from "@/lib/programs/program-offering-actions"
import { createClient } from "@/lib/supabase/server"

async function resolveOrgRoleName(
  supabase: Awaited<ReturnType<typeof getCurrentUserPermissionContext>>["supabase"],
  organizationId: string,
  roleId: string | null
) {
  if (!roleId) return null
  const { data } = await supabase
    .from("organization_roles")
    .select("name")
    .eq("organization_id", organizationId)
    .eq("id", roleId)
    .maybeSingle()
  return (data?.name as string | null) ?? null
}

async function canManageDepartmentYears() {
  const allowed =
    (await hasPermission(PERMISSIONS.STAFF_MANAGE)) ||
    (await hasPermission(PERMISSIONS.PROGRAMS_MANAGE))
  return allowed
}

async function canArchiveDepartmentYears() {
  const context = await getCurrentUserPermissionContext()
  const platformSupport = await isPlatformAdminOrgSupportSession(context.organizationId)
  const organizationRoleName = await resolveOrgRoleName(
    context.supabase,
    context.organizationId,
    context.membership.role_id
  )
  return canViewOrganizationBilling({
    systemRole: context.membership.role,
    organizationRoleName,
    platformSupport,
  })
}

function revalidateDepartmentYearPaths(departmentId: string, programId?: string) {
  revalidatePath(workforceDepartmentDetailPath(departmentId))
  revalidatePath("/workforce/departments")
  revalidatePath("/programs/catalog")
  revalidatePath("/programs")
  if (programId) {
    revalidatePath(`/programs/${programId}`)
  }
}

export type DepartmentYearProgramsBundle = {
  openPrograms: DepartmentYearProgramRow[]
  archivedPrograms: DepartmentYearProgramRow[]
  canManageYears: boolean
  canArchiveYears: boolean
}

async function mapProgramsWithOfferingCounts(
  organizationId: string,
  programs: Array<{
    id: string
    name: string
    status: string
    start_date: string | null
    end_date: string | null
    flyer_url: string | null
    enrolled: number | null
    capacity: number | null
    gender: string | null
  }>
): Promise<DepartmentYearProgramRow[]> {
  if (programs.length === 0) return []
  const supabase = await createClient()
  const ids = programs.map((p) => p.id)
  const { data: offerings } = await supabase
    .from("program_offerings")
    .select("program_id")
    .eq("organization_id", organizationId)
    .in("program_id", ids)
    .neq("status", "archived")

  const counts = new Map<string, number>()
  for (const row of offerings || []) {
    const pid = row.program_id as string
    counts.set(pid, (counts.get(pid) || 0) + 1)
  }

  return programs.map((p) => ({
    id: p.id,
    name: p.name || "Program",
    status: p.status || "active",
    startDate: p.start_date,
    endDate: p.end_date,
    flyerUrl: p.flyer_url,
    offeringCount: counts.get(p.id) || 0,
    enrolled: Number(p.enrolled || 0),
    capacity: Number(p.capacity || 0),
    gender: p.gender,
  }))
}

export async function fetchDepartmentYearProgramsAction(
  departmentId: string
): Promise<
  | { success: true; data: DepartmentYearProgramsBundle }
  | { success: false; error: string }
> {
  try {
    const canView = await hasPermission(PERMISSIONS.STAFF_VIEW)
    if (!canView) {
      return { success: false, error: "You do not have permission to view this department." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return {
        success: true,
        data: {
          openPrograms: [],
          archivedPrograms: [],
          canManageYears: false,
          canArchiveYears: false,
        },
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("programs")
      .select(
        "id, name, status, start_date, end_date, flyer_url, enrolled, capacity, gender"
      )
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true })

    if (error) throw new Error(error.message)

    const rows = (data || []) as Array<{
      id: string
      name: string
      status: string
      start_date: string | null
      end_date: string | null
      flyer_url: string | null
      enrolled: number | null
      capacity: number | null
      gender: string | null
    }>

    const open = rows.filter((r) => r.status !== "archived")
    const archived = rows.filter((r) => r.status === "archived")

    const [openPrograms, archivedPrograms, canManageYears, canArchiveYears] =
      await Promise.all([
        mapProgramsWithOfferingCounts(organizationId, open),
        mapProgramsWithOfferingCounts(organizationId, archived),
        canManageDepartmentYears(),
        canArchiveDepartmentYears(),
      ])

    return {
      success: true,
      data: { openPrograms, archivedPrograms, canManageYears, canArchiveYears },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load year programs.",
    }
  }
}

export type CreateDepartmentYearInput = {
  departmentId: string
  name: string
  startDate?: string | null
  endDate?: string | null
  /** Copy courses + teachers from this open/archived year program. */
  copyFromProgramId?: string | null
  flyerUrl?: string | null
  description?: string | null
}

export async function createDepartmentYearProgramAction(
  input: CreateDepartmentYearInput
): Promise<{ success: true; programId: string } | { success: false; error: string }> {
  try {
    if (!(await canManageDepartmentYears())) {
      return { success: false, error: "You do not have permission to create a year program." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const name = input.name.trim()
    if (!name) return { success: false, error: "Program name is required." }

    const supabase = await createClient()
    const { data: department, error: deptError } = await supabase
      .from("departments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.departmentId)
      .maybeSingle()

    if (deptError || !department) {
      return { success: false, error: "Department not found." }
    }

    let source: {
      id: string
      flyer_url: string | null
      description: string | null
      gender: string | null
      program_type: string | null
      visibility: string | null
    } | null = null

    if (input.copyFromProgramId) {
      const { data: sourceRow, error: sourceError } = await supabase
        .from("programs")
        .select("id, flyer_url, description, gender, program_type, visibility, department_id")
        .eq("organization_id", organizationId)
        .eq("id", input.copyFromProgramId)
        .maybeSingle()

      if (sourceError || !sourceRow || sourceRow.department_id !== input.departmentId) {
        return { success: false, error: "Source year program not found in this department." }
      }
      source = sourceRow as typeof source
    }

    const flyerUrl = input.flyerUrl?.trim() || source?.flyer_url || null

    const programId = await createProgram({
      name,
      description:
        input.description?.trim() ||
        source?.description ||
        "Department academic year program",
      department_id: input.departmentId,
      program_type: (source?.program_type as "adult" | "youth" | "family") || "adult",
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      enrollment_open_date: input.startDate || null,
      enrollment_close_date: input.endDate || null,
      gender: source?.gender || "Female",
      capacity: 0,
      status: "active",
      visibility: (source?.visibility as "public" | "private" | "members_only") || "private",
      full_program_registration_enabled: true,
      session_registration_enabled: false,
      require_guardian: false,
      flyer_url: flyerUrl,
    })

    // Remove auto default offering when we will copy course offerings.
    if (source) {
      const { data: sourceOfferings } = await supabase
        .from("program_offerings")
        .select(
          "id, name, offering_type, start_date, end_date, enrollment_open_date, enrollment_close_date, status, is_default"
        )
        .eq("organization_id", organizationId)
        .eq("program_id", source.id)
        .neq("status", "archived")
        .order("name", { ascending: true })

      const courseOfferings = (sourceOfferings || []).filter((o) => {
        const n = String(o.name || "")
        return !/default offering/i.test(n)
      })

      if (courseOfferings.length > 0) {
        await supabase
          .from("program_offerings")
          .delete()
          .eq("organization_id", organizationId)
          .eq("program_id", programId)

        for (const offering of courseOfferings) {
          const createdOffering = await createProgramOffering(programId, {
            name: String(offering.name),
            offering_type:
              (offering.offering_type as
                | "standard"
                | "academic_year"
                | "summer"
                | "season"
                | "recurring") || "academic_year",
            start_date: input.startDate || (offering.start_date as string | null),
            end_date: input.endDate || (offering.end_date as string | null),
            enrollment_open_date:
              input.startDate || (offering.enrollment_open_date as string | null),
            enrollment_close_date:
              input.endDate || (offering.enrollment_close_date as string | null),
            status: "draft",
          })
          const newOfferingId = createdOffering.id as string

          const { data: assignments } = await supabase
            .from("program_staff_assignments")
            .select("contact_id, assignment_role, notes, is_active")
            .eq("organization_id", organizationId)
            .eq("offering_id", offering.id as string)
            .eq("is_active", true)

          for (const assignment of assignments || []) {
            await supabase.from("program_staff_assignments").insert({
              organization_id: organizationId,
              program_id: programId,
              offering_id: newOfferingId,
              contact_id: assignment.contact_id,
              assignment_role: assignment.assignment_role || "primary_instructor",
              notes: assignment.notes,
              is_active: true,
            })
          }
        }
      }
    }

    revalidateDepartmentYearPaths(input.departmentId, programId)
    return { success: true, programId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create year program.",
    }
  }
}

export async function updateDepartmentYearFlyerAction(input: {
  departmentId: string
  programId: string
  flyerUrl: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!(await canManageDepartmentYears())) {
      return { success: false, error: "You do not have permission to update the flyer." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const supabase = await createClient()
    const { data: program, error: findError } = await supabase
      .from("programs")
      .select("id, status, department_id")
      .eq("organization_id", organizationId)
      .eq("id", input.programId)
      .maybeSingle()

    if (findError || !program || program.department_id !== input.departmentId) {
      return { success: false, error: "Program not found in this department." }
    }
    if (program.status === "archived") {
      return { success: false, error: "Archived years are read-only." }
    }

    const { error } = await supabase
      .from("programs")
      .update({
        flyer_url: input.flyerUrl?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.programId)
      .eq("organization_id", organizationId)

    if (error) return { success: false, error: error.message }

    revalidateDepartmentYearPaths(input.departmentId, input.programId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update flyer.",
    }
  }
}

export async function archiveDepartmentYearProgramAction(input: {
  departmentId: string
  programId: string
  confirmName: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!(await canArchiveDepartmentYears())) {
      return {
        success: false,
        error: "Only a Super Admin can archive (close) a department year.",
      }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const supabase = await createClient()
    const { data: program, error: findError } = await supabase
      .from("programs")
      .select("id, name, status, department_id")
      .eq("organization_id", organizationId)
      .eq("id", input.programId)
      .maybeSingle()

    if (findError || !program || program.department_id !== input.departmentId) {
      return { success: false, error: "Program not found in this department." }
    }

    if (program.status === "archived") {
      return { success: false, error: "This year is already archived." }
    }

    if (input.confirmName.trim() !== String(program.name).trim()) {
      return {
        success: false,
        error: "Type the exact program name to confirm archiving.",
      }
    }

    const { error: programError } = await supabase
      .from("programs")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.programId)
      .eq("organization_id", organizationId)

    if (programError) return { success: false, error: programError.message }

    await supabase
      .from("program_offerings")
      .update({
        status: "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("program_id", input.programId)
      .neq("status", "archived")

    revalidateDepartmentYearPaths(input.departmentId, input.programId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not archive year program.",
    }
  }
}

export type DepartmentYearReport = {
  programId: string
  programName: string
  startDate: string | null
  endDate: string | null
  status: string
  studentsCount: number
  offeringsCount: number
  totalPaymentsReceived: number
  totalCourseFees: number
  remainingBalance: number
  roster: Array<{
    studentName: string
    courseName: string
    amountPaid: number
    courseFee: number
  }>
}

export async function fetchDepartmentYearReportAction(
  departmentId: string,
  programId: string
): Promise<
  | { success: true; report: DepartmentYearReport }
  | { success: false; error: string }
> {
  try {
    const canView = await hasPermission(PERMISSIONS.STAFF_VIEW)
    if (!canView) {
      return { success: false, error: "You do not have permission to view reports." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const supabase = await createClient()
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, name, status, start_date, end_date, department_id")
      .eq("organization_id", organizationId)
      .eq("id", programId)
      .maybeSingle()

    if (programError || !program || program.department_id !== departmentId) {
      return { success: false, error: "Year program not found." }
    }

    const { data: offerings } = await supabase
      .from("program_offerings")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)

    const offeringNameById = new Map(
      (offerings || []).map((o) => [o.id as string, (o.name as string) || "Course"])
    )

    const { data: enrollments } = await supabase
      .from("program_enrollments")
      .select("id, child_name, offering_id, total_amount, amount_paid, status")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .in("status", ["pending_payment", "pending", "enrolled", "active", "completed"])

    const enrollmentIds = (enrollments || []).map((e) => e.id as string)
    let paidByEnrollment = new Map<string, number>()
    let feeByEnrollment = new Map<string, number>()

    if (enrollmentIds.length > 0) {
      const { data: charges } = await supabase
        .from("program_charges")
        .select("enrollment_id, amount_paid, total")
        .eq("organization_id", organizationId)
        .in("enrollment_id", enrollmentIds)

      for (const charge of charges || []) {
        const eid = charge.enrollment_id as string
        paidByEnrollment.set(
          eid,
          roundMoney((paidByEnrollment.get(eid) || 0) + Number(charge.amount_paid || 0))
        )
        feeByEnrollment.set(
          eid,
          roundMoney((feeByEnrollment.get(eid) || 0) + Number(charge.total || 0))
        )
      }
    }

    const roster = (enrollments || []).map((row) => {
      const eid = row.id as string
      const courseFee = feeByEnrollment.get(eid) ?? Number(row.total_amount || 0)
      const amountPaid = paidByEnrollment.get(eid) ?? Number(row.amount_paid || 0)
      return {
        studentName: (row.child_name as string) || "Student",
        courseName:
          offeringNameById.get(row.offering_id as string) || "Course",
        amountPaid: roundMoney(amountPaid),
        courseFee: roundMoney(courseFee),
      }
    })

    const totalPaymentsReceived = roundMoney(
      roster.reduce((sum, row) => sum + row.amountPaid, 0)
    )
    const totalCourseFees = roundMoney(
      roster.reduce((sum, row) => sum + row.courseFee, 0)
    )
    const studentNames = new Set(roster.map((r) => r.studentName.toLowerCase()))

    return {
      success: true,
      report: {
        programId: program.id as string,
        programName: (program.name as string) || "Program",
        startDate: (program.start_date as string | null) ?? null,
        endDate: (program.end_date as string | null) ?? null,
        status: (program.status as string) || "active",
        studentsCount: studentNames.size,
        offeringsCount: (offerings || []).length,
        totalPaymentsReceived,
        totalCourseFees,
        remainingBalance: roundMoney(totalCourseFees - totalPaymentsReceived),
        roster,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load year report.",
    }
  }
}

/** @deprecated Prefer fetchDepartmentYearProgramsAction — kept for open-program lists. */
export async function listOpenDepartmentProgramsAction(departmentId: string) {
  try {
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: true as const, programs: [] }
    const programs = await loadDepartmentOpenPrograms(organizationId, departmentId)
    return { success: true as const, programs }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load programs.",
    }
  }
}
