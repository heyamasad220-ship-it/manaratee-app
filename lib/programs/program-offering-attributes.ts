/**
 * Offering-level operational attributes (S1+).
 * Program remains identity + optional defaults; offerings hold audience/capacity/etc.
 */

export type OfferingAudienceType = "adult" | "youth"
/** Program-level audience default (S5: adult/youth only; family normalized to youth). */
export type ProgramAudienceType = "adult" | "youth"

export type OfferingCapacityMode = "unlimited" | "limited"
export type OfferingRegistrationMode = "required" | "optional" | "none"
export type OfferingDeliveryFormat = "in_person" | "online" | "hybrid"

export type ProgramOfferingAttributes = {
  audience_type: OfferingAudienceType
  min_age: number | null
  max_age: number | null
  min_grade: string | null
  max_grade: string | null
  grade_levels: string[]
  gender: string | null
  require_guardian: boolean
  require_grade: boolean
  require_emergency_contact: boolean
  capacity_mode: OfferingCapacityMode
  capacity: number | null
  enable_waitlist: boolean
  waitlist_capacity: number | null
  waitlist_offer_deadline_days: number | null
  /**
   * When false, partial selected weeks go to waitlist so full Camp 1/Camp 2
   * packages get priority. When true, selected weeks may take remaining seats.
   */
  selected_sessions_open: boolean
  registration_mode: OfferingRegistrationMode
  /**
   * When true (default), customers Apply and await approval before Register.
   * When false, they Register & pay immediately (no approval queue).
   */
  application_required: boolean
  attendance_tracked: boolean
  /** F4: show childcare admin tools for this offering. */
  care_enabled: boolean
  delivery_format: OfferingDeliveryFormat
}

/** Program row fields used to seed offering attributes. */
export type ProgramAttributeSource = {
  program_type?: string | null
  min_age?: number | null
  max_age?: number | null
  min_grade?: string | null
  max_grade?: string | null
  grade_levels?: string[] | null
  gender?: string | null
  require_guardian?: boolean | null
  require_grade?: boolean | null
  require_emergency_contact?: boolean | null
  capacity?: number | null
  enable_waitlist?: boolean | null
  waitlist_capacity?: number | null
  waitlist_offer_deadline_days?: number | null
  full_program_registration_enabled?: boolean | null
  session_registration_enabled?: boolean | null
}

export const OFFERING_ATTRIBUTE_COLUMNS = [
  "audience_type",
  "min_age",
  "max_age",
  "min_grade",
  "max_grade",
  "grade_levels",
  "gender",
  "require_guardian",
  "require_grade",
  "require_emergency_contact",
  "capacity_mode",
  "capacity",
  "enable_waitlist",
  "waitlist_capacity",
  "waitlist_offer_deadline_days",
  "selected_sessions_open",
  "registration_mode",
  "application_required",
  "attendance_tracked",
  "care_enabled",
  "delivery_format",
] as const

export function mapProgramAudienceType(
  programType: string | null | undefined
): OfferingAudienceType {
  return programType === "adult" ? "adult" : "youth"
}

/** Normalize legacy `family` (and unknown) to adult | youth for writes. */
export function normalizeProgramAudienceType(
  programType: string | null | undefined
): ProgramAudienceType {
  return programType === "adult" ? "adult" : "youth"
}

export function deriveCapacityMode(
  capacity: number | null | undefined
): OfferingCapacityMode {
  return Number(capacity ?? 0) > 0 ? "limited" : "unlimited"
}

export function deriveRegistrationMode(flags: {
  fullProgramEnabled?: boolean | null
  sessionRegistrationEnabled?: boolean | null
}): OfferingRegistrationMode {
  if (flags.fullProgramEnabled || flags.sessionRegistrationEnabled) {
    return "required"
  }
  return "none"
}

export function attributesFromProgramRow(
  program: ProgramAttributeSource
): ProgramOfferingAttributes {
  const capacityMode = deriveCapacityMode(program.capacity)
  const capacity =
    capacityMode === "limited" ? Math.max(0, Number(program.capacity || 0)) : null

  return {
    audience_type: mapProgramAudienceType(program.program_type),
    min_age: program.min_age ?? null,
    max_age: program.max_age ?? null,
    min_grade: program.min_grade ?? null,
    max_grade: program.max_grade ?? null,
    grade_levels: Array.isArray(program.grade_levels) ? program.grade_levels : [],
    gender: program.gender ?? null,
    require_guardian: program.require_guardian ?? false,
    require_grade: program.require_grade ?? false,
    require_emergency_contact: program.require_emergency_contact ?? true,
    capacity_mode: capacityMode,
    capacity,
    enable_waitlist: program.enable_waitlist ?? false,
    waitlist_capacity: program.waitlist_capacity ?? null,
    waitlist_offer_deadline_days: program.waitlist_offer_deadline_days ?? null,
    selected_sessions_open: true,
    registration_mode: deriveRegistrationMode({
      fullProgramEnabled: program.full_program_registration_enabled,
      sessionRegistrationEnabled: program.session_registration_enabled,
    }),
    application_required: true,
    attendance_tracked: false,
    care_enabled: false,
    delivery_format: "in_person",
  }
}

/** Pick attribute fields from an offering row (e.g. duplicate / year copy). */
export function attributesFromOfferingRow(
  row: Partial<ProgramOfferingAttributes> & Record<string, unknown>
): ProgramOfferingAttributes {
  const capacityMode =
    (row.capacity_mode as OfferingCapacityMode | undefined) ??
    deriveCapacityMode(row.capacity as number | null | undefined)

  return {
    audience_type:
      (row.audience_type as OfferingAudienceType | undefined) ?? "youth",
    min_age: (row.min_age as number | null | undefined) ?? null,
    max_age: (row.max_age as number | null | undefined) ?? null,
    min_grade: (row.min_grade as string | null | undefined) ?? null,
    max_grade: (row.max_grade as string | null | undefined) ?? null,
    grade_levels: Array.isArray(row.grade_levels)
      ? (row.grade_levels as string[])
      : [],
    gender: (row.gender as string | null | undefined) ?? null,
    require_guardian: Boolean(row.require_guardian),
    require_grade: Boolean(row.require_grade),
    require_emergency_contact:
      row.require_emergency_contact === undefined
        ? true
        : Boolean(row.require_emergency_contact),
    capacity_mode: capacityMode,
    capacity:
      capacityMode === "limited"
        ? Math.max(0, Number(row.capacity ?? 0))
        : null,
    enable_waitlist: Boolean(row.enable_waitlist),
    waitlist_capacity: (row.waitlist_capacity as number | null | undefined) ?? null,
    waitlist_offer_deadline_days:
      (row.waitlist_offer_deadline_days as number | null | undefined) ?? null,
    selected_sessions_open: row.selected_sessions_open !== false,
    registration_mode:
      (row.registration_mode as OfferingRegistrationMode | undefined) ??
      "required",
    application_required: row.application_required !== false,
    attendance_tracked: Boolean(row.attendance_tracked),
    care_enabled: Boolean(row.care_enabled),
    delivery_format:
      (row.delivery_format as OfferingDeliveryFormat | undefined) ?? "in_person",
  }
}

export function mergeOfferingAttributes(
  base: ProgramOfferingAttributes,
  override?: Partial<ProgramOfferingAttributes> | null
): ProgramOfferingAttributes {
  if (!override) return base
  return { ...base, ...override }
}
