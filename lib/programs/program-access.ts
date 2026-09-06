import { redirect } from "next/navigation"

import {
  canManageDepartment,
  canViewDepartment,
  getDepartmentHeadshipForCurrentUser,
} from "@/lib/departments/department-access"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import {
  isLeadOfProgram,
  resolveProgramLeads,
  type ProgramLeadship,
} from "@/lib/programs/program-leadship"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { createClient } from "@/lib/supabase/server"

export function departmentProgramsHref(departmentId: string) {
  return `${workforceDepartmentDetailPath(departmentId)}?tab=programs`
}

export async function getProgramLeadsForCurrentUser(): Promise<ProgramLeadship[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  return resolveProgramLeads(supabase, organizationId, user.id)
}

/** Org-wide Programs lists. Department heads / program leads without programs.view go to their workspace. */
export async function redirectOrgWideProgramPagesForDepartmentHead() {
  const canViewPrograms = await hasAnyPermission(
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (canViewPrograms) return

  const headship = await getDepartmentHeadshipForCurrentUser()
  if (headship) {
    redirect(departmentProgramsHref(headship.departmentId))
  }

  const leads = await getProgramLeadsForCurrentUser()
  if (leads[0]) {
    redirect(programWorkspaceHref(leads[0].programId, { tab: "offerings" }))
  }
}

async function loadProgramDepartmentId(programId: string): Promise<string | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !programId.trim()) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("programs")
    .select("department_id")
    .eq("id", programId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  return (data?.department_id as string | null | undefined) ?? null
}

export async function canAccessProgram(programId: string): Promise<boolean> {
  if (
    await hasAnyPermission(PERMISSIONS.PROGRAMS_VIEW, PERMISSIONS.PROGRAMS_MANAGE)
  ) {
    return true
  }

  const leads = await getProgramLeadsForCurrentUser()
  if (isLeadOfProgram(leads, programId)) return true

  const departmentId = await loadProgramDepartmentId(programId)
  if (!departmentId) return false
  return canViewDepartment(departmentId)
}

export async function canManageProgram(programId: string): Promise<boolean> {
  if (await hasPermission(PERMISSIONS.PROGRAMS_MANAGE)) return true

  const leads = await getProgramLeadsForCurrentUser()
  if (isLeadOfProgram(leads, programId)) return true

  const departmentId = await loadProgramDepartmentId(programId)
  if (!departmentId) return false
  return canManageDepartment(departmentId)
}

export async function canManageProgramDepartment(
  departmentId: string | null | undefined
): Promise<boolean> {
  if (await hasPermission(PERMISSIONS.PROGRAMS_MANAGE)) return true
  const id = String(departmentId || "").trim()
  if (!id) return false
  return canManageDepartment(id)
}

export async function requireProgramAccess(programId: string) {
  const allowed = await canAccessProgram(programId)
  if (!allowed) {
    redirect("/unauthorized")
  }
}

export async function assertCanManageProgram(programId: string) {
  const allowed = await canManageProgram(programId)
  if (!allowed) {
    throw new Error("You do not have permission to manage this program.")
  }
}

export async function canAccessEnrollment(enrollmentId: string): Promise<boolean> {
  if (
    await hasAnyPermission(PERMISSIONS.PROGRAMS_VIEW, PERMISSIONS.PROGRAMS_MANAGE)
  ) {
    return true
  }

  const programId = await loadEnrollmentProgramId(enrollmentId)
  if (!programId) return false
  return canAccessProgram(programId)
}

export async function canManageEnrollment(enrollmentId: string): Promise<boolean> {
  if (await hasPermission(PERMISSIONS.PROGRAMS_MANAGE)) return true

  const programId = await loadEnrollmentProgramId(enrollmentId)
  if (!programId) return false
  return canManageProgram(programId)
}

export async function canManageOffering(offeringId: string): Promise<boolean> {
  if (await hasPermission(PERMISSIONS.PROGRAMS_MANAGE)) return true

  const programId = await loadOfferingProgramId(offeringId)
  if (!programId) return false
  return canManageProgram(programId)
}

async function loadEnrollmentProgramId(enrollmentId: string): Promise<string | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !enrollmentId.trim()) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("program_enrollments")
    .select("program_id")
    .eq("id", enrollmentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  return (data?.program_id as string | null | undefined) ?? null
}

async function loadOfferingProgramId(offeringId: string): Promise<string | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !offeringId.trim()) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("program_offerings")
    .select("program_id")
    .eq("id", offeringId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  return (data?.program_id as string | null | undefined) ?? null
}

export async function requireEnrollmentAccess(enrollmentId: string) {
  const allowed = await canAccessEnrollment(enrollmentId)
  if (!allowed) {
    redirect("/unauthorized")
  }
}

async function loadWaitlistProgramId(waitlistId: string): Promise<string | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !waitlistId.trim()) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("program_waitlist")
    .select("program_id")
    .eq("id", waitlistId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  return (data?.program_id as string | null | undefined) ?? null
}

export async function canAccessWaitlist(waitlistId: string): Promise<boolean> {
  const programId = await loadWaitlistProgramId(waitlistId)
  if (!programId) return false
  return canAccessProgram(programId)
}

export async function canManageWaitlist(waitlistId: string): Promise<boolean> {
  const programId = await loadWaitlistProgramId(waitlistId)
  if (!programId) return false
  return canManageProgram(programId)
}

export async function requireWaitlistAccess(waitlistId: string) {
  const allowed = await canAccessWaitlist(waitlistId)
  if (!allowed) {
    redirect("/unauthorized")
  }
}

async function personHasEnrollmentInDepartment(
  personId: string,
  departmentId: string
): Promise<boolean> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !personId.trim() || !departmentId.trim()) return false

  const supabase = await createClient()
  const { data } = await supabase
    .from("program_enrollments")
    .select("id, department_id, programs:program_id ( department_id )")
    .eq("organization_id", organizationId)
    .eq("child_person_id", personId)
    .limit(50)

  return (data || []).some((row) => {
    const enrollmentDepartmentId = (row.department_id as string | null) || null
    const programRel = row.programs as
      | { department_id?: string | null }
      | Array<{ department_id?: string | null }>
      | null
    const program = Array.isArray(programRel) ? programRel[0] : programRel
    const programDepartmentId = program?.department_id || null
    return enrollmentDepartmentId === departmentId || programDepartmentId === departmentId
  })
}

async function personHasEnrollmentInPrograms(
  personId: string,
  programIds: string[]
): Promise<boolean> {
  const ids = programIds.map((id) => id.trim()).filter(Boolean)
  if (!personId.trim() || ids.length === 0) return false

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return false

  const supabase = await createClient()
  const { data } = await supabase
    .from("program_enrollments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("child_person_id", personId)
    .in("program_id", ids)
    .limit(1)

  return (data || []).length > 0
}

export async function canAccessParticipantPerson(personId: string): Promise<boolean> {
  if (
    await hasAnyPermission(
      PERMISSIONS.PROGRAMS_VIEW,
      PERMISSIONS.PROGRAMS_MANAGE,
      PERMISSIONS.REPORTS_VIEW
    )
  ) {
    return true
  }

  const headship = await getDepartmentHeadshipForCurrentUser()
  if (headship && (await personHasEnrollmentInDepartment(personId, headship.departmentId))) {
    return true
  }

  const leads = await getProgramLeadsForCurrentUser()
  if (leads.length === 0) return false
  return personHasEnrollmentInPrograms(
    personId,
    leads.map((lead) => lead.programId)
  )
}

export async function canManageParticipantPerson(personId: string): Promise<boolean> {
  if (await hasPermission(PERMISSIONS.PROGRAMS_MANAGE)) return true
  if (await hasPermission(PERMISSIONS.CONTACTS_MANAGE)) return true

  const headship = await getDepartmentHeadshipForCurrentUser()
  if (headship && (await personHasEnrollmentInDepartment(personId, headship.departmentId))) {
    return true
  }

  const leads = await getProgramLeadsForCurrentUser()
  if (leads.length === 0) return false
  return personHasEnrollmentInPrograms(
    personId,
    leads.map((lead) => lead.programId)
  )
}
