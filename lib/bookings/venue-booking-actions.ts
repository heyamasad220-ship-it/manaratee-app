"use server"

/**
 * Legacy venue_bookings staff actions.
 * Existing staff booking pages use venue_bookings until Phase B replaces them.
 * New Venue Rental workflow lives in venue-rental-actions.ts (venue_rentals path).
 */

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

async function assertCanManageBookings() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to manage venue bookings.")
  }
}

export async function updateVenueBookingStatus(
  bookingId: string,
  status: "approved" | "rejected" | "cancelled"
) {
  await assertCanManageBookings()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("venue_bookings")
    .update({ status })
    .eq("id", bookingId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to update booking status")
  }

  revalidatePath("/bookings/overview")
  revalidatePath("/bookings/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/calendar")
}
