"use server"

import {
  applyPercentOff,
  contactIsActiveFullTimeEmployee,
  getOrganizationEmployeeBenefitPolicy,
} from "@/lib/benefits/employee-benefit"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export type VenueRentalEmployeePricingSuggestion = {
  eligible: boolean
  percentOff: number
  baseSpaceFee: number
  discountedSpaceFee: number
  discountAmount: number
  suggestedDeposit: number
  suggestedRemainingBalance: number
  suggestedSecurityDeposit: number
  hours: number
  label: string | null
}

function hoursBetween(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.max(0, (end - start) / (1000 * 60 * 60))
}

/**
 * Suggest venue rental payment amounts with FTE employee benefit applied
 * to space fees (not security deposit).
 */
export async function getVenueRentalEmployeePricingSuggestion(
  venueRentalId: string
): Promise<VenueRentalEmployeePricingSuggestion> {
  const empty: VenueRentalEmployeePricingSuggestion = {
    eligible: false,
    percentOff: 50,
    baseSpaceFee: 0,
    discountedSpaceFee: 0,
    discountAmount: 0,
    suggestedDeposit: 0,
    suggestedRemainingBalance: 0,
    suggestedSecurityDeposit: 250,
    hours: 0,
    label: null,
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !venueRentalId) return empty

  const supabase = await createClient()
  const policy = await getOrganizationEmployeeBenefitPolicy(
    organizationId,
    supabase
  )

  if (!policy?.enabled || !policy.appliesToVenueRentals) {
    return empty
  }

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("id, billing_contact_id, customer_user_id")
    .eq("organization_id", organizationId)
    .eq("id", venueRentalId)
    .maybeSingle()

  if (!rental) return empty

  let contactId = (rental.billing_contact_id as string | null) || null
  if (!contactId && rental.customer_user_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("auth_user_id", rental.customer_user_id)
      .maybeSingle()
    contactId = (contact?.id as string | undefined) || null
  }

  const eligible = await contactIsActiveFullTimeEmployee(
    contactId,
    organizationId,
    supabase
  )
  if (!eligible) {
    return { ...empty, percentOff: policy.percentOff }
  }

  const { data: reservations } = await supabase
    .from("rental_reservations")
    .select("venue_id, start_at, end_at")
    .eq("organization_id", organizationId)
    .eq("venue_rental_id", venueRentalId)

  const venueIds = [
    ...new Set((reservations || []).map((row) => row.venue_id as string)),
  ]
  const { data: venues } = venueIds.length
    ? await supabase
        .from("venues")
        .select("id, hourly_rate, peak_hourly_rate")
        .eq("organization_id", organizationId)
        .in("id", venueIds)
    : { data: [] as { id: string; hourly_rate: number; peak_hourly_rate: number }[] }

  const rateByVenue = new Map(
    (venues || []).map((venue) => [
      venue.id as string,
      Number(venue.hourly_rate || venue.peak_hourly_rate || 0),
    ])
  )

  let hours = 0
  let baseSpaceFee = 0
  for (const reservation of reservations || []) {
    const slotHours = hoursBetween(
      reservation.start_at as string,
      reservation.end_at as string
    )
    hours += slotHours
    const rate = rateByVenue.get(reservation.venue_id as string) || 0
    baseSpaceFee += slotHours * rate
  }

  baseSpaceFee = Math.round(baseSpaceFee * 100) / 100
  hours = Math.round(hours * 100) / 100

  const priced = applyPercentOff(baseSpaceFee, policy.percentOff)
  const suggestedDeposit =
    Math.round(Math.min(priced.total, Math.max(priced.total * 0.25, 0)) * 100) /
    100
  const suggestedRemainingBalance =
    Math.round(Math.max(priced.total - suggestedDeposit, 0) * 100) / 100

  return {
    eligible: true,
    percentOff: policy.percentOff,
    baseSpaceFee: priced.base,
    discountedSpaceFee: priced.total,
    discountAmount: priced.discount,
    suggestedDeposit,
    suggestedRemainingBalance,
    suggestedSecurityDeposit: 250,
    hours,
    label: `Full-time employee benefit (${policy.percentOff}% off space fees)`,
  }
}
