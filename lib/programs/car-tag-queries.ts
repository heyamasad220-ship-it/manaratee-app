import { splitFullName } from "@/lib/contacts/contact-constants"
import { createClient } from "@/lib/supabase/server"
import {
  CAR_TAG_OPERATIONAL_STATUSES,
  type CarTagRow,
} from "@/lib/programs/car-tag-types"
import { loadContactsByIds } from "@/lib/programs/registration-display-helpers"
import { getProgramById } from "@/lib/programs/program-queries"
import { getProgramSessions } from "@/lib/programs/program-session-queries"

function extractLastName(fullName: string | null | undefined) {
  if (!fullName?.trim()) return ""
  return splitFullName(fullName.trim()).last_name
}

function formatPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone.trim()
}

async function loadAuthorizedPickupNamesByPersonIds(
  organizationId: string,
  personIds: string[]
) {
  const uniquePersonIds = [...new Set(personIds.filter(Boolean))]
  const result = new Map<string, string[]>()

  if (uniquePersonIds.length === 0) {
    return result
  }

  const supabase = await createClient()

  const { data: relationships, error } = await supabase
    .from("person_relationships")
    .select("person_id, related_person_id, relationship_type")
    .eq("organization_id", organizationId)
    .or(
      `person_id.in.(${uniquePersonIds.join(",")}),related_person_id.in.(${uniquePersonIds.join(",")})`
    )

  if (error || !relationships?.length) {
    return result
  }

  const relatedPersonIds = new Set<string>()

  for (const row of relationships) {
    const personId = row.person_id as string
    const relatedPersonId = row.related_person_id as string

    if (uniquePersonIds.includes(personId) && relatedPersonId) {
      relatedPersonIds.add(relatedPersonId)
    }
    if (uniquePersonIds.includes(relatedPersonId) && personId) {
      relatedPersonIds.add(personId)
    }
  }

  if (relatedPersonIds.size === 0) {
    return result
  }

  const { data: people } = await supabase
    .from("people")
    .select("id, first_name, last_name")
    .eq("organization_id", organizationId)
    .in("id", [...relatedPersonIds])

  const peopleById = new Map(
    (people || []).map((person) => [
      person.id as string,
      `${person.first_name || ""} ${person.last_name || ""}`.trim(),
    ])
  )

  for (const row of relationships) {
    const personId = row.person_id as string
    const relatedPersonId = row.related_person_id as string

    for (const anchorId of uniquePersonIds) {
      let otherId: string | null = null
      if (personId === anchorId) otherId = relatedPersonId
      if (relatedPersonId === anchorId) otherId = personId
      if (!otherId || otherId === anchorId) continue

      const name = peopleById.get(otherId)
      if (!name) continue

      const existing = result.get(anchorId) || []
      if (!existing.includes(name)) {
        result.set(anchorId, [...existing, name])
      }
    }
  }

  return result
}

export async function getCarTagRowsForProgram(
  programId: string,
  organizationId: string
): Promise<{ programName: string; rows: CarTagRow[] } | null> {
  const program = await getProgramById(programId)

  if (!program || program.organization_id !== organizationId) {
    return null
  }

  const supabase = await createClient()

  const { data: enrollments, error } = await supabase
    .from("program_enrollments")
    .select(
      `
      id,
      status,
      child_name,
      parent_name,
      parent_phone,
      session_name,
      participant_contact_id,
      registrant_contact_id,
      offering_id,
      program_offerings:offering_id (
        id,
        name
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .in("status", [...CAR_TAG_OPERATIONAL_STATUSES])
    .order("child_name", { ascending: true })

  if (error) {
    console.error("[getCarTagRowsForProgram]", error.message)
    throw new Error("Failed to load enrollments for car tags.")
  }

  const enrollmentList = enrollments || []

  if (enrollmentList.length === 0) {
    return { programName: program.name, rows: [] }
  }

  const enrollmentIds = enrollmentList.map((row) => row.id as string)

  const contactIds = enrollmentList.flatMap((row) =>
    [row.participant_contact_id, row.registrant_contact_id].filter(Boolean)
  ) as string[]

  const [contacts, sessionAccessRows, participantContacts] = await Promise.all([
    loadContactsByIds(organizationId, contactIds),
    supabase
      .from("program_registration_session_access")
      .select(
        `
        enrollment_id,
        session_id,
        program_sessions:session_id (
          id,
          name
        )
      `
      )
      .eq("organization_id", organizationId)
      .in("enrollment_id", enrollmentIds),
    supabase
      .from("contacts")
      .select("id, person_id")
      .eq("organization_id", organizationId)
      .in(
        "id",
        enrollmentList
          .map((row) => row.participant_contact_id)
          .filter(Boolean) as string[]
      ),
  ])

  const sessionsByEnrollment = new Map<string, { ids: string[]; labels: string[] }>()

  for (const row of sessionAccessRows.data || []) {
    const enrollmentId = row.enrollment_id as string
    const sessionId = row.session_id as string
    const session = row.program_sessions as { id: string; name: string } | null
    const label = session?.name || "Session"

    const existing = sessionsByEnrollment.get(enrollmentId) || {
      ids: [],
      labels: [],
    }

    if (!existing.ids.includes(sessionId)) {
      existing.ids.push(sessionId)
      existing.labels.push(label)
    }

    sessionsByEnrollment.set(enrollmentId, existing)
  }

  const participantPersonIds = (participantContacts.data || [])
    .map((row) => row.person_id as string | null)
    .filter(Boolean) as string[]

  const pickupByPersonId = await loadAuthorizedPickupNamesByPersonIds(
    organizationId,
    participantPersonIds
  )

  const participantPersonIdByContactId = new Map(
    (participantContacts.data || []).map((row) => [
      row.id as string,
      row.person_id as string | null,
    ])
  )

  const rows: CarTagRow[] = enrollmentList.map((enrollment) => {
    const participantContact = enrollment.participant_contact_id
      ? contacts.get(enrollment.participant_contact_id as string)
      : undefined
    const registrantContact = enrollment.registrant_contact_id
      ? contacts.get(enrollment.registrant_contact_id as string)
      : undefined

    const participantName =
      participantContact?.full_name ||
      (enrollment.child_name as string | null) ||
      "Participant"

    const familyLastName =
      extractLastName(registrantContact?.full_name) ||
      extractLastName(enrollment.parent_name as string | null) ||
      extractLastName(participantName)

    const offering = enrollment.program_offerings as { name: string } | null
    const sessionInfo = sessionsByEnrollment.get(enrollment.id as string)
    const sessionLabel =
      sessionInfo?.labels.join(", ") ||
      (enrollment.session_name as string | null) ||
      null

    const participantPersonId = enrollment.participant_contact_id
      ? participantPersonIdByContactId.get(
          enrollment.participant_contact_id as string
        )
      : null

    const authorizedPickupNames = participantPersonId
      ? pickupByPersonId.get(participantPersonId) || []
      : []

    const registrantName =
      registrantContact?.full_name ||
      (enrollment.parent_name as string | null) ||
      null

    const pickupSet = new Set<string>()
    if (registrantName) pickupSet.add(registrantName)
    authorizedPickupNames.forEach((name) => pickupSet.add(name))

    const contactPhone =
      formatPhone(registrantContact?.phone) ||
      formatPhone(enrollment.parent_phone as string | null) ||
      formatPhone(participantContact?.phone)

    return {
      enrollmentId: enrollment.id as string,
      participantName,
      familyLastName,
      authorizedPickupNames: [...pickupSet].filter(
        (name) => name !== participantName
      ),
      programName: program.name,
      offeringName: offering?.name || null,
      sessionLabel,
      dismissalGroup: null,
      gradeLabel: null,
      contactPhone,
      status: enrollment.status as string,
      sessionIds: sessionInfo?.ids || [],
    }
  })

  return { programName: program.name, rows }
}

export async function getCarTagProgramContext(programId: string) {
  const sessions = await getProgramSessions(programId)
  return { sessions }
}
