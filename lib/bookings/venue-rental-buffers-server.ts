import { createClient } from "@/lib/supabase/server"
import { getVenueRentalOrgSettings } from "@/lib/bookings/venue-rental-queries"
import {
  clampBufferMinutes,
  type VenueRentalBufferPair,
} from "@/lib/bookings/venue-rental-buffers"

/**
 * Resolve setup/cleanup for venues: venue override → org default → 0.
 * Server-only (uses cookies / Supabase).
 */
export async function resolveVenueRentalBuffersForVenues(
  organizationId: string,
  venueIds: string[]
): Promise<Map<string, VenueRentalBufferPair>> {
  const uniqueIds = Array.from(new Set(venueIds.filter(Boolean)))
  const result = new Map<string, VenueRentalBufferPair>()

  const settings = await getVenueRentalOrgSettings(organizationId)
  const orgSetup = clampBufferMinutes(settings.defaultSetupMinutes)
  const orgCleanup = clampBufferMinutes(settings.defaultCleanupMinutes)

  for (const venueId of uniqueIds) {
    result.set(venueId, {
      setupMinutes: orgSetup,
      cleanupMinutes: orgCleanup,
    })
  }

  if (uniqueIds.length === 0) {
    return result
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("venues")
    .select("id, setup_minutes, cleanup_minutes")
    .eq("organization_id", organizationId)
    .in("id", uniqueIds)

  if (error) {
    // Pre-migration 222: columns missing — keep org defaults only.
    if (
      error.code !== "42703" &&
      error.code !== "PGRST204" &&
      !error.message?.toLowerCase().includes("does not exist")
    ) {
      console.error("[resolveVenueRentalBuffersForVenues]", error)
    }
    return result
  }

  for (const row of data || []) {
    const venueId = row.id as string
    const setup =
      row.setup_minutes == null
        ? orgSetup
        : clampBufferMinutes(row.setup_minutes, orgSetup)
    const cleanup =
      row.cleanup_minutes == null
        ? orgCleanup
        : clampBufferMinutes(row.cleanup_minutes, orgCleanup)
    result.set(venueId, { setupMinutes: setup, cleanupMinutes: cleanup })
  }

  return result
}
