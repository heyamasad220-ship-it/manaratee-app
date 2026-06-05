export type ProgramStaffAssignmentRole =
  | "primary_instructor"
  | "assistant_instructor"
  | "substitute"
  | "volunteer"
  | "coordinator"

export interface ProgramStaffAssignment {
  id: string
  organization_id: string
  contact_id: string
  program_id: string
  offering_id: string
  session_id: string | null
  assignment_role: ProgramStaffAssignmentRole
  start_date: string | null
  end_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProgramStaffAssignmentWithDetails extends ProgramStaffAssignment {
  contact_name: string
  contact_email: string | null
  program_name: string
  offering_name: string
  session_name: string | null
}

export const PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS: Record<
  ProgramStaffAssignmentRole,
  string
> = {
  primary_instructor: "Primary Instructor",
  assistant_instructor: "Assistant Instructor",
  substitute: "Substitute",
  volunteer: "Volunteer",
  coordinator: "Coordinator",
}

export const OFFERING_STAFF_ROLE_OPTIONS: ProgramStaffAssignmentRole[] = [
  "primary_instructor",
  "assistant_instructor",
  "substitute",
  "volunteer",
  "coordinator",
]
