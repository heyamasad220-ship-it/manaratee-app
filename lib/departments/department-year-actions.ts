"use server"

import { revalidatePath } from "next/cache"

import {
  loadDepartmentOpenPrograms,
  type DepartmentYearProgramRow,
} from "@/lib/departments/department-active-programs"
import {
  canManageDepartment,
  canViewDepartment,
} from "@/lib/departments/department-access"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { getDepartments } from "@/lib/departments/department-queries"
import type { Department } from "@/lib/departments/department-types"
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
import { copyOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import { createProgramOffering } from "@/lib/programs/program-offering-actions"
import { normalizeProgramAudienceType } from "@/lib/programs/program-offering-attributes"
import { getProgramById } from "@/lib/programs/program-queries"
import type { Program } from "@/lib/programs/program-types"
import { copyOfferingScheduleItems } from "@/lib/programs/program-schedule-actions"
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

async function canManageDepartmentYears(departmentId: string) {
  const allowed =
    (await canManageDepartment(departmentId)) ||
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
  revalidatePath("/programs/registrations")
  revalidatePath("/programs/reports")
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

  const [{ data: offerings }, { data: enrollments }] = await Promise.all([
    supabase
      .from("program_offerings")
      .select("program_id, capacity, capacity_mode")
      .eq("organization_id", organizationId)
      .in("program_id", ids)
      .neq("status", "archived"),
    supabase
      .from("program_enrollments")
      .select("program_id")
      .eq("organization_id", organizationId)
      .in("program_id", ids)
      .in("status", [
        "pending_payment",
        "pending",
        "enrolled",
        "active",
        "completed",
      ]),
  ])

  const offeringCounts = new Map<string, number>()
  const capacityByProgram = new Map<string, number>()
  const unlimitedPrograms = new Set<string>()
  for (const row of offerings || []) {
    const pid = row.program_id as string
    offeringCounts.set(pid, (offeringCounts.get(pid) || 0) + 1)
    const mode = String(row.capacity_mode || "unlimited")
    if (mode === "limited") {
      capacityByProgram.set(
        pid,
        (capacityByProgram.get(pid) || 0) + Math.max(0, Number(row.capacity || 0))
      )
    } else {
      unlimitedPrograms.add(pid)
    }
  }

  const enrolledByProgram = new Map<string, number>()
  for (const row of enrollments || []) {
    const pid = row.program_id as string
    enrolledByProgram.set(pid, (enrolledByProgram.get(pid) || 0) + 1)
  }

  return programs.map((p) => {
    const hasLimited = capacityByProgram.has(p.id)
    const unlimited = unlimitedPrograms.has(p.id) && !hasLimited
    return {
      id: p.id,
      name: p.name || "Program",
      status: p.status || "active",
      startDate: p.start_date,
      endDate: p.end_date,
      flyerUrl: p.flyer_url,
      offeringCount: offeringCounts.get(p.id) || 0,
      enrolled: enrolledByProgram.get(p.id) || 0,
      // 0 capacity = unlimited in the Overview card UI
      capacity: unlimited ? 0 : capacityByProgram.get(p.id) || 0,
      gender: p.gender,
    }
  })
}

export async function fetchDepartmentYearProgramsAction(
  departmentId: string
): Promise<
  | { success: true; data: DepartmentYearProgramsBundle }
  | { success: false; error: string }
> {
  try {
    const canView = await canViewDepartment(departmentId)
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
        canManageDepartmentYears(departmentId),
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

export type DepartmentYearBasicsPayload = {
  program: Program
  visibility: string | null
  departments: Department[]
}

export async function fetchDepartmentYearBasicsAction(
  departmentId: string,
  programId: string
): Promise<
  | { success: true; data: DepartmentYearBasicsPayload }
  | { success: false; error: string }
> {
  try {
    const canView = await canViewDepartment(departmentId)
    if (!canView) {
      return { success: false, error: "You do not have permission to view this department." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const [program, departments] = await Promise.all([
      getProgramById(programId),
      getDepartments(),
    ])

    if (!program || program.department_id !== departmentId) {
      return { success: false, error: "Year/season not found for this department." }
    }

    const visibility =
      ((program as Program & { visibility?: string | null }).visibility ?? null)

    return {
      success: true,
      data: {
        program: program as Program,
        visibility,
        departments,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load year/season details.",
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
    if (!(await canManageDepartmentYears(input.departmentId))) {
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

    const { programId } = await createProgram({
      name,
      description:
        input.description?.trim() ||
        source?.description ||
        "Department academic year program",
      department_id: input.departmentId,
      program_kind: "academic",
      program_type: normalizeProgramAudienceType(source?.program_type) || "adult",
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
          "id, name, offering_type, start_date, end_date, enrollment_open_date, enrollment_close_date, status, is_default, audience_type, min_age, max_age, min_grade, max_grade, grade_levels, gender, require_guardian, require_grade, require_emergency_contact, capacity_mode, capacity, enable_waitlist, waitlist_capacity, waitlist_offer_deadline_days, registration_mode, application_required, attendance_tracked, delivery_format"
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
        for (const offering of courseOfferings) {
          const createdOffering = await createProgramOffering(programId, {
            name: String(offering.name),
            // Type label only — not a behavioral controller (S6).
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
            attributes: {
              audience_type:
                offering.audience_type === "adult" ? "adult" : "youth",
              min_age: (offering.min_age as number | null) ?? null,
              max_age: (offering.max_age as number | null) ?? null,
              min_grade: (offering.min_grade as string | null) ?? null,
              max_grade: (offering.max_grade as string | null) ?? null,
              grade_levels: Array.isArray(offering.grade_levels)
                ? (offering.grade_levels as string[])
                : [],
              gender: (offering.gender as string | null) ?? null,
              require_guardian: Boolean(offering.require_guardian),
              require_grade: Boolean(offering.require_grade),
              require_emergency_contact:
                offering.require_emergency_contact !== false,
              capacity_mode:
                offering.capacity_mode === "limited" ? "limited" : "unlimited",
              capacity: (offering.capacity as number | null) ?? null,
              enable_waitlist: Boolean(offering.enable_waitlist),
              waitlist_capacity:
                (offering.waitlist_capacity as number | null) ?? null,
              waitlist_offer_deadline_days:
                (offering.waitlist_offer_deadline_days as number | null) ?? null,
              registration_mode:
                offering.registration_mode === "optional" ||
                offering.registration_mode === "none"
                  ? offering.registration_mode
                  : "required",
              application_required: offering.application_required !== false,
              attendance_tracked: Boolean(offering.attendance_tracked),
              delivery_format:
                offering.delivery_format === "online" ||
                offering.delivery_format === "hybrid"
                  ? offering.delivery_format
                  : "in_person",
            },
          })
          const newOfferingId = createdOffering.id as string

          await copyOfferingCapacityGroups({
            organizationId,
            programId,
            sourceOfferingId: offering.id as string,
            targetOfferingId: newOfferingId,
          })

          await copyOfferingScheduleItems({
            organizationId,
            programId,
            sourceOfferingId: offering.id as string,
            targetOfferingId: newOfferingId,
          })

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
    if (!(await canManageDepartmentYears(input.departmentId))) {
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

export async function closeDepartmentYearProgramAction(input: {
  departmentId: string
  programId: string
  confirmName: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!(await canArchiveDepartmentYears())) {
      return {
        success: false,
        error: "Only a Super Admin can close a department year.",
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

    if (program.status === "closed" || program.status === "archived") {
      return { success: false, error: "This year is already closed." }
    }

    if (input.confirmName.trim() !== String(program.name).trim()) {
      return {
        success: false,
        error: "Type the exact program name to confirm closing.",
      }
    }

    const { error: programError } = await supabase
      .from("programs")
      .update({
        status: "closed",
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
      error: error instanceof Error ? error.message : "Could not close year program.",
    }
  }
}

/** @deprecated Use closeDepartmentYearProgramAction — years are closed, not archived. */
export async function archiveDepartmentYearProgramAction(input: {
  departmentId: string
  programId: string
  confirmName: string
}): Promise<{ success: true } | { success: false; error: string }> {
  return closeDepartmentYearProgramAction(input)
}

export async function restoreClosedDepartmentYearProgramAction(input: {
  departmentId: string
  programId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!(await canArchiveDepartmentYears())) {
      return {
        success: false,
        error: "Only a Super Admin can restore a closed or archived year.",
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

    if (program.status !== "archived" && program.status !== "closed") {
      return { success: false, error: "Only closed or archived years can be restored this way." }
    }

    const { error: programError } = await supabase
      .from("programs")
      .update({
        status: "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.programId)
      .eq("organization_id", organizationId)

    if (programError) return { success: false, error: programError.message }

    revalidateDepartmentYearPaths(input.departmentId, input.programId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not restore year program.",
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
  teachersCount: number
  /** Aggregate student collections only — no per-student payment detail (FA confidentiality). */
  totalPaymentsReceived: number
  totalCourseFees: number
  remainingBalance: number
  totalPayrollPaid: number
  totalExpenses: number
  net: number
  /** Roster-style: one row per student × course (no fee/paid columns). */
  students: Array<{
    studentName: string
    courseName: string
  }>
  /** Course instructors plus staff with overlapping approved/paid payroll. */
  teachers: Array<{
    teacherName: string
    courseName: string
    amountPaid: number
  }>
}

function periodsOverlap(
  periodStart: string | null,
  periodEnd: string | null,
  rangeStart: string | null,
  rangeEnd: string | null
) {
  if (!rangeStart && !rangeEnd) return true
  if (!periodStart || !periodEnd) return true
  const start = rangeStart || "0000-01-01"
  const end = rangeEnd || "9999-12-31"
  return periodStart <= end && periodEnd >= start
}

export async function fetchDepartmentYearReportAction(
  departmentId: string,
  programId: string
): Promise<
  | { success: true; report: DepartmentYearReport }
  | { success: false; error: string }
> {
  try {
    const canView = await canViewDepartment(departmentId)
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

    const startDate = (program.start_date as string | null) ?? null
    const endDate = (program.end_date as string | null) ?? null

    const { data: offerings } = await supabase
      .from("program_offerings")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .order("name")

    const offeringIds = (offerings || []).map((o) => o.id as string)
    const offeringNameById = new Map(
      (offerings || []).map((o) => [o.id as string, (o.name as string) || "Course"])
    )

    const { data: enrollments } = await supabase
      .from("program_enrollments")
      .select("id, child_name, offering_id, total_amount, amount_paid, status")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .in("status", ["pending_payment", "pending", "enrolled", "active", "completed"])
      .order("child_name")

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

    const students = (enrollments || []).map((row) => ({
      studentName: (row.child_name as string) || "Student",
      courseName: offeringNameById.get(row.offering_id as string) || "Course",
    }))

    let totalPaymentsReceived = 0
    let totalCourseFees = 0
    for (const row of enrollments || []) {
      const eid = row.id as string
      const courseFee = feeByEnrollment.get(eid) ?? Number(row.total_amount || 0)
      const amountPaid = paidByEnrollment.get(eid) ?? Number(row.amount_paid || 0)
      totalCourseFees = roundMoney(totalCourseFees + courseFee)
      totalPaymentsReceived = roundMoney(totalPaymentsReceived + amountPaid)
    }

    const studentNames = new Set(students.map((r) => r.studentName.toLowerCase()))

    // Teachers: all course instructors for this year + anyone with overlapping payroll.
    // (Previously only one instructor per course was kept, so paid co-teachers / unassigned
    // paid staff were missing from the Archive report.)
    const teachersByKey = new Map<
      string,
      { teacherName: string; contactId: string | null; courses: Set<string> }
    >()

    const teacherKey = (name: string, contactId: string | null) =>
      contactId ? `c:${contactId}` : `n:${name.trim().toLowerCase()}`

    if (offeringIds.length > 0) {
      const { data: assignments } = await supabase
        .from("program_staff_assignments")
        .select(
          `
          offering_id,
          contact_id,
          assignment_role,
          is_active,
          contact:contact_id ( full_name )
        `
        )
        .eq("organization_id", organizationId)
        .in("offering_id", offeringIds)
        .order("created_at", { ascending: true })

      for (const row of assignments || []) {
        if (row.is_active === false) continue
        const role = (row.assignment_role as string) || ""
        if (
          role &&
          role !== "primary_instructor" &&
          role !== "instructor" &&
          role !== "teacher"
        ) {
          continue
        }
        const contact = row.contact as { full_name?: string | null } | null
        const name = contact?.full_name?.trim()
        if (!name) continue
        const contactId = (row.contact_id as string | null) ?? null
        const offeringId = row.offering_id as string
        const key = teacherKey(name, contactId)
        const courseName = offeringNameById.get(offeringId) || "Course"
        const existing = teachersByKey.get(key)
        if (existing) {
          existing.courses.add(courseName)
        } else {
          teachersByKey.set(key, {
            teacherName: name,
            contactId,
            courses: new Set([courseName]),
          })
        }
      }
    }

    const paidByContactId = new Map<string, number>()
    const paidByStaffName = new Map<string, number>()
    const paidStaffByKey = new Map<
      string,
      { name: string; contactId: string | null; amount: number }
    >()

    const { data: deptPayEntries } = await supabase
      .from("department_staff_pay_entries")
      .select(
        `
        amount,
        status,
        period_start,
        period_end,
        staff:staff_id ( first_name, last_name, contact_id )
      `
      )
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .in("status", ["approved", "paid"])

    let totalPayrollPaid = 0
    for (const entry of deptPayEntries || []) {
      if (
        !periodsOverlap(
          (entry.period_start as string | null) ?? null,
          (entry.period_end as string | null) ?? null,
          startDate,
          endDate
        )
      ) {
        continue
      }
      const amount = Number(entry.amount || 0)
      totalPayrollPaid = roundMoney(totalPayrollPaid + amount)
      const staff = entry.staff as {
        first_name?: string | null
        last_name?: string | null
        contact_id?: string | null
      } | null
      const contactId = staff?.contact_id || null
      const name = `${staff?.first_name || ""} ${staff?.last_name || ""}`.trim()
      if (contactId) {
        paidByContactId.set(
          contactId,
          roundMoney((paidByContactId.get(contactId) || 0) + amount)
        )
      }
      if (name) {
        const nameKey = name.toLowerCase()
        paidByStaffName.set(
          nameKey,
          roundMoney((paidByStaffName.get(nameKey) || 0) + amount)
        )
      }
      const key = teacherKey(name || "Staff", contactId)
      const existingPaid = paidStaffByKey.get(key)
      if (existingPaid) {
        existingPaid.amount = roundMoney(existingPaid.amount + amount)
      } else {
        paidStaffByKey.set(key, {
          name: name || "Staff",
          contactId,
          amount,
        })
      }
    }

    const assignedContactIds = new Set(
      [...teachersByKey.values()]
        .map((row) => row.contactId)
        .filter((id): id is string => Boolean(id))
    )
    const assignedNames = new Set(
      [...teachersByKey.values()].map((row) => row.teacherName.trim().toLowerCase())
    )

    for (const paid of paidStaffByKey.values()) {
      if (paid.contactId && assignedContactIds.has(paid.contactId)) continue
      if (assignedNames.has(paid.name.trim().toLowerCase())) continue
      const key = teacherKey(paid.name, paid.contactId)
      teachersByKey.set(key, {
        teacherName: paid.name,
        contactId: paid.contactId,
        courses: new Set(),
      })
    }

    const teachers: DepartmentYearReport["teachers"] = [...teachersByKey.values()]
      .map((row) => {
        let amountPaid = 0
        if (row.contactId && paidByContactId.has(row.contactId)) {
          amountPaid = paidByContactId.get(row.contactId) || 0
        } else {
          amountPaid = paidByStaffName.get(row.teacherName.trim().toLowerCase()) || 0
        }
        return {
          teacherName: row.teacherName,
          courseName:
            row.courses.size > 0
              ? [...row.courses].sort((a, b) => a.localeCompare(b)).join(", ")
              : "—",
          amountPaid,
        }
      })
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName))

    // Expenses: department or this year program, within year dates when available.
    const { data: expenseRows } = await supabase
      .from("program_expenses")
      .select("amount, expense_date, department_id, program_id")
      .eq("organization_id", organizationId)

    let totalExpenses = 0
    for (const row of expenseRows || []) {
      const forDept =
        row.department_id === departmentId || row.program_id === programId
      if (!forDept) continue
      const expenseDate = (row.expense_date as string | null) ?? null
      if (expenseDate && startDate && expenseDate < startDate) continue
      if (expenseDate && endDate && expenseDate > endDate) continue
      totalExpenses = roundMoney(totalExpenses + Number(row.amount || 0))
    }

    const remainingBalance = roundMoney(totalCourseFees - totalPaymentsReceived)
    const net = roundMoney(totalPaymentsReceived - totalPayrollPaid - totalExpenses)

    return {
      success: true,
      report: {
        programId: program.id as string,
        programName: (program.name as string) || "Program",
        startDate,
        endDate,
        status: (program.status as string) || "active",
        studentsCount: studentNames.size,
        offeringsCount: (offerings || []).length,
        teachersCount: teachers.length,
        totalPaymentsReceived,
        totalCourseFees,
        remainingBalance,
        totalPayrollPaid,
        totalExpenses,
        net,
        students,
        teachers,
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
