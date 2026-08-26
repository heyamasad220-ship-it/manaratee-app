import {
  displayEnrollmentStatus,
  type DisplayEnrollmentStatus,
} from "@/lib/programs/enrollment-process"

export type EnrollmentSummaryOfferingInput = {
  id: string
  name: string
  teacherName: string | null
  capacity: number | null
  capacityMode: string | null
}

export type EnrollmentSummaryEnrollmentInput = {
  offeringId: string | null
  status: string | null
  registeredAt: string | null
}

export type EnrollmentByOfferingRow = {
  offeringId: string
  offeringName: string
  teacherName: string | null
  capacity: number | null
  enrolled: number
  waitlisted: number
  cancelled: number
  available: number | null
}

export type EnrollmentTrendRow = {
  monthKey: string
  label: string
  registered: number
}

export type EnrollmentSummaryTotals = {
  enrolled: number
  waitlisted: number
  cancelled: number
  pending: number
  offerings: number
  availableSeats: number | null
}

function offeringHasCapacity(offering: EnrollmentSummaryOfferingInput) {
  return (
    String(offering.capacityMode || "").toLowerCase() === "limited" &&
    Number(offering.capacity || 0) > 0
  )
}

export function buildEnrollmentByOffering(
  offerings: EnrollmentSummaryOfferingInput[],
  enrollments: EnrollmentSummaryEnrollmentInput[]
): { rows: EnrollmentByOfferingRow[]; hasCapacity: boolean } {
  const counts = new Map<
    string,
    { enrolled: number; waitlisted: number; cancelled: number }
  >()

  for (const enrollment of enrollments) {
    const offeringId = enrollment.offeringId
    if (!offeringId) continue
    const display = displayEnrollmentStatus(enrollment.status)
    const current = counts.get(offeringId) || {
      enrolled: 0,
      waitlisted: 0,
      cancelled: 0,
    }
    if (display === "active") current.enrolled += 1
    else if (display === "waitlisted") current.waitlisted += 1
    else if (display === "cancelled" || display === "withdrawn") {
      current.cancelled += 1
    }
    counts.set(offeringId, current)
  }

  const offeringIds = new Set([
    ...offerings.map((offering) => offering.id),
    ...counts.keys(),
  ])
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]))

  const rows: EnrollmentByOfferingRow[] = [...offeringIds]
    .map((offeringId) => {
      const offering = offeringById.get(offeringId)
      const tally = counts.get(offeringId) || {
        enrolled: 0,
        waitlisted: 0,
        cancelled: 0,
      }
      const limited = offering ? offeringHasCapacity(offering) : false
      const capacity = limited ? Number(offering?.capacity || 0) : null
      return {
        offeringId,
        offeringName: offering?.name || "Offering",
        teacherName: offering?.teacherName || null,
        capacity,
        enrolled: tally.enrolled,
        waitlisted: tally.waitlisted,
        cancelled: tally.cancelled,
        available:
          capacity != null ? Math.max(capacity - tally.enrolled, 0) : null,
      }
    })
    .sort((a, b) => a.offeringName.localeCompare(b.offeringName))

  return {
    rows,
    hasCapacity: rows.some((row) => row.capacity != null),
  }
}

export function buildEnrollmentSummaryTotals(
  enrollments: EnrollmentSummaryEnrollmentInput[],
  offeringCount: number,
  byOffering: EnrollmentByOfferingRow[],
  hasCapacity: boolean
): EnrollmentSummaryTotals {
  let enrolled = 0
  let waitlisted = 0
  let cancelled = 0
  let pending = 0
  for (const enrollment of enrollments) {
    const display = displayEnrollmentStatus(enrollment.status)
    if (display === "active") enrolled += 1
    else if (display === "waitlisted") waitlisted += 1
    else if (display === "cancelled" || display === "withdrawn") cancelled += 1
    else if (display === "pending") pending += 1
  }

  const availableSeats = hasCapacity
    ? byOffering.reduce((sum, row) => sum + (row.available || 0), 0)
    : null

  return {
    enrolled,
    waitlisted,
    cancelled,
    pending,
    offerings: offeringCount,
    availableSeats,
  }
}

export function buildRegistrationTrends(
  enrollments: EnrollmentSummaryEnrollmentInput[]
): EnrollmentTrendRow[] {
  const byMonth = new Map<string, number>()
  for (const enrollment of enrollments) {
    const raw = enrollment.registeredAt
    if (!raw) continue
    const date = new Date(raw.includes("T") ? raw : `${raw.slice(0, 10)}T00:00:00`)
    if (Number.isNaN(date.getTime())) continue
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + 1)
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, registered]) => {
      const [year, month] = monthKey.split("-").map(Number)
      const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
      return { monthKey, label, registered }
    })
}

export function isLimitedCapacityOffering(offering: {
  capacityMode?: string | null
  capacity?: number | null
}) {
  return (
    String(offering.capacityMode || "").toLowerCase() === "limited" &&
    Number(offering.capacity || 0) > 0
  )
}

export type { DisplayEnrollmentStatus }
