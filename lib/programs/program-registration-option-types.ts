export type ProgramRegistrationOptionType =
  | "full_program"
  | "selected_sessions"
  | "single_session"
  | "drop_in"

export type ParticipantType = "adult" | "youth" | "family" | "group"

export type RegistrantType = "adult_self" | "guardian" | "organization" | "staff"

export type SessionAccessStatus = "active" | "cancelled" | "transferred"

export interface ProgramRegistrationOption {
  id: string
  organization_id: string
  program_id: string
  offering_id: string
  name: string
  option_type: ProgramRegistrationOptionType
  is_active: boolean
  priority_rank: number
  available_from: string | null
  available_until: string | null
  fee_plan_id: string | null
  created_at: string
  updated_at: string
}

export interface ProgramRegistrationSessionAccess {
  id: string
  organization_id: string
  enrollment_id: string
  session_id: string
  access_status: SessionAccessStatus
  created_at: string
  updated_at: string
}

export const REGISTRATION_OPTION_LABELS: Record<ProgramRegistrationOptionType, string> = {
  full_program: "Full Program",
  selected_sessions: "Selected Sessions / Weeks",
  single_session: "Single Session",
  drop_in: "Drop-In",
}
