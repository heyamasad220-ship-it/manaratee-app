export type OfferingActivityStatus = "active" | "closed"
export type EnrollmentRowStatus = "active" | "cancelled"

export type EnrollmentsReportTableRow = {
  id: string
  participantPersonId: string | null
  contactName: string
  contactProfileId: string | null
  contactEmail: string | null
  contactPhone: string | null
  participantName: string
  dateOfBirthLabel: string
  ageLabel: string
  genderLabel: string
  allergiesLabel: string
  emergencyContactLabel: string
  photoConsentLabel: string
  enrollmentStatus: EnrollmentRowStatus
  departmentId: string | null
  departmentName: string
  programId: string | null
  programName: string
  programKind: "academic" | "seasonal"
  offeringId: string | null
  offeringName: string
  offeringActivity: OfferingActivityStatus
}
