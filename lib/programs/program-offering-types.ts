import type { ProgramOfferingAttributes } from "@/lib/programs/program-offering-attributes"

export type ProgramOfferingType =
  | "standard"
  | "academic_year"
  | "summer"
  | "season"
  | "recurring"

export type ProgramOfferingStatus = "draft" | "active" | "closed" | "archived"

export interface ProgramOffering extends ProgramOfferingAttributes {
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

export type ProgramOfferingInput = {
  name: string
  offering_type?: ProgramOfferingType
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  status?: ProgramOfferingStatus
  /** When set, used instead of inheriting from the parent program. */
  attributes?: Partial<ProgramOfferingAttributes>
}

export const PROGRAM_OFFERING_STATUS_LABELS: Record<
  ProgramOfferingStatus,
  string
> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  archived: "Archived",
}
