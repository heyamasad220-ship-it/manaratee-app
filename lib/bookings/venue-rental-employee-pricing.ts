"use server"

import {
  applyPercentOff,
  contactIsActiveFullTimeEmployee,
  getOrganizationEmployeeBenefitPolicy,
} from "@/lib/benefits/employee-benefit"
import { getContactBestAutoApplyTagDiscount } from "@/lib/discount-tags/discount-tag-benefits"
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
 * Suggest venue rental payment amounts with the best applicable discount
 * (FTE employee benefit or auto-apply discount tag) on space fees.
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

  const policy = await getOrganizationEmployeeBenefitPolicy(
    organizationId,
    supabase
  )

  let bestPercent = 0
  let bestLabel: string | null = null

  const fteEligible =
    Boolean(policy?.enabled && policy.appliesToVenueRentals) &&
    (await contactIsActiveFullTimeEmployee(contactId, organizationId, supabase))

  if (fteEligible && policy) {
    bestPercent = policy.percentOff
    bestLabel = `Full-time employee benefit (${policy.percentOff}% off space fees)`
  }

  const tagDiscount = await getContactBestAutoApplyTagDiscount(
    contactId,
    "venue_rentals",
    organizationId,
    supabase
  )

  if (tagDiscount && tagDiscount.percentOff > bestPercent) {
    bestPercent = tagDiscount.percentOff
    bestLabel = `${tagDiscount.tagName} (${tagDiscount.percentOff}% off space fees)`
  }

  if (!(bestPercent > 0) || !bestLabel) {
    return {
      ...empty,
      percentOff: policy?.percentOff ?? empty.percentOff,
    }
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

  const { data: dayPricing } = venueIds.length
    ? await supabase
        .from("rental_space_pricing")
        .select("venue_id, day_of_week, hourly_price, is_active")
        .eq("organization_id", organizationId)
        .in("venue_id", venueIds)
        .eq("is_active", true)
    : { data: [] as Array<{ venue_id: string; day_of_week: number; hourly_price: number }> }

  const legacyRateByVenue = new Map(
    (venues || []).map((venue) => [
      venue.id as string,
      Number(venue.hourly_rate || venue.peak_hourly_rate || 0),
    ])
  )

  const dayRateByVenue = new Map<string, Map<number, number>>()
  for (const row of dayPricing || []) {
    const venueId = row.venue_id as string
    const byDay = dayRateByVenue.get(venueId) || new Map<number, number>()
    byDay.set(Number(row.day_of_week), Number(row.hourly_price || 0))
    dayRateByVenue.set(venueId, byDay)
  }

  let hours = 0
  let baseSpaceFee = 0
  for (const reservation of reservations || []) {
    const slotHours = hoursBetween(
      reservation.start_at as string,
      reservation.end_at as string
    )
    hours += slotHours
    const dayOfWeek = new Date(reservation.start_at as string).getDay()
    const dayRate = dayRateByVenue
      .get(reservation.venue_id as string)
      ?.get(dayOfWeek)
    const rate =
      dayRate != null && dayRate > 0
        ? dayRate
        : legacyRateByVenue.get(reservation.venue_id as string) || 0
    baseSpaceFee += slotHours * rate
  }

  baseSpaceFee = Math.round(baseSpaceFee * 100) / 100
  hours = Math.round(hours * 100) / 100

  const priced = applyPercentOff(baseSpaceFee, bestPercent)
  const suggestedDeposit =
    Math.round(Math.min(priced.total, Math.max(priced.total * 0.25, 0)) * 100) /
    100
  const suggestedRemainingBalance =
    Math.round(Math.max(priced.total - suggestedDeposit, 0) * 100) / 100

  return {
    eligible: true,
    percentOff: bestPercent,
    baseSpaceFee: priced.base,
    discountedSpaceFee: priced.total,
    discountAmount: priced.discount,
    suggestedDeposit,
    suggestedRemainingBalance,
    suggestedSecurityDeposit: 250,
    hours,
    label: bestLabel,
  }
}
