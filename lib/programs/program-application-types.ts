/**
 * Program registration applications (pipeline apply → approve).
 * @see docs/programs-registration-pipeline-design.md
 */

export type ProgramApplicantType = "returning" | "new"
export type ProgramApplicationStatus =
  | "submitted"
  | "approved"
  | "not_approved"
  | "withdrawn"
export type ProgramApplicationSource = "customer" | "staff"

export const PROGRAM_APPLICATION_STATUS_LABELS: Record<
  ProgramApplicationStatus,
  string
> = {
  submitted: "Pending evaluation",
  approved: "Approved",
  not_approved: "Not approved",
  withdrawn: "Withdrawn",
}

export const PROGRAM_APPLICANT_TYPE_LABELS: Record<
  ProgramApplicantType,
  string
> = {
  returning: "Returning",
  new: "New",
}

export type ProgramApplication = {
  id: string
  organization_id: string
  program_id: string
  offering_id: string
  approved_offering_id: string | null
  registrant_contact_id: string | null
  participant_contact_id: string | null
  participant_name: string
  applicant_type: ProgramApplicantType
  status: ProgramApplicationStatus
  source: ProgramApplicationSource
  evaluation_notes: string | null
  evaluated_at: string | null
  evaluated_by_user_id: string | null
  enrollment_id: string | null
  waitlist_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export type ProgramApplicationWithDetails = ProgramApplication & {
  program_name?: string
  offering_name?: string
  approved_offering_name?: string | null
}
