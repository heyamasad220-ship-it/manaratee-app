export type CarTagRow = {
  enrollmentId: string
  participantName: string
  familyLastName: string
  authorizedPickupNames: string[]
  programName: string
  offeringName: string | null
  sessionLabel: string | null
  dismissalGroup: string | null
  gradeLabel: string | null
  contactPhone: string | null
  status: string
  sessionIds: string[]
}

export const CAR_TAG_OPERATIONAL_STATUSES = [
  "pending",
  "enrolled",
  "active",
] as const

export type CarTagLayout = "2-up" | "4-up"

export function isCarTagEligibleStatus(status: string | null | undefined) {
  const normalized = (status || "").trim().toLowerCase()
  return CAR_TAG_OPERATIONAL_STATUSES.includes(
    normalized as (typeof CAR_TAG_OPERATIONAL_STATUSES)[number]
  )
}
