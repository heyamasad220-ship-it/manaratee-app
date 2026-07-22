import type { Program } from "@/lib/programs/program-types"

export type ProgramType = "adult" | "youth"
export type VisibilityType = "public" | "private" | "members_only"
export type ProgramGender = "All" | "Male" | "Female"

export type ProgramWithExtraFields = Program & {
  visibility?: VisibilityType
  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
  single_session_registration_enabled?: boolean
}
