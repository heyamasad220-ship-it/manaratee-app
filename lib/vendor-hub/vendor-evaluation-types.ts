/** Same scale as volunteer event performance ratings. */
export type VendorParticipationRating = "excellent" | "good" | "average" | "poor"

export const VENDOR_PARTICIPATION_RATINGS: VendorParticipationRating[] = [
  "excellent",
  "good",
  "average",
  "poor",
]

export const VENDOR_PARTICIPATION_RATING_LABELS: Record<VendorParticipationRating, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  poor: "Poor",
}

export type VendorParticipationEvaluation = {
  id: string
  organizationId: string
  vendorHubEventId: string
  contactId: string
  boothAssignmentId: string | null
  rating: VendorParticipationRating
  wouldInviteAgain: boolean | null
  notes: string | null
  reviewedAt: string | null
}

export type VendorEventEvaluationRow = {
  contactId: string
  vendorName: string
  vendorEmail: string | null
  boothNumber: string | null
  boothAssignmentId: string | null
  assignmentStatus: string | null
  evaluation: VendorParticipationEvaluation | null
}

export type VendorEventEvaluationSummary = {
  participantsTotal: number
  evaluatedCount: number
  pendingCount: number
  rows: VendorEventEvaluationRow[]
}

export type VendorContactEvaluationRow = {
  id: string
  eventId: string
  eventName: string
  eventDate: string | null
  boothNumber: string | null
  rating: VendorParticipationRating
  wouldInviteAgain: boolean | null
  notes: string | null
  reviewedAt: string | null
}
