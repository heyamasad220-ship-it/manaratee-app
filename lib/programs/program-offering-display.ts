import { resolveEffectiveOfferingDates } from "./program-offering-inherit"
import type { ProgramOffering, ProgramOfferingStatus } from "./program-offering-types"
import type { Program } from "./program-types"

function dateOnly(value?: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

function todayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function isOfferingEnrollmentOpen(
  offering: Pick<
    ProgramOffering,
    "enrollment_open_date" | "enrollment_close_date"
  >,
  programFallback?: {
    enrollment_open_date?: string | null
    enrollment_close_date?: string | null
  }
) {
  const openDate = dateOnly(
    offering.enrollment_open_date ?? programFallback?.enrollment_open_date
  )
  const closeDate = dateOnly(
    offering.enrollment_close_date ?? programFallback?.enrollment_close_date
  )
  const today = todayDateOnly()

  if (!openDate && !closeDate) return true
  if (openDate && today < openDate) return false
  if (closeDate && today > closeDate) return false

  return true
}

/** Enrollment window using F1 inherit_dates resolution. */
export function isOfferingEnrollmentOpenForProgram(
  offering: ProgramOffering,
  program: Pick<
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
  >
) {
  const dates = resolveEffectiveOfferingDates(offering, program)
  return isOfferingEnrollmentOpen({
    enrollment_open_date: dates.enrollment_open_date,
    enrollment_close_date: dates.enrollment_close_date,
  })
}

export function isLegacyDefaultOfferingName(name: string) {
  return /default offering/i.test(name.trim())
}

export function isOfferingVisibleToCustomers(status: ProgramOfferingStatus) {
  return status === "active" || status === "closed"
}

export function isOfferingCurrentlyActive(
  offering: {
    status: string
    start_date?: string | null
    end_date?: string | null
    enrollment_open_date?: string | null
    enrollment_close_date?: string | null
    inherit_dates?: boolean | null
  },
  program?: Parameters<typeof resolveEffectiveOfferingDates>[1] | null
): boolean {
  if (String(offering.status || "").toLowerCase() !== "active") {
    return false
  }

  const dates = program
    ? resolveEffectiveOfferingDates(offering, program)
    : {
        start_date: offering.start_date ?? null,
        end_date: offering.end_date ?? null,
      }

  const end = dateOnly(dates.end_date)
  const today = todayDateOnly()
  if (end && today > end) {
    return false
  }

  return true
}

export function formatOfferingDateRange(
  startDate?: string | null,
  endDate?: string | null
) {
  const format = (value?: string | null) => {
    if (!value) return "TBD"
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return `${format(startDate)} – ${format(endDate)}`
}
