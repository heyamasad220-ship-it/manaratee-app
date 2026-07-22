import type {
  OfferingDeliveryFormat,
  ProgramOfferingAttributes,
} from "@/lib/programs/program-offering-attributes"

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
  /** F1: when true, term + enrollment window resolve from the program. */
  inherit_dates?: boolean
  /** F1: when true, audience/ages/grades/gender resolve from the program. */
  inherit_eligibility?: boolean
  /** F1: when true, waitlist (+ enrollment-type defaults) resolve from the program. */
  inherit_enrollment?: boolean
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
  /** F1: defaults true for new offerings when omitted. */
  inherit_dates?: boolean
  inherit_eligibility?: boolean
  inherit_enrollment?: boolean
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

export const OFFERING_DELIVERY_FORMAT_LABELS: Record<
  OfferingDeliveryFormat,
  string
> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
}

export const OFFERING_DELIVERY_FORMAT_OPTIONS: Array<{
  value: OfferingDeliveryFormat
  label: string
}> = [
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
]

