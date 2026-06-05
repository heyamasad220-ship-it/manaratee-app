import type { ProgramOffering, ProgramOfferingStatus } from "./program-offering-types"

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

export function isLegacyDefaultOfferingName(name: string) {
  return /default offering/i.test(name.trim())
}

export function isOfferingVisibleToCustomers(status: ProgramOfferingStatus) {
  return status === "active" || status === "closed"
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
