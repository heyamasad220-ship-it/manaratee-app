import { Suspense } from "react"
import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import {
  EnrollmentsReportTable,
  type EnrollmentsReportTableRow,
} from "@/components/programs/enrollments-report-table"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"
import { getDepartments } from "@/lib/departments/department-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import { isOfferingCurrentlyActive } from "@/lib/programs/program-offering-display"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import {
  calculateAgeFromDateOfBirth,
  extractAllergiesFromNotes,
  extractEmergencyContactFromNotes,
  extractPhotoConsentFromNotes,
} from "@/lib/programs/registration-report-helpers"
import {
  contactLabel,
  isTerminalEnrollmentStatus,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"
import { createClient } from "@/lib/supabase/server"

type EnrollmentRow = {
  id: string
  program_id: string | null
  offering_id: string | null
  department_id: string | null
  child_name: string
  child_age: number | null
  child_person_id: string | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  participant_contact_id: string | null
  registrant_contact_id: string | null
  status: string | null
  notes: string | null
}

type PersonRow = {
  id: string
  date_of_birth: string | null
  gender: string | null
}

async function fetchByIdChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return []
  const rows: T[] = []
  const chunkSize = 150
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    rows.push(...(await fetchChunk(chunk)))
  }
  return rows
}

function formatDateOfBirth(value: string | null) {
  if (!value) return "—"
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatEmergencyContact(input: {
  fromNotes: string | null
  parentName: string | null
  parentPhone: string | null
  registrantName: string | null
  registrantPhone: string | null
}) {
  if (input.fromNotes) return input.fromNotes

  const name = input.parentName || input.registrantName
  const phone = input.parentPhone || input.registrantPhone
  if (name && phone) return `${name} · ${phone}`
  if (name) return name
  if (phone) return phone
  return "—"
}

export default async function ProgramsEnrollmentsReportPage() {
  const canView =
    (await hasPermission(PERMISSIONS.PROGRAMS_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    redirect("/unauthorized")
  }

  const supabase = await createClient()
  const [programs, departments] = await Promise.all([
    getOpenPrograms(),
    getDepartments(),
  ])

  const programIds = programs.map((program) => program.id)
  const programNameById = new Map(
    programs.map((program) => [program.id, program.name])
  )
  const programDepartmentById = new Map(
    programs.map((program) => [
      program.id,
      (program.department_id as string | null) || null,
    ])
  )
  const departmentNameById = new Map(
    departments.map((department) => [department.id, department.name])
  )

  let enrollments: EnrollmentRow[] = []
  let loadError: string | null = null
  const offeringNameById = new Map<string, string>()
  const activeOfferingIds = new Set<string>()
  const peopleById = new Map<string, PersonRow>()

  if (programIds.length > 0) {
    const [enrollmentsResult, offeringsResult] = await Promise.all([
      supabase
        .from("program_enrollments")
        .select(
          `
          id,
          program_id,
          offering_id,
          department_id,
          child_name,
          child_age,
          child_person_id,
          parent_name,
          parent_email,
          parent_phone,
          participant_contact_id,
          registrant_contact_id,
          status,
          notes
        `
        )
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .order("child_name", { ascending: true }),
      supabase
        .from("program_offerings")
        .select(
          "id, name, program_id, status, start_date, end_date, enrollment_open_date, enrollment_close_date, inherit_dates"
        )
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .neq("status", "archived")
        .order("name", { ascending: true }),
    ])

    if (enrollmentsResult.error) {
      loadError = enrollmentsResult.error.message
    } else {
      enrollments = (enrollmentsResult.data || []) as EnrollmentRow[]
    }

    const programById = new Map(programs.map((program) => [program.id, program]))

    for (const offering of offeringsResult.data || []) {
      const id = offering.id as string
      offeringNameById.set(id, (offering.name as string) || PROGRAM_LABEL)

      const programId = offering.program_id as string | null
      const program = programId ? programById.get(programId) : null
      if (
        isOfferingCurrentlyActive(
          {
            status: (offering.status as string) || "draft",
            start_date: (offering.start_date as string | null) ?? null,
            end_date: (offering.end_date as string | null) ?? null,
            enrollment_open_date:
              (offering.enrollment_open_date as string | null) ?? null,
            enrollment_close_date:
              (offering.enrollment_close_date as string | null) ?? null,
            inherit_dates: Boolean(offering.inherit_dates),
          },
          program ?? null
        )
      ) {
        activeOfferingIds.add(id)
      }
    }

    const personIds = [
      ...new Set(
        enrollments
          .map((row) => row.child_person_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    if (personIds.length > 0) {
      const people = await fetchByIdChunks(personIds, async (chunk) => {
        const { data, error } = await supabase
          .from("people")
          .select("id, date_of_birth, gender")
          .eq("organization_id", organizationId)
          .in("id", chunk)
        if (error) {
          console.error("enrollments people:", error.message)
          return []
        }
        return (data || []) as PersonRow[]
      })
      for (const person of people) {
        peopleById.set(person.id, person)
      }
    }
  }

  const contactIds = enrollments.flatMap((row) =>
    [row.registrant_contact_id, row.participant_contact_id].filter(
      (id): id is string => Boolean(id)
    )
  )
  const contactsById = await loadContactsByIds(organizationId, contactIds)

  const rows: EnrollmentsReportTableRow[] = enrollments.map((enrollment) => {
    const registrant = enrollment.registrant_contact_id
      ? contactsById.get(enrollment.registrant_contact_id)
      : undefined
    const person = enrollment.child_person_id
      ? peopleById.get(enrollment.child_person_id)
      : undefined

    const contactName = contactLabel(
      registrant,
      enrollment.parent_name || "Unknown contact"
    )
    const contactEmail = registrant?.email || enrollment.parent_email || null
    const contactPhone = registrant?.phone || enrollment.parent_phone || null

    const dateOfBirth = person?.date_of_birth || null
    const ageFromDob = calculateAgeFromDateOfBirth(dateOfBirth)
    const age =
      ageFromDob != null
        ? ageFromDob
        : enrollment.child_age != null
          ? Number(enrollment.child_age)
          : null

    const allergies = extractAllergiesFromNotes(enrollment.notes)
    const photoConsent = extractPhotoConsentFromNotes(enrollment.notes)
    const emergencyFromNotes = extractEmergencyContactFromNotes(
      enrollment.notes
    )

    const departmentId =
      enrollment.department_id ||
      (enrollment.program_id
        ? programDepartmentById.get(enrollment.program_id) || null
        : null)
    const programId = enrollment.program_id
    const offeringId = enrollment.offering_id
    const offeringActivity =
      offeringId && activeOfferingIds.has(offeringId) ? "active" : "closed"

    return {
      id: enrollment.id,
      contactName,
      contactProfileId: enrollment.registrant_contact_id,
      contactEmail,
      contactPhone,
      participantName: enrollment.child_name || "Participant",
      dateOfBirthLabel: formatDateOfBirth(dateOfBirth),
      ageLabel: age != null && Number.isFinite(age) ? String(age) : "—",
      genderLabel: person?.gender?.trim() || "—",
      allergiesLabel: allergies || "—",
      emergencyContactLabel: formatEmergencyContact({
        fromNotes: emergencyFromNotes,
        parentName: enrollment.parent_name,
        parentPhone: enrollment.parent_phone,
        registrantName: registrant?.full_name || null,
        registrantPhone: registrant?.phone || null,
      }),
      photoConsentLabel: photoConsent || "—",
      enrollmentStatus: isTerminalEnrollmentStatus(enrollment.status)
        ? "cancelled"
        : "active",
      departmentId,
      departmentName: departmentId
        ? departmentNameById.get(departmentId) || "Department"
        : "No department",
      programId,
      programName: programId
        ? programNameById.get(programId) || YEAR_SEASON_LABEL
        : YEAR_SEASON_LABEL,
      offeringId,
      offeringName: offeringId
        ? offeringNameById.get(offeringId) || PROGRAM_LABEL
        : PROGRAM_LABEL,
      offeringActivity,
    }
  })

  return (
    <>
      <Header title="Reports" />

      <Suspense fallback={null}>
        <ProgramsReportsNav />
      </Suspense>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enrollments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per participant with demographics, consent, and enrollment
            status.
          </p>
        </div>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <EnrollmentsReportTable rows={rows} />
        )}
      </div>
    </>
  )
}
