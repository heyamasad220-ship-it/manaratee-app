/** Summer Camp 2026 windows (weeks 1–4 / 5–8). */
const CAMP1_END = "2026-06-25"
const CAMP2_START = "2026-06-29"

export type OfferingSessionCampLabel = "Camp 1" | "Camp 2"

export type OfferingSessionEnrollmentRow = {
  sessionId: string
  name: string
  startDate: string | null
  endDate: string | null
  capacity: number
  /** Active enrollments with access to this session. */
  enrolled: number
  campLabel: OfferingSessionCampLabel | null
}

export type OfferingSessionEnrollmentSummary = {
  sessions: OfferingSessionEnrollmentRow[]
  /** Unique kids with any Camp 1 week access. */
  camp1Unique: number
  /** Unique kids with any Camp 2 week access. */
  camp2Unique: number
  /** Unique kids with both Camp 1 and Camp 2 access. */
  bothCampsUnique: number
}

export type OfferingSessionRosterParticipant = {
  enrollmentId: string
  childName: string
  childAge: number | null
  parentName: string | null
  status: string | null
}

export type OfferingSessionRoster = {
  session: OfferingSessionEnrollmentRow
  participants: OfferingSessionRosterParticipant[]
}

export function campLabelForSession(
  startDate: string | null,
  endDate: string | null
): OfferingSessionCampLabel | null {
  const start = String(startDate || "")
  const end = String(endDate || "")
  if (end && end <= CAMP1_END) return "Camp 1"
  if (start && start >= CAMP2_START) return "Camp 2"
  return null
}

function formatSessionDateRange(
  startDate: string | null,
  endDate: string | null
) {
  if (!startDate && !endDate) return null
  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} → ${endDate}`
  }
  return startDate || endDate
}

export function formatOfferingSessionDateLabel(
  startDate: string | null,
  endDate: string | null
) {
  return formatSessionDateRange(startDate, endDate)
}
