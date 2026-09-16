/** Academic vs seasonal product policy — shared domain, distinct allowed features. */

import {
  normalizeProgramKind,
  type ProgramKind,
} from "@/lib/programs/program-kind"
import type { FeePlanType } from "@/lib/programs/program-fee-plan-types"

/** Org subscription packaging for which program modes are available. */
export type OrganizationProgramKindsEntitlement =
  | "academic"
  | "seasonal"
  | "both"

export type ProgramKindRegistrationOptionId =
  | "full_program"
  | "session"
  | "single_session"
  | "drop_in"

export type ProgramKindTerminology = {
  /** Short product mode name (nav / badges). */
  modeLabel: string
  /** Plural container label (Programs list under a department). */
  containerPlural: string
  /** Singular container (year vs season). */
  containerSingular: string
  /** Sellable units under the container. */
  offeringPlural: string
  offeringSingular: string
  /** Time slices (sessions/weeks) — seasonal-forward. */
  sessionPlural: string
  sessionSingular: string
}

const ACADEMIC_TERMINOLOGY: ProgramKindTerminology = {
  modeLabel: "Academic Programs",
  containerPlural: "Years",
  containerSingular: "Year",
  offeringPlural: "Offerings",
  offeringSingular: "Offering",
  sessionPlural: "Terms",
  sessionSingular: "Term",
}

const SEASONAL_TERMINOLOGY: ProgramKindTerminology = {
  modeLabel: "Seasonal Programs",
  containerPlural: "Seasons",
  containerSingular: "Season",
  offeringPlural: "Offerings",
  offeringSingular: "Offering",
  sessionPlural: "Sessions",
  sessionSingular: "Session",
}

/** Registration option ids allowed for each kind (UI + server). */
export const PROGRAM_KIND_REGISTRATION_OPTIONS: Record<
  ProgramKind,
  readonly ProgramKindRegistrationOptionId[]
> = {
  academic: ["full_program"],
  seasonal: ["full_program", "session", "single_session", "drop_in"],
}

/** Fee plan types allowed for each kind. */
export const PROGRAM_KIND_FEE_PLAN_TYPES: Record<
  ProgramKind,
  readonly FeePlanType[]
> = {
  academic: [
    "free",
    "one_time",
    "deposit_balance",
    "monthly",
    "installments",
  ],
  seasonal: ["free", "one_time", "deposit_balance", "per_session", "installments"],
}

export function getProgramKindTerminology(
  kind: string | null | undefined
): ProgramKindTerminology {
  return normalizeProgramKind(kind) === "seasonal"
    ? SEASONAL_TERMINOLOGY
    : ACADEMIC_TERMINOLOGY
}

export function normalizeOrganizationProgramKinds(
  value: string | null | undefined
): OrganizationProgramKindsEntitlement {
  if (value === "academic" || value === "seasonal") return value
  return "both"
}

export const ORGANIZATION_PROGRAM_KINDS_OPTIONS: Array<{
  value: OrganizationProgramKindsEntitlement
  label: string
  description: string
}> = [
  {
    value: "both",
    label: "Academic and Seasonal",
    description: "Staff can create academic years and seasonal camps/seasons.",
  },
  {
    value: "academic",
    label: "Academic only",
    description: "Year + offerings (courses). Seasonal create paths are hidden.",
  },
  {
    value: "seasonal",
    label: "Seasonal only",
    description: "Camps and seasons. Academic year create paths are hidden.",
  },
]

export function organizationProgramKindToggles(
  entitlement: OrganizationProgramKindsEntitlement
): { academic: boolean; seasonal: boolean } {
  return {
    academic: entitlement !== "seasonal",
    seasonal: entitlement !== "academic",
  }
}

export function organizationProgramKindsFromToggles(
  academic: boolean,
  seasonal: boolean
): OrganizationProgramKindsEntitlement | null {
  if (academic && seasonal) return "both"
  if (academic) return "academic"
  if (seasonal) return "seasonal"
  return null
}

export function organizationAllowsProgramKind(
  entitlement: OrganizationProgramKindsEntitlement,
  kind: ProgramKind
): boolean {
  if (entitlement === "both") return true
  return entitlement === kind
}

export function listAllowedProgramKindsForOrganization(
  entitlement: OrganizationProgramKindsEntitlement
): ProgramKind[] {
  if (entitlement === "academic") return ["academic"]
  if (entitlement === "seasonal") return ["seasonal"]
  return ["academic", "seasonal"]
}

export function isRegistrationOptionAllowedForKind(
  kind: string | null | undefined,
  optionId: ProgramKindRegistrationOptionId
): boolean {
  const normalized = normalizeProgramKind(kind)
  return PROGRAM_KIND_REGISTRATION_OPTIONS[normalized].includes(optionId)
}

export function isFeePlanTypeAllowedForKind(
  kind: string | null | undefined,
  planType: FeePlanType
): boolean {
  const normalized = normalizeProgramKind(kind)
  return PROGRAM_KIND_FEE_PLAN_TYPES[normalized].includes(planType)
}

export function assertRegistrationFlagsAllowedForKind(input: {
  programKind: string | null | undefined
  session_registration_enabled?: boolean
  single_session_registration_enabled?: boolean
  drop_in_registration_enabled?: boolean
}): { ok: true } | { ok: false; error: string } {
  const kind = normalizeProgramKind(input.programKind)
  if (kind === "academic") {
    if (
      input.session_registration_enabled ||
      input.single_session_registration_enabled ||
      input.drop_in_registration_enabled
    ) {
      return {
        ok: false,
        error:
          "Academic programs only support full-program registration. Session, single-session, and drop-in options are for seasonal programs.",
      }
    }
  }
  return { ok: true }
}

export function assertFeePlanTypeAllowedForKind(input: {
  programKind: string | null | undefined
  planType: FeePlanType
}): { ok: true } | { ok: false; error: string } {
  if (isFeePlanTypeAllowedForKind(input.programKind, input.planType)) {
    return { ok: true }
  }
  const kind = normalizeProgramKind(input.programKind)
  if (kind === "seasonal" && input.planType === "monthly") {
    return {
      ok: false,
      error:
        "Monthly tuition plans are for academic programs. Use one-time, deposit, per-session, or installment plans for seasonal programs.",
    }
  }
  if (kind === "academic" && input.planType === "per_session") {
    return {
      ok: false,
      error:
        "Per-session pricing is for seasonal programs. Use monthly or installment plans for academic programs.",
    }
  }
  return {
    ok: false,
    error: `Fee plan type "${input.planType}" is not allowed for ${kind} programs.`,
  }
}

/** Two-semester / academic billing calendar UI — academic only. */
export function allowsAcademicBillingSchedules(
  kind: string | null | undefined
): boolean {
  return normalizeProgramKind(kind) === "academic"
}

/** Camp week packages, day passes, selected-sessions priority — seasonal only. */
export function allowsSeasonalSessionPackages(
  kind: string | null | undefined
): boolean {
  return normalizeProgramKind(kind) === "seasonal"
}
