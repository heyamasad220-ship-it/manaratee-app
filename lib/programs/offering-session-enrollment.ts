import { createClient } from "@/lib/supabase/server"
import { resolveSessionEffectiveCapacity } from "@/lib/programs/program-catalog-capacity"
import {
  campLabelForSession,
  type OfferingSessionEnrollmentSummary,
  type OfferingSessionRoster,
  type OfferingSessionRosterParticipant,
} from "@/lib/programs/offering-session-enrollment-types"

export type {
  OfferingSessionCampLabel,
  OfferingSessionEnrollmentRow,
  OfferingSessionEnrollmentSummary,
  OfferingSessionRoster,
  OfferingSessionRosterParticipant,
} from "@/lib/programs/offering-session-enrollment-types"
export {
  campLabelForSession,
  formatOfferingSessionDateLabel,
} from "@/lib/programs/offering-session-enrollment-types"

/**
 * Per-session headcounts for an offering (from session access + active enrollments).
 */
export async function getOfferingSessionEnrollmentSummary(
  offeringId: string,
  organizationId: string
): Promise<OfferingSessionEnrollmentSummary> {
  const supabase = await createClient()

  const { data: sessions, error: sessionsError } = await supabase
    .from("program_sessions")
    .select("id, name, start_date, end_date, capacity, sort_order, status")
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .neq("status", "archived")
    .order("start_date", { ascending: true })
    .order("sort_order", { ascending: true })

  const { data: offeringRow } = await supabase
    .from("program_offerings")
    .select("capacity, capacity_mode")
    .eq("id", offeringId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const offeringCapacity = offeringRow
    ? {
        capacity_mode: offeringRow.capacity_mode as string | null,
        capacity:
          offeringRow.capacity == null ? null : Number(offeringRow.capacity),
      }
    : null

  if (sessionsError) {
    console.error(
      "getOfferingSessionEnrollmentSummary sessions:",
      sessionsError.message
    )
    return {
      sessions: [],
      camp1Unique: 0,
      camp2Unique: 0,
      bothCampsUnique: 0,
    }
  }

  const sessionRows = sessions || []
  if (sessionRows.length === 0) {
    return {
      sessions: [],
      camp1Unique: 0,
      camp2Unique: 0,
      bothCampsUnique: 0,
    }
  }

  const { data: enrollments, error: enError } = await supabase
    .from("program_enrollments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .neq("status", "cancelled")

  if (enError) {
    console.error(
      "getOfferingSessionEnrollmentSummary enrollments:",
      enError.message
    )
  }

  const activeEnrollmentIds = new Set(
    (enrollments || []).map((row) => row.id as string)
  )

  const sessionIds = sessionRows.map((row) => row.id as string)
  const counts = new Map<string, number>()
  const camp1Enrollments = new Set<string>()
  const camp2Enrollments = new Set<string>()

  if (activeEnrollmentIds.size > 0 && sessionIds.length > 0) {
    const { data: accessRows, error: accessError } = await supabase
      .from("program_registration_session_access")
      .select("enrollment_id, session_id, access_status")
      .eq("organization_id", organizationId)
      .in("session_id", sessionIds)

    if (accessError) {
      console.error(
        "getOfferingSessionEnrollmentSummary access:",
        accessError.message
      )
    } else {
      const sessionMeta = new Map(
        sessionRows.map((row) => [
          row.id as string,
          {
            camp: campLabelForSession(
              row.start_date as string | null,
              row.end_date as string | null
            ),
          },
        ])
      )

      for (const row of accessRows || []) {
        const enrollmentId = row.enrollment_id as string
        const sessionId = row.session_id as string
        if (!activeEnrollmentIds.has(enrollmentId)) continue
        if (
          row.access_status &&
          String(row.access_status).toLowerCase() !== "active"
        ) {
          continue
        }
        counts.set(sessionId, (counts.get(sessionId) || 0) + 1)
        const camp = sessionMeta.get(sessionId)?.camp
        if (camp === "Camp 1") camp1Enrollments.add(enrollmentId)
        if (camp === "Camp 2") camp2Enrollments.add(enrollmentId)
      }
    }
  }

  let both = 0
  for (const id of camp1Enrollments) {
    if (camp2Enrollments.has(id)) both++
  }

  return {
    sessions: sessionRows.map((row) => ({
      sessionId: row.id as string,
      name: (row.name as string) || "Session",
      startDate: (row.start_date as string | null) ?? null,
      endDate: (row.end_date as string | null) ?? null,
      capacity: resolveSessionEffectiveCapacity(
        row.capacity as number | null,
        offeringCapacity
      ),
      enrolled: counts.get(row.id as string) || 0,
      campLabel: campLabelForSession(
        row.start_date as string | null,
        row.end_date as string | null
      ),
    })),
    camp1Unique: camp1Enrollments.size,
    camp2Unique: camp2Enrollments.size,
    bothCampsUnique: both,
  }
}

export async function getOfferingSessionRoster(
  offeringId: string,
  sessionId: string,
  organizationId: string
): Promise<OfferingSessionRoster | null> {
  const summary = await getOfferingSessionEnrollmentSummary(
    offeringId,
    organizationId
  )
  const session = summary.sessions.find((row) => row.sessionId === sessionId)
  if (!session) return null

  const supabase = await createClient()

  const { data: accessRows, error: accessError } = await supabase
    .from("program_registration_session_access")
    .select("enrollment_id, access_status")
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)

  if (accessError) {
    console.error("getOfferingSessionRoster access:", accessError.message)
    return { session, participants: [] }
  }

  const enrollmentIds = [
    ...new Set(
      (accessRows || [])
        .filter(
          (row) =>
            !row.access_status ||
            String(row.access_status).toLowerCase() === "active"
        )
        .map((row) => row.enrollment_id as string)
        .filter(Boolean)
    ),
  ]

  if (enrollmentIds.length === 0) {
    return { session, participants: [] }
  }

  const participants: OfferingSessionRosterParticipant[] = []
  for (let i = 0; i < enrollmentIds.length; i += 100) {
    const chunk = enrollmentIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from("program_enrollments")
      .select("id, child_name, child_age, parent_name, status")
      .eq("organization_id", organizationId)
      .eq("offering_id", offeringId)
      .in("id", chunk)
      .neq("status", "cancelled")
      .order("child_name", { ascending: true })

    if (error) {
      console.error("getOfferingSessionRoster enrollments:", error.message)
      continue
    }

    for (const row of data || []) {
      participants.push({
        enrollmentId: row.id as string,
        childName:
          (row.child_name as string | null)?.trim() || "Participant",
        childAge: row.child_age == null ? null : Number(row.child_age),
        parentName: (row.parent_name as string | null) ?? null,
        status: (row.status as string | null) ?? null,
      })
    }
  }

  participants.sort((a, b) =>
    a.childName.localeCompare(b.childName, undefined, { sensitivity: "base" })
  )

  return {
    session: { ...session, enrolled: participants.length },
    participants,
  }
}
