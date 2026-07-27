export interface DiscountTag {
  id: string
  organization_id: string
  name: string
  description: string | null
  active: boolean
  percent_off: number | null
  auto_apply: boolean
  applies_to_programs: boolean
  applies_to_venue_rentals: boolean
  applies_to_ticketing: boolean
  created_at: string
  updated_at: string
}

export type DiscountTagInput = {
  name: string
  description?: string | null
  percentOff?: number | null
  autoApply?: boolean
  appliesToPrograms?: boolean
  appliesToVenueRentals?: boolean
  appliesToTicketing?: boolean
  active?: boolean
}

export type DiscountTagModule = "programs" | "venue_rentals" | "ticketing"
