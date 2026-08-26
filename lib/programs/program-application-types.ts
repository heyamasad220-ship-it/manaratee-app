/**
 * Program registration applications (pipeline apply → approve).
 * @see docs/programs-registration-pipeline-design.md
 */

export type ProgramApplicantType = "returning" | "new"
export type ProgramApplicationStatus =
  | "draft"
  | "submitted"
  | "evaluation_required"
  | "evaluation_scheduled"
  | "evaluation_completed"
  | "approved"
  | "waitlisted"
  | "not_approved"
  | "declined"
  | "withdrawn"
export type ProgramApplicationSource = "customer" | "staff"

export type DepartmentApplicationListFilter =
  | "all"
  | "submitted"
  | "needs_review"
  | "evaluation"
  | "approved"
  | "approved_pending_registration"
  | "waitlisted"
  | "declined"
  | "withdrawn"

export type ApplicationStatusChip =
  | "all"
  | "needs_review"
  | "evaluation"
  | "approved"
  | "waitlisted"
  | "declined"
  | "withdrawn"

/** New-student prior learning path. */
export type ProgramApplicationPriorBackground =
  | "starting_from_scratch"
  | "moving_from_another_center"

/** Preferred payment plan once approved / registering. */
export type ProgramApplicationPaymentPreference =
  | "full"
  | "two_payments"
  | "monthly"

/** Structured answers on program_applications.application_answers (JSONB). */
export type ProgramApplicationAnswers = {
  previous_courses?: string | null
  previous_certificates?: string | null
  prior_background?: ProgramApplicationPriorBackground | null
  prior_center_name?: string | null
  needs_babysitter?: boolean | null
  payment_preference?: ProgramApplicationPaymentPreference | null
  /** All courses requested; `program_applications.offering_id` stores the primary. */
  requested_offering_ids?: string[] | null
}

export const PROGRAM_APPLICATION_STATUS_LABELS: Record<
  ProgramApplicationStatus,
  string
> = {
  draft: "Draft",
  submitted: "Pending",
  evaluation_required: "Evaluation Required",
  evaluation_scheduled: "Evaluation Scheduled",
  evaluation_completed: "Evaluation Completed",
  approved: "Approved",
  waitlisted: "Waitlisted",
  not_approved: "Declined",
  declined: "Declined",
  withdrawn: "Withdrawn",
}

export const EVALUATION_APPLICATION_STATUSES: ProgramApplicationStatus[] = [
  "evaluation_required",
  "evaluation_scheduled",
  "evaluation_completed",
]

export const DECLINED_APPLICATION_STATUSES: ProgramApplicationStatus[] = [
  "not_approved",
  "declined",
]

/** Applicant or staff cancelled before registration. */
export const WITHDRAWABLE_APPLICATION_STATUSES: ProgramApplicationStatus[] = [
  "submitted",
  "evaluation_required",
  "evaluation_scheduled",
  "evaluation_completed",
  "approved",
  "waitlisted",
]

export function canWithdrawProgramApplication(application: {
  status?: string | null
  enrollment_id?: string | null
}): boolean {
  if (application.enrollment_id) return false
  return WITHDRAWABLE_APPLICATION_STATUSES.includes(
    (application.status || "").toLowerCase() as ProgramApplicationStatus
  )
}

export function withdrawProgramApplicationBlockReason(application: {
  status?: string | null
  enrollment_id?: string | null
}): string | null {
  if (canWithdrawProgramApplication(application)) return null
  if (application.enrollment_id) {
    return "This applicant already registered. Withdraw the enrollment from Registrations."
  }
  const status = (application.status || "").toLowerCase()
  if (status === "withdrawn") {
    return "This application is already withdrawn."
  }
  if (status === "not_approved" || status === "declined") {
    return "Declined applications cannot be withdrawn."
  }
  return "This application cannot be withdrawn."
}

export const EVALUATION_QUEUE_STATUSES: ProgramApplicationStatus[] = [
  "submitted",
  ...EVALUATION_APPLICATION_STATUSES,
]

export function isEvaluationQueueChip(
  chip: ApplicationStatusChip | string
): boolean {
  return chip === "evaluation" || chip === "needs_review"
}

export function applicationStatusChipFor(
  status: ProgramApplicationStatus | string
): ApplicationStatusChip | null {
  if (
    status === "submitted" ||
    status === "evaluation_required" ||
    status === "evaluation_scheduled" ||
    status === "evaluation_completed"
  ) {
    return "evaluation"
  }
  if (status === "approved") return "approved"
  if (status === "waitlisted") return "waitlisted"
  if (status === "not_approved" || status === "declined") return "declined"
  if (status === "withdrawn") return "withdrawn"
  return null
}

export const PROGRAM_APPLICANT_TYPE_LABELS: Record<
  ProgramApplicantType,
  string
> = {
  returning: "Returning",
  new: "New",
}

export const PROGRAM_APPLICATION_PRIOR_BACKGROUND_LABELS: Record<
  ProgramApplicationPriorBackground,
  string
> = {
  starting_from_scratch: "Starting from scratch",
  moving_from_another_center: "Moving from another centre",
}

export const PROGRAM_APPLICATION_PAYMENT_PREFERENCE_LABELS: Record<
  ProgramApplicationPaymentPreference,
  string
> = {
  full: "Full payment",
  two_payments: "Two payments (one per semester)",
  monthly: "Monthly payment",
}

export const EMPTY_PROGRAM_APPLICATION_ANSWERS: ProgramApplicationAnswers = {
  previous_courses: null,
  previous_certificates: null,
  prior_background: null,
  prior_center_name: null,
  needs_babysitter: null,
  payment_preference: null,
  requested_offering_ids: null,
}

export function normalizeProgramApplicationAnswers(
  value: unknown
): ProgramApplicationAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_PROGRAM_APPLICATION_ANSWERS }
  }
  const row = value as Record<string, unknown>
  const prior = row.prior_background
  const payment = row.payment_preference
  const requested = Array.isArray(row.requested_offering_ids)
    ? row.requested_offering_ids
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    : null
  return {
    previous_courses:
      typeof row.previous_courses === "string" ? row.previous_courses : null,
    previous_certificates:
      typeof row.previous_certificates === "string"
        ? row.previous_certificates
        : null,
    prior_background:
      prior === "starting_from_scratch" ||
      prior === "moving_from_another_center"
        ? prior
        : null,
    prior_center_name:
      typeof row.prior_center_name === "string" ? row.prior_center_name : null,
    needs_babysitter:
      typeof row.needs_babysitter === "boolean" ? row.needs_babysitter : null,
    payment_preference:
      payment === "full" ||
      payment === "two_payments" ||
      payment === "monthly"
        ? payment
        : null,
    requested_offering_ids: requested && requested.length > 0 ? requested : null,
  }
}

/** Resolve selected course IDs from answers + primary offering_id. */
export function resolveRequestedOfferingIds(
  primaryOfferingId: string | null | undefined,
  answers: ProgramApplicationAnswers | null | undefined
): string[] {
  const fromAnswers = answers?.requested_offering_ids || []
  if (fromAnswers.length > 0) {
    const primary = (primaryOfferingId || "").trim()
    if (primary && !fromAnswers.includes(primary)) {
      return [primary, ...fromAnswers]
    }
    return [...fromAnswers]
  }
  const primary = (primaryOfferingId || "").trim()
  return primary ? [primary] : []
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
  application_answers: ProgramApplicationAnswers
  evaluation_notes: string | null
  evaluated_at: string | null
  evaluated_by_user_id: string | null
  enrollment_id: string | null
  waitlist_id: string | null
  created_by_user_id: string | null
  updated_by_user_id: string | null
  created_at: string
  updated_at: string
}

export type ProgramApplicationWithDetails = ProgramApplication & {
  program_name?: string
  offering_name?: string
  approved_offering_name?: string | null
  /** Staff who last saved/evaluated — for Last Updated column. */
  updated_by_name?: string | null
  /** Staff who approved / not-approved — preferred when present. */
  evaluated_by_name?: string | null
}
