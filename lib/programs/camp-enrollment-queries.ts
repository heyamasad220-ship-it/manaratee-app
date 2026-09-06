import { getDepartments } from "@/lib/departments/department-queries"
import { canViewDepartment } from "@/lib/departments/department-access"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  CAMP_DEPARTMENT_NAME,
  SUMMER_CAMP_2026_NAME,
  parseCampMeta,
  splitSummerCamp2026Sessions,
  summerCamp2026Instances,
  type CampParticipationFact,
} from "@/lib/programs/camp-enrollment"
import { ROSTER_ENROLLMENT_STATUSES } from "@/lib/programs/enrollment-status-helpers"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import { createClient } from "@/lib/supabase/server"

type EnrollmentRow = {
  id: string
  program_id: string | null
  registrant_contact_id: string | null
  participant_contact_id: string | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  enrollment_date: string | null
}

type ContactRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

async function fetchPaged<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  let from = 0
  for (;;) {
    const page = await fetchPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }
  return rows
}

export async function getCampEnrollmentFacts(options?: {
  departmentId?: string
}): Promise<
  | { success: true; facts: CampParticipationFact[] }
  | { success: false; error: string }
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  if (options?.departmentId) {
    const canView = await canViewDepartment(options.departmentId)
    if (!canView) {
      return {
        success: false,
        error: "You do not have permission to view this department.",
      }
    }
  }

  try {
    const [allPrograms, departments] = await Promise.all([
      getOpenPrograms(),
      getDepartments(),
    ])
    const campDepartmentIds = new Set(
      departments
        .filter((department) => department.name === CAMP_DEPARTMENT_NAME)
        .map((department) => department.id)
    )
    const programs = allPrograms.filter((program) => {
      if (options?.departmentId) {
        return program.department_id === options.departmentId
      }
      return Boolean(
        program.department_id && campDepartmentIds.has(program.department_id)
      )
    })
    const programIds = programs.map((program) => program.id)
    if (programIds.length === 0) {
      return { success: true, facts: [] }
    }

    const supabase = await createClient()
    const enrollments = await fetchPaged<EnrollmentRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("program_enrollments")
        .select(
          "id, program_id, registrant_contact_id, participant_contact_id, parent_name, parent_email, parent_phone, enrollment_date"
        )
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .in("status", [...ROSTER_ENROLLMENT_STATUSES])
        .range(from, to)
      if (error) throw new Error(error.message)
      return (data || []) as EnrollmentRow[]
    })

    const summer2026 = programs.find(
      (program) => program.name === SUMMER_CAMP_2026_NAME
    )
    const summer2026EnrollmentIds = summer2026
      ? enrollments
          .filter((enrollment) => enrollment.program_id === summer2026.id)
          .map((enrollment) => enrollment.id)
      : []

    const sessionStartsByEnrollment = new Map<string, string[]>()
    if (summer2026 && summer2026EnrollmentIds.length > 0) {
      const chunkSize = 150
      for (let i = 0; i < summer2026EnrollmentIds.length; i += chunkSize) {
        const chunk = summer2026EnrollmentIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from("program_registration_session_access")
          .select("enrollment_id, program_sessions ( start_date )")
          .eq("organization_id", organizationId)
          .in("enrollment_id", chunk)
        if (error) throw new Error(error.message)
        for (const row of data || []) {
          const session = Array.isArray(row.program_sessions)
            ? row.program_sessions[0]
            : row.program_sessions
          const start =
            session && typeof session === "object"
              ? String(
                  (session as { start_date?: string | null }).start_date || ""
                )
              : ""
          if (!start) continue
          const list = sessionStartsByEnrollment.get(row.enrollment_id) || []
          list.push(start)
          sessionStartsByEnrollment.set(row.enrollment_id, list)
        }
      }
    }

    const contactIds = [
      ...new Set(
        enrollments
          .map(
            (enrollment) =>
              enrollment.registrant_contact_id ||
              enrollment.participant_contact_id
          )
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const contacts = new Map<string, ContactRow>()
    for (let i = 0; i < contactIds.length; i += 150) {
      const chunk = contactIds.slice(i, i + 150)
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, email, phone")
        .eq("organization_id", organizationId)
        .in("id", chunk)
      if (error) throw new Error(error.message)
      for (const contact of (data || []) as ContactRow[]) {
        contacts.set(contact.id, contact)
      }
    }

    const programById = new Map(programs.map((program) => [program.id, program]))
    const facts: CampParticipationFact[] = []

    for (const enrollment of enrollments) {
      const programId = enrollment.program_id
      if (!programId) continue
      const program = programById.get(programId)
      if (!program) continue
      const familyId =
        enrollment.registrant_contact_id || enrollment.participant_contact_id
      if (!familyId) continue
      const contact = contacts.get(familyId)
      const familyName =
        contact?.full_name || enrollment.parent_name || "Family"
      const email = contact?.email || enrollment.parent_email || null
      const phone = contact?.phone || enrollment.parent_phone || null

      if (program.name === SUMMER_CAMP_2026_NAME) {
        const split = splitSummerCamp2026Sessions(
          sessionStartsByEnrollment.get(enrollment.id) || []
        )
        for (const instance of summerCamp2026Instances(programId, split)) {
          const meta = parseCampMeta(
            instance.programName,
            instance.startDate,
            instance.endDate
          )
          facts.push({
            familyId,
            familyName,
            email,
            phone,
            instanceKey: instance.instanceKey,
            programId,
            programName: instance.programName,
            season: meta.season,
            year: meta.year,
            startDate: instance.startDate,
            endDate: instance.endDate,
            enrollmentDate: enrollment.enrollment_date,
            sortKey: meta.sortKey,
          })
        }
        continue
      }

      const meta = parseCampMeta(
        program.name,
        program.start_date,
        program.end_date
      )
      facts.push({
        familyId,
        familyName,
        email,
        phone,
        instanceKey: programId,
        programId,
        programName: program.name,
        season: meta.season,
        year: meta.year,
        startDate: meta.startDate,
        endDate: meta.endDate,
        enrollmentDate: enrollment.enrollment_date,
        sortKey: meta.sortKey,
      })
    }

    return { success: true, facts }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load camp enrollment data.",
    }
  }
}
