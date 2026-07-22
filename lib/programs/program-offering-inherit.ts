/**
 * F1: Resolve effective offering dates / eligibility / enrollment from
 * program defaults when inherit_* flags are true.
 *
 * @see docs/programs-flexibility-contract.md
 */

import {
  mapProgramAudienceType,
  type OfferingAudienceType,
  type OfferingRegistrationMode,
} from "@/lib/programs/program-offering-attributes"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { Program } from "@/lib/programs/program-types"

export type OfferingInheritFlags = {
  inherit_dates: boolean
  inherit_eligibility: boolean
  inherit_enrollment: boolean
}

export const DEFAULT_NEW_OFFERING_INHERIT_FLAGS: OfferingInheritFlags = {
  inherit_dates: true,
  inherit_eligibility: true,
  inherit_enrollment: true,
}

/** Existing rows before F1 / unknown: treat as overridden. */
export const LEGACY_OVERRIDDEN_INHERIT_FLAGS: OfferingInheritFlags = {
  inherit_dates: false,
  inherit_eligibility: false,
  inherit_enrollment: false,
}

export type ProgramDefaultsSource = Pick<
  Program,
  | "start_date"
  | "end_date"
  | "enrollment_open_date"
  | "enrollment_close_date"
  | "program_type"
  | "min_age"
  | "max_age"
  | "min_grade"
  | "max_grade"
  | "grade_levels"
  | "gender"
  | "require_guardian"
  | "require_grade"
  | "require_emergency_contact"
  | "enable_waitlist"
  | "waitlist_capacity"
  | "waitlist_offer_deadline_days"
> & {
  full_program_registration_enabled?: boolean | null
  session_registration_enabled?: boolean | null
}

export type OfferingInheritSource = Partial<OfferingInheritFlags> &
  Pick<
    ProgramOffering,
    | "start_date"
    | "end_date"
    | "enrollment_open_date"
    | "enrollment_close_date"
    | "audience_type"
    | "min_age"
    | "max_age"
    | "min_grade"
    | "max_grade"
    | "grade_levels"
    | "gender"
    | "require_guardian"
    | "require_grade"
    | "require_emergency_contact"
    | "enable_waitlist"
    | "waitlist_capacity"
    | "waitlist_offer_deadline_days"
    | "registration_mode"
  >

export function readOfferingInheritFlags(
  offering: Partial<OfferingInheritFlags> | null | undefined
): OfferingInheritFlags {
  if (!offering) return { ...LEGACY_OVERRIDDEN_INHERIT_FLAGS }
  return {
    inherit_dates: offering.inherit_dates ?? false,
    inherit_eligibility: offering.inherit_eligibility ?? false,
    inherit_enrollment: offering.inherit_enrollment ?? false,
  }
}

export type EffectiveOfferingDates = {
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  inherit_dates: boolean
}

export function resolveEffectiveOfferingDates(
  offering: OfferingInheritSource,
  program: ProgramDefaultsSource
): EffectiveOfferingDates {
  const inherit = readOfferingInheritFlags(offering).inherit_dates
  if (inherit) {
    return {
      start_date: program.start_date ?? null,
      end_date: program.end_date ?? null,
      enrollment_open_date: program.enrollment_open_date ?? null,
      enrollment_close_date: program.enrollment_close_date ?? null,
      inherit_dates: true,
    }
  }
  return {
    start_date: offering.start_date ?? null,
    end_date: offering.end_date ?? null,
    enrollment_open_date: offering.enrollment_open_date ?? null,
    enrollment_close_date: offering.enrollment_close_date ?? null,
    inherit_dates: false,
  }
}

export type EffectiveOfferingEligibility = {
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
  inherit_eligibility: boolean
}

export function resolveEffectiveOfferingEligibility(
  offering: OfferingInheritSource,
  program: ProgramDefaultsSource
): EffectiveOfferingEligibility {
  const inherit = readOfferingInheritFlags(offering).inherit_eligibility
  if (inherit) {
    return {
      audience_type: mapProgramAudienceType(program.program_type),
      min_age: program.min_age ?? null,
      max_age: program.max_age ?? null,
      min_grade: program.min_grade ?? null,
      max_grade: program.max_grade ?? null,
      grade_levels: Array.isArray(program.grade_levels)
        ? program.grade_levels
        : [],
      gender: program.gender ?? null,
      require_guardian: program.require_guardian ?? false,
      require_grade: program.require_grade ?? false,
      require_emergency_contact:
        program.require_emergency_contact ?? true,
      inherit_eligibility: true,
    }
  }
  return {
    audience_type: offering.audience_type ?? "youth",
    min_age: offering.min_age ?? null,
    max_age: offering.max_age ?? null,
    min_grade: offering.min_grade ?? null,
    max_grade: offering.max_grade ?? null,
    grade_levels: Array.isArray(offering.grade_levels)
      ? offering.grade_levels
      : [],
    gender: offering.gender ?? null,
    require_guardian: Boolean(offering.require_guardian),
    require_grade: Boolean(offering.require_grade),
    require_emergency_contact: Boolean(offering.require_emergency_contact),
    inherit_eligibility: false,
  }
}

export type EffectiveOfferingEnrollment = {
  enable_waitlist: boolean
  waitlist_capacity: number | null
  waitlist_offer_deadline_days: number | null
  registration_mode: OfferingRegistrationMode
  full_program_registration_enabled: boolean
  session_registration_enabled: boolean
  inherit_enrollment: boolean
}

export function resolveEffectiveOfferingEnrollment(
  offering: OfferingInheritSource,
  program: ProgramDefaultsSource
): EffectiveOfferingEnrollment {
  const inherit = readOfferingInheritFlags(offering).inherit_enrollment
  if (inherit) {
    const full = Boolean(program.full_program_registration_enabled)
    const session = Boolean(program.session_registration_enabled)
    return {
      enable_waitlist: program.enable_waitlist ?? false,
      waitlist_capacity: program.waitlist_capacity ?? null,
      waitlist_offer_deadline_days:
        program.waitlist_offer_deadline_days ?? null,
      registration_mode:
        full || session ? "required" : "none",
      full_program_registration_enabled: full,
      session_registration_enabled: session,
      inherit_enrollment: true,
    }
  }
  return {
    enable_waitlist: Boolean(offering.enable_waitlist),
    waitlist_capacity: offering.waitlist_capacity ?? null,
    waitlist_offer_deadline_days:
      offering.waitlist_offer_deadline_days ?? null,
    registration_mode: offering.registration_mode ?? "required",
    full_program_registration_enabled: false,
    session_registration_enabled: false,
    inherit_enrollment: false,
  }
}

/** Merge inherit resolution for registration / enrollment UI reads. */
export function resolveEffectiveOfferingRegistrationSource(
  offering: OfferingInheritSource,
  program: ProgramDefaultsSource
) {
  const dates = resolveEffectiveOfferingDates(offering, program)
  const eligibility = resolveEffectiveOfferingEligibility(offering, program)
  const enrollment = resolveEffectiveOfferingEnrollment(offering, program)
  const flags = readOfferingInheritFlags(offering)

  return {
    ...flags,
    ...dates,
    ...eligibility,
    enable_waitlist: enrollment.enable_waitlist,
    waitlist_capacity: enrollment.waitlist_capacity,
    waitlist_offer_deadline_days: enrollment.waitlist_offer_deadline_days,
    registration_mode: enrollment.registration_mode,
    full_program_registration_enabled:
      enrollment.full_program_registration_enabled,
    session_registration_enabled: enrollment.session_registration_enabled,
  }
}
