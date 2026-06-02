export type ProgramOfferingType =
  | "standard"
  | "academic_year"
  | "summer"
  | "season"
  | "recurring"

export type ProgramOfferingStatus = "draft" | "active" | "closed" | "archived"

export interface ProgramOffering {
  id: string
  organization_id: string
  program_id: string
  name: string
  is_default: boolean
  offering_type: ProgramOfferingType
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  status: ProgramOfferingStatus
  created_at: string
  updated_at: string
}
