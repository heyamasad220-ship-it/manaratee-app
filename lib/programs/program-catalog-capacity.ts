/**
 * Catalog / list capacity display (S6).
 * Program card capacity = sum of limited offerings; all unlimited → Unlimited.
 */

export type ProgramCatalogCapacity = {
  /** Sum of capacities for offerings with capacity_mode = limited */
  limitedCapacity: number
  /** True when at least one non-archived offering is limited */
  isLimited: boolean
}

export function summarizeOfferingsCapacity(
  offerings: Array<{
    capacity_mode?: string | null
    capacity?: number | null
  }>
): ProgramCatalogCapacity {
  let limitedCapacity = 0
  let isLimited = false

  for (const offering of offerings) {
    if (offering.capacity_mode !== "limited") continue
    isLimited = true
    limitedCapacity += Math.max(0, Number(offering.capacity || 0))
  }

  return { limitedCapacity, isLimited }
}

/** Dual-read fallback from programs.capacity (S2 sync: 0 means unlimited). */
export function catalogCapacityFromProgramTotal(
  programCapacity: number | null | undefined
): ProgramCatalogCapacity {
  const limitedCapacity = Math.max(0, Number(programCapacity || 0))
  return {
    limitedCapacity,
    isLimited: limitedCapacity > 0,
  }
}

export function formatEnrollmentCapacityLabel(
  enrolled: number,
  capacity: ProgramCatalogCapacity
): string {
  if (!capacity.isLimited) {
    return `${enrolled} / Unlimited`
  }
  return `${enrolled} / ${capacity.limitedCapacity}`
}

export function getCatalogEnrollmentPercent(
  enrolled: number,
  capacity: ProgramCatalogCapacity
): number {
  if (!capacity.isLimited || capacity.limitedCapacity <= 0) return 0
  return Math.min(
    Math.round((enrolled / capacity.limitedCapacity) * 100),
    100
  )
}

/**
 * Enrollment list/overview label.
 * When the offering has sessions, capacity is per session (not unique headcount).
 */
export function formatOfferingEnrollmentLabel(
  enrolled: number,
  offering: {
    capacity_mode?: string | null
    capacity?: number | null
  },
  options?: { capacityAppliesPerSession?: boolean }
): string {
  if (offering.capacity_mode === "limited") {
    const capacity = Math.max(0, Number(offering.capacity || 0))
    if (options?.capacityAppliesPerSession) {
      return `${enrolled} enrolled · up to ${capacity}/session`
    }
    return `${enrolled} / ${capacity}`
  }
  return `${enrolled} / Unlimited`
}

export function formatOfferingPerSessionCapacityHint(offering: {
  capacity_mode?: string | null
  capacity?: number | null
}): string | null {
  if (offering.capacity_mode !== "limited") return null
  const capacity = Math.max(0, Number(offering.capacity || 0))
  if (capacity <= 0) return null
  return `Up to ${capacity} per session`
}

/** Effective seats for a week: session override, else offering capacity when limited. */
export function resolveSessionEffectiveCapacity(
  sessionCapacity: number | null | undefined,
  offering: {
    capacity_mode?: string | null
    capacity?: number | null
  } | null
    | undefined
): number {
  const own = Math.max(0, Number(sessionCapacity || 0))
  if (own > 0) return own
  if (!offering || offering.capacity_mode !== "limited") return 0
  return Math.max(0, Number(offering.capacity || 0))
}

export function getOfferingEnrollmentPercent(
  enrolled: number,
  offering: {
    capacity_mode?: string | null
    capacity?: number | null
  },
  options?: { capacityAppliesPerSession?: boolean }
): number {
  if (offering.capacity_mode !== "limited") return 0
  const capacity = Math.max(0, Number(offering.capacity || 0))
  if (capacity <= 0) return 0
  // Per-session capacity is not comparable to unique offering headcount.
  if (options?.capacityAppliesPerSession) return 0
  return Math.min(Math.round((enrolled / capacity) * 100), 100)
}
