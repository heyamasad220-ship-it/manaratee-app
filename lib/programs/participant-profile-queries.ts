import { createClient } from "@/lib/supabase/server"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
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
import {
  PROGRAM_ATTENDANCE_STATUS_LABELS,
  type ProgramAttendanceStatus,
} from "@/lib/programs/program-attendance-types"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"

export type ParticipantProfileHouseholdMember = {
  personId: string
  name: string
  relationshipType: string
  contactId: string | null
  contactHref: string | null
}

export type ParticipantProfileEnrollment = {
  id: string
  status: string
  statusLabel: string
  isActive: boolean
  childName: string
  departmentName: string
  programName: string
  offeringName: string
  allergies: string | null
  photoConsent: string | null
  emergencyContact: string | null
  registrantContactId: string | null
  registrantName: string | null
  registrantHref: string | null
  registrationHref: string
  createdAt: string | null
}

export type ParticipantProfileAttendance = {
  id: string
  enrollmentId: string
  offeringName: string
  attendanceDate: string
  attendanceDateLabel: string
  status: string
  statusLabel: string
  notes: string | null
}

export type ParticipantProfileWaitlist = {
  id: string
  status: string
  programName: string
  offeringName: string
  createdAt: string | null
}

export type ParticipantProfileApplication = {
  id: string
  status: string
  participantName: string
  programName: string
  offeringName: string
  createdAt: string | null
}

export type ParticipantProfileSessionAccess = {
  id: string
  enrollmentId: string
  offeringName: string
  sessionName: string
  accessStatus: string
  startDate: string | null
  endDate: string | null
}

export type ParticipantProfileData = {
  personId: string
  fullName: string
  dateOfBirth: string | null
  dateOfBirthLabel: string
  age: number | null
  gender: string | null
  grade: string | null
  linkedContactId: string | null
  linkedContactHref: string | null
  allergies: string | null
  photoConsent: string | null
  emergencyContact: string | null
  authorizedPickupNames: string[]
  household: ParticipantProfileHouseholdMember[]
  enrollments: ParticipantProfileEnrollment[]
  attendance: ParticipantProfileAttendance[]
  waitlist: ParticipantProfileWaitlist[]
  applications: ParticipantProfileApplication[]
  sessionAccess: ParticipantProfileSessionAccess[]
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "—"
  const raw = String(value).slice(0, 10)
  const date = new Date(`${raw}T12:00:00`)
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
  return null
}

function titleCaseStatus(status: string | null | undefined) {
  const raw = (status || "").trim()
  if (!raw) return "Unknown"
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function personDisplayName(person: {
  first_name: string | null
  last_name: string | null
  full_name?: string | null
}) {
  const fromParts = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
  if (fromParts) return fromParts
  if (person.full_name?.trim()) return person.full_name.trim()
  return "Participant"
}

async function fetchByIdChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return []
  const rows: T[] = []
  const chunkSize = 150
  for (let i = 0; i < ids.length; i += chunkSize) {
    rows.push(...(await fetchChunk(ids.slice(i, i + chunkSize))))
  }
  return rows
}

export async function getParticipantProfileData(input: {
  organizationId: string
  personId: string
}): Promise<ParticipantProfileData | null> {
  const { organizationId, personId } = input
  const supabase = await createClient()

  const { data: personInitial, error: personError } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, date_of_birth, gender, grade, allergies, emergency_contact, photo_consent"
    )
    .eq("organization_id", organizationId)
    .eq("id", personId)
    .maybeSingle()

  let person = personInitial as {
    id: string
    first_name: string | null
    last_name: string | null
    date_of_birth: string | null
    gender: string | null
    grade: string | null
    allergies: string | null
    emergency_contact: string | null
    photo_consent: string | null
  } | null

  if (personError) {
    console.warn(
      "getParticipantProfileData person (participant details):",
      personError.message
    )
    const fallback = await supabase
      .from("people")
      .select("id, first_name, last_name, date_of_birth, gender, grade")
      .eq("organization_id", organizationId)
      .eq("id", personId)
      .maybeSingle()
    if (fallback.error || !fallback.data) {
      console.error(
        "getParticipantProfileData person:",
        fallback.error?.message || personError.message
      )
      return null
    }
    person = {
      ...(fallback.data as {
        id: string
        first_name: string | null
        last_name: string | null
        date_of_birth: string | null
        gender: string | null
        grade: string | null
      }),
      allergies: null,
      emergency_contact: null,
      photo_consent: null,
    }
  }

  if (!person) return null

  const { data: linkedContact } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", organizationId)
    .eq("person_id", personId)
    .maybeSingle()

  const enrollmentsResult = await supabase
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
      notes,
      created_at
    `
    )
    .eq("organization_id", organizationId)
    .or(
      `child_person_id.eq.${personId}${
        linkedContact?.id
          ? `,participant_contact_id.eq.${linkedContact.id}`
          : ""
      }`
    )
    .order("created_at", { ascending: false })

  if (enrollmentsResult.error) {
    console.error(
      "getParticipantProfileData enrollments:",
      enrollmentsResult.error.message
    )
  }

  const enrollmentsRaw = enrollmentsResult.data || []
  const enrollmentIds = enrollmentsRaw.map((row) => row.id as string)
  const programIds = [
    ...new Set(
      enrollmentsRaw
        .map((row) => row.program_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const offeringIds = [
    ...new Set(
      enrollmentsRaw
        .map((row) => row.offering_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const departmentIds = [
    ...new Set(
      enrollmentsRaw
        .map((row) => row.department_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const contactIds = [
    ...new Set(
      enrollmentsRaw
        .flatMap((row) => [
          row.registrant_contact_id as string | null,
          row.participant_contact_id as string | null,
        ])
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const [
    programs,
    offerings,
    departments,
    contactsById,
    relationships,
    waitlistRows,
    applicationRows,
    attendanceRows,
    sessionAccessRows,
  ] = await Promise.all([
    programIds.length
      ? supabase
          .from("programs")
          .select("id, name, department_id")
          .eq("organization_id", organizationId)
          .in("id", programIds)
          .then((result) => result.data || [])
      : Promise.resolve([]),
    offeringIds.length
      ? supabase
          .from("program_offerings")
          .select("id, name, program_id")
          .eq("organization_id", organizationId)
          .in("id", offeringIds)
          .then((result) => result.data || [])
      : Promise.resolve([]),
    departmentIds.length
      ? supabase
          .from("departments")
          .select("id, name")
          .eq("organization_id", organizationId)
          .in("id", departmentIds)
          .then((result) => result.data || [])
      : Promise.resolve([]),
    loadContactsByIds(organizationId, contactIds),
    supabase
      .from("person_relationships")
      .select("person_id, related_person_id, relationship_type")
      .eq("organization_id", organizationId)
      .or(`person_id.eq.${personId},related_person_id.eq.${personId}`)
      .then((result) => result.data || []),
    supabase
      .from("program_waitlist")
      .select(
        "id, status, program_id, offering_id, created_at, child_person_id"
      )
      .eq("organization_id", organizationId)
      .eq("child_person_id", personId)
      .order("created_at", { ascending: false })
      .then((result) => result.data || []),
    linkedContact?.id || enrollmentIds.length
      ? supabase
          .from("program_applications")
          .select(
            "id, status, participant_name, program_id, offering_id, enrollment_id, participant_contact_id, created_at"
          )
          .eq("organization_id", organizationId)
          .or(
            [
              linkedContact?.id
                ? `participant_contact_id.eq.${linkedContact.id}`
                : null,
              enrollmentIds.length
                ? `enrollment_id.in.(${enrollmentIds.join(",")})`
                : null,
            ]
              .filter(Boolean)
              .join(",")
          )
          .order("created_at", { ascending: false })
          .then((result) => result.data || [])
      : Promise.resolve([]),
    enrollmentIds.length
      ? fetchByIdChunks(enrollmentIds, async (chunk) => {
          const { data, error } = await supabase
            .from("program_attendance")
            .select(
              "id, enrollment_id, offering_id, attendance_date, status, notes"
            )
            .eq("organization_id", organizationId)
            .in("enrollment_id", chunk)
            .order("attendance_date", { ascending: false })
          if (error) {
            console.error(
              "getParticipantProfileData attendance:",
              error.message
            )
            return []
          }
          return data || []
        })
      : Promise.resolve([]),
    enrollmentIds.length
      ? fetchByIdChunks(enrollmentIds, async (chunk) => {
          const { data, error } = await supabase
            .from("program_registration_session_access")
            .select(
              `
              id,
              enrollment_id,
              access_status,
              program_sessions:session_id (
                id,
                name,
                start_date,
                end_date
              )
            `
            )
            .eq("organization_id", organizationId)
            .in("enrollment_id", chunk)
          if (error) {
            console.error(
              "getParticipantProfileData session access:",
              error.message
            )
            return []
          }
          return data || []
        })
      : Promise.resolve([]),
  ])

  const programNameById = new Map(
    (programs as Array<{ id: string; name: string | null; department_id: string | null }>).map(
      (row) => [row.id, row.name || YEAR_SEASON_LABEL]
    )
  )
  const programDepartmentById = new Map(
    (programs as Array<{ id: string; department_id: string | null }>).map(
      (row) => [row.id, row.department_id]
    )
  )
  const offeringNameById = new Map(
    (offerings as Array<{ id: string; name: string | null }>).map((row) => [
      row.id,
      row.name || PROGRAM_LABEL,
    ])
  )
  const departmentNameById = new Map(
    (departments as Array<{ id: string; name: string | null }>).map((row) => [
      row.id,
      row.name || "Department",
    ])
  )

  // Extra names for waitlist/applications offerings/programs not already loaded
  const extraProgramIds = [
    ...new Set(
      [...waitlistRows, ...applicationRows]
        .map((row) => row.program_id as string | null)
        .filter(
          (id): id is string => Boolean(id) && !programNameById.has(id)
        )
    ),
  ]
  const extraOfferingIds = [
    ...new Set(
      [...waitlistRows, ...applicationRows, ...attendanceRows]
        .map((row) => row.offering_id as string | null)
        .filter(
          (id): id is string => Boolean(id) && !offeringNameById.has(id)
        )
    ),
  ]

  if (extraProgramIds.length > 0) {
    const { data } = await supabase
      .from("programs")
      .select("id, name, department_id")
      .eq("organization_id", organizationId)
      .in("id", extraProgramIds)
    for (const row of data || []) {
      programNameById.set(row.id as string, (row.name as string) || YEAR_SEASON_LABEL)
      programDepartmentById.set(
        row.id as string,
        (row.department_id as string | null) || null
      )
    }
  }
  if (extraOfferingIds.length > 0) {
    const { data } = await supabase
      .from("program_offerings")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", extraOfferingIds)
    for (const row of data || []) {
      offeringNameById.set(row.id as string, (row.name as string) || PROGRAM_LABEL)
    }
  }

  const relatedPersonIds = [
    ...new Set(
      (relationships as Array<{
        person_id: string
        related_person_id: string
      }>)
        .flatMap((row) => {
          if (row.person_id === personId) return [row.related_person_id]
          if (row.related_person_id === personId) return [row.person_id]
          return []
        })
        .filter(Boolean)
    ),
  ]

  const relatedPeople =
    relatedPersonIds.length > 0
      ? await supabase
          .from("people")
          .select("id, first_name, last_name")
          .eq("organization_id", organizationId)
          .in("id", relatedPersonIds)
          .then((result) => result.data || [])
      : []

  const relatedContacts =
    relatedPersonIds.length > 0
      ? await supabase
          .from("contacts")
          .select("id, person_id, full_name")
          .eq("organization_id", organizationId)
          .in("person_id", relatedPersonIds)
          .then((result) => result.data || [])
      : []

  const relatedPeopleById = new Map(
    relatedPeople.map((row) => [
      row.id as string,
      personDisplayName({
        first_name: (row.first_name as string | null) || null,
        last_name: (row.last_name as string | null) || null,
      }),
    ])
  )
  const relatedContactByPersonId = new Map(
    relatedContacts.map((row) => [
      row.person_id as string,
      {
        id: row.id as string,
        name: (row.full_name as string | null) || null,
      },
    ])
  )

  const household: ParticipantProfileHouseholdMember[] = []
  const seenHousehold = new Set<string>()
  for (const row of relationships as Array<{
    person_id: string
    related_person_id: string
    relationship_type: string | null
  }>) {
    const otherId =
      row.person_id === personId
        ? row.related_person_id
        : row.related_person_id === personId
          ? row.person_id
          : null
    if (!otherId || seenHousehold.has(otherId)) continue
    seenHousehold.add(otherId)
    const contact = relatedContactByPersonId.get(otherId)
    household.push({
      personId: otherId,
      name:
        relatedPeopleById.get(otherId) ||
        contact?.name ||
        "Family member",
      relationshipType: titleCaseStatus(row.relationship_type || "related"),
      contactId: contact?.id || null,
      contactHref: contact?.id ? contactProfileHref(contact.id) : null,
    })
  }

  // Include registrant contacts not already in household
  for (const enrollment of enrollmentsRaw) {
    const registrantId = enrollment.registrant_contact_id as string | null
    if (!registrantId) continue
    const registrant = contactsById.get(registrantId)
    const already = household.some((member) => member.contactId === registrantId)
    if (already) continue
    household.push({
      personId: `contact:${registrantId}`,
      name: contactLabel(registrant, enrollment.parent_name || "Registrant"),
      relationshipType: "Registrant / guardian",
      contactId: registrantId,
      contactHref: contactProfileHref(registrantId),
    })
  }

  const enrollmentRows: ParticipantProfileEnrollment[] = enrollmentsRaw.map(
    (enrollment) => {
      const registrantId = enrollment.registrant_contact_id as string | null
      const registrant = registrantId
        ? contactsById.get(registrantId)
        : undefined
      const programId = enrollment.program_id as string | null
      const offeringId = enrollment.offering_id as string | null
      const departmentId =
        (enrollment.department_id as string | null) ||
        (programId ? programDepartmentById.get(programId) || null : null)
      const allergies = extractAllergiesFromNotes(
        (enrollment.notes as string | null) || null
      )
      const photoConsent = extractPhotoConsentFromNotes(
        (enrollment.notes as string | null) || null
      )
      const emergencyContact = formatEmergencyContact({
        fromNotes: extractEmergencyContactFromNotes(
          (enrollment.notes as string | null) || null
        ),
        parentName: (enrollment.parent_name as string | null) || null,
        parentPhone: (enrollment.parent_phone as string | null) || null,
        registrantName: registrant?.full_name || null,
        registrantPhone: registrant?.phone || null,
      })
      const status = (enrollment.status as string | null) || "unknown"

      return {
        id: enrollment.id as string,
        status,
        statusLabel: titleCaseStatus(status),
        isActive: !isTerminalEnrollmentStatus(status),
        childName:
          (enrollment.child_name as string | null)?.trim() ||
          personDisplayName({
            first_name: (person.first_name as string | null) || null,
            last_name: (person.last_name as string | null) || null,
          }),
        departmentName: departmentId
          ? departmentNameById.get(departmentId) || "Department"
          : "No department",
        programName: programId
          ? programNameById.get(programId) || YEAR_SEASON_LABEL
          : YEAR_SEASON_LABEL,
        offeringName: offeringId
          ? offeringNameById.get(offeringId) || PROGRAM_LABEL
          : PROGRAM_LABEL,
        allergies,
        photoConsent,
        emergencyContact,
        registrantContactId: registrantId,
        registrantName: contactLabel(
          registrant,
          (enrollment.parent_name as string | null) || null
        ),
        registrantHref: registrantId ? contactProfileHref(registrantId) : null,
        registrationHref: `/programs/registrations/${enrollment.id}`,
        createdAt: (enrollment.created_at as string | null) || null,
      }
    }
  )

  const allergySet = new Set(
    enrollmentRows
      .map((row) => row.allergies)
      .filter((value): value is string => Boolean(value && value !== "—"))
  )
  const notesPhotoConsent =
    enrollmentRows.find((row) => row.photoConsent)?.photoConsent || null
  const notesEmergencyContact =
    enrollmentRows.find((row) => row.emergencyContact)?.emergencyContact ||
    null

  const personAllergies =
    ((person.allergies as string | null) || null)?.trim() || null
  const personPhotoConsent =
    ((person.photo_consent as string | null) || null)?.trim() || null
  const personEmergencyContact =
    ((person.emergency_contact as string | null) || null)?.trim() || null

  const allergies =
    personAllergies ||
    (allergySet.size > 0 ? [...allergySet].join("; ") : null)
  const photoConsent = personPhotoConsent || notesPhotoConsent
  const emergencyContact = personEmergencyContact || notesEmergencyContact

  const offeringNameByEnrollmentId = new Map(
    enrollmentRows.map((row) => [row.id, row.offeringName])
  )

  const attendance: ParticipantProfileAttendance[] = (
    attendanceRows as Array<{
      id: string
      enrollment_id: string
      offering_id: string
      attendance_date: string
      status: string
      notes: string | null
    }>
  ).map((row) => {
    const status = row.status as ProgramAttendanceStatus
    return {
      id: row.id,
      enrollmentId: row.enrollment_id,
      offeringName:
        offeringNameByEnrollmentId.get(row.enrollment_id) ||
        offeringNameById.get(row.offering_id) ||
        PROGRAM_LABEL,
      attendanceDate: row.attendance_date,
      attendanceDateLabel: formatDateLabel(row.attendance_date),
      status: row.status,
      statusLabel:
        PROGRAM_ATTENDANCE_STATUS_LABELS[status] || titleCaseStatus(row.status),
      notes: row.notes,
    }
  })

  const waitlist: ParticipantProfileWaitlist[] = (
    waitlistRows as Array<{
      id: string
      status: string | null
      program_id: string | null
      offering_id: string | null
      created_at: string | null
    }>
  ).map((row) => ({
    id: row.id,
    status: titleCaseStatus(row.status),
    programName: row.program_id
      ? programNameById.get(row.program_id) || YEAR_SEASON_LABEL
      : YEAR_SEASON_LABEL,
    offeringName: row.offering_id
      ? offeringNameById.get(row.offering_id) || PROGRAM_LABEL
      : "—",
    createdAt: row.created_at,
  }))

  const applications: ParticipantProfileApplication[] = (
    applicationRows as Array<{
      id: string
      status: string | null
      participant_name: string | null
      program_id: string | null
      offering_id: string | null
      created_at: string | null
    }>
  ).map((row) => ({
    id: row.id,
    status: titleCaseStatus(row.status),
    participantName: row.participant_name || personDisplayName({
      first_name: (person.first_name as string | null) || null,
      last_name: (person.last_name as string | null) || null,
    }),
    programName: row.program_id
      ? programNameById.get(row.program_id) || YEAR_SEASON_LABEL
      : YEAR_SEASON_LABEL,
    offeringName: row.offering_id
      ? offeringNameById.get(row.offering_id) || PROGRAM_LABEL
      : PROGRAM_LABEL,
    createdAt: row.created_at,
  }))

  const sessionAccess: ParticipantProfileSessionAccess[] = (
    sessionAccessRows as Array<{
      id: string
      enrollment_id: string
      access_status: string | null
      program_sessions:
        | {
            id: string
            name: string | null
            start_date: string | null
            end_date: string | null
          }
        | {
            id: string
            name: string | null
            start_date: string | null
            end_date: string | null
          }[]
        | null
    }>
  ).map((row) => {
    const session = Array.isArray(row.program_sessions)
      ? row.program_sessions[0]
      : row.program_sessions
    return {
      id: row.id,
      enrollmentId: row.enrollment_id,
      offeringName:
        offeringNameByEnrollmentId.get(row.enrollment_id) || PROGRAM_LABEL,
      sessionName: session?.name || "Session",
      accessStatus: titleCaseStatus(row.access_status || "active"),
      startDate: session?.start_date || null,
      endDate: session?.end_date || null,
    }
  })

  const authorizedPickupNames = [
    ...new Set(
      household
        .filter((member) => !member.personId.startsWith("contact:"))
        .map((member) => member.name)
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b))

  const dateOfBirth = (person.date_of_birth as string | null) || null
  const fullName = personDisplayName({
    first_name: (person.first_name as string | null) || null,
    last_name: (person.last_name as string | null) || null,
  })
  const fallbackName = enrollmentRows[0]?.childName
  const displayName =
    fullName !== "Participant" ? fullName : fallbackName || fullName

  return {
    personId,
    fullName: displayName,
    dateOfBirth,
    dateOfBirthLabel: formatDateLabel(dateOfBirth),
    age: calculateAgeFromDateOfBirth(dateOfBirth),
    gender: ((person.gender as string | null) || null)?.trim() || null,
    grade: ((person.grade as string | null) || null)?.trim() || null,
    linkedContactId: (linkedContact?.id as string | undefined) || null,
    linkedContactHref: linkedContact?.id
      ? contactProfileHref(linkedContact.id as string)
      : null,
    allergies: allergySet.size > 0 ? [...allergySet].join("; ") : null,
    photoConsent,
    emergencyContact,
    authorizedPickupNames,
    household,
    enrollments: enrollmentRows,
    attendance,
    waitlist,
    applications,
    sessionAccess,
  }
}
