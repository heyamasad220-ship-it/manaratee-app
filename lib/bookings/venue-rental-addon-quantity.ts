/**
 * How catalog add-on unit prices scale on a rental request.
 * Inferred from slug/name until an explicit column is added.
 */

export type VenueRentalAddonPricingBasis = "flat" | "per_person" | "per_table"

export function resolveVenueRentalAddonPricingBasis(input: {
  slug?: string | null
  name?: string | null
}): VenueRentalAddonPricingBasis {
  const slug = (input.slug || "").trim().toLowerCase()
  const name = (input.name || "").trim().toLowerCase()

  if (
    slug === "table-covers" ||
    slug === "table-cover" ||
    name === "table covers" ||
    name.startsWith("table cover")
  ) {
    return "per_table"
  }

  if (
    slug === "chair-covers" ||
    slug === "chair-cover" ||
    slug === "plate-chargers" ||
    slug === "plate-charger" ||
    name === "chair covers" ||
    name.startsWith("chair cover") ||
    name === "plate chargers" ||
    name.startsWith("plate charger")
  ) {
    return "per_person"
  }

  return "flat"
}

/** Tables needed = ceil(attendance / chairsPerTable). */
export function computeVenueRentalTableCount(
  expectedAttendance: number,
  chairsPerTable: number
): number {
  const attendance = Math.max(0, Math.floor(Number(expectedAttendance) || 0))
  const chairs = Math.max(1, Math.floor(Number(chairsPerTable) || 0))
  if (attendance <= 0) return 0
  return Math.ceil(attendance / chairs)
}

export function computeVenueRentalAddonQuantity(
  basis: VenueRentalAddonPricingBasis,
  input: { expectedAttendance: number; chairsPerTable: number }
): number {
  const attendance = Math.max(0, Math.floor(Number(input.expectedAttendance) || 0))
  const chairsPerTable = Math.max(1, Math.floor(Number(input.chairsPerTable) || 0))

  if (basis === "per_person") {
    return Math.max(1, attendance)
  }

  if (basis === "per_table") {
    return Math.max(1, computeVenueRentalTableCount(attendance, chairsPerTable))
  }

  return 1
}

export function resolveVenueRentalAddonQuantity(input: {
  slug?: string | null
  name?: string | null
  expectedAttendance: number
  chairsPerTable: number
}): number {
  return computeVenueRentalAddonQuantity(
    resolveVenueRentalAddonPricingBasis(input),
    input
  )
}
