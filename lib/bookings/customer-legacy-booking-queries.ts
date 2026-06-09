import { createClient } from "@/lib/supabase/server"

import type { LegacyVenueBookingRow } from "./customer-venue-rental-experience"

export async function getCustomerLegacyVenueBookings(
  organizationId: string,
  userId: string
): Promise<LegacyVenueBookingRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("venue_bookings")
    .select(`
      id,
      event_type,
      event_date,
      start_time,
      end_time,
      status,
      total_amount,
      balance_due,
      venues ( name )
    `)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    return []
  }

  return (data || []).map((row) => {
    const venue = row.venues as { name: string } | { name: string }[] | null
    const venueName = Array.isArray(venue) ? venue[0]?.name : venue?.name

    return {
      id: row.id as string,
      event_type: row.event_type as string | null,
      event_date: row.event_date as string | null,
      start_time: row.start_time as string | null,
      end_time: row.end_time as string | null,
      status: row.status as string | null,
      total_amount: row.total_amount as number | null,
      balance_due: row.balance_due as number | null,
      venueName: venueName ?? null,
    }
  })
}
