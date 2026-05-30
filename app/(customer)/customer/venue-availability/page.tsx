import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { CustomerTabs } from "@/components/customer/customer-tabs"
import { CustomerAvailabilityCalendar } from "@/components/customer/customer-availability-calendar"

export default async function CustomerCalendarPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const organizationId = activeOrganization.organization_id

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, description, capacity, status")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("name", { ascending: true })

  const { data: bookings } = await supabase
    .from("venue_bookings")
    .select(`
      id,
      venue_id,
      event_type,
      event_date,
      start_time,
      end_time,
      status,
      guest_count
    `)
    .eq("organization_id", organizationId)
    .in("status", ["pending_review", "approved", "deposit_pending", "deposit_paid", "fully_paid"])

  async function createAvailabilityBooking(formData: FormData) {
    "use server"

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect("/login")
    }

    const { activeOrganization } = await getActiveOrganization()

    if (!activeOrganization) {
      redirect("/customer/venue-availability")
    }

    const venueId = String(formData.get("venue_id") || "")
    const eventDate = String(formData.get("event_date") || "")
    const startTime = String(formData.get("start_time") || "")
    const endTime = String(formData.get("end_time") || "")
    const eventType = String(formData.get("event_type") || "")
    const guestCount = Number(formData.get("guest_count") || 0)
    const notes = String(formData.get("notes") || "")

    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("id", venueId)
      .eq("organization_id", activeOrganization.organization_id)
      .maybeSingle()

    if (!venue) {
      redirect("/customer/venue-availability")
    }

    const { data: conflict } = await supabase
      .from("venue_bookings")
      .select("id")
      .eq("organization_id", activeOrganization.organization_id)
      .eq("venue_id", venueId)
      .eq("event_date", eventDate)
      .in("status", ["pending_review", "approved", "deposit_pending", "deposit_paid", "fully_paid"])
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .maybeSingle()

    if (conflict) {
      redirect("/customer/venue-availability?error=slot-unavailable")
    }

    const { data: booking, error } = await supabase
      .from("venue_bookings")
      .insert({
        organization_id: activeOrganization.organization_id,
        venue_id: venueId,
        user_id: user.id,
        event_type: eventType,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        guest_count: guestCount,
        notes,
        status: "pending_review",
      })
      .select("id")
      .single()

    if (error || !booking) {
      throw new Error("Failed to create booking request")
    }

    revalidatePath("/customer/venue-availability")
    revalidatePath("/customer/bookings")

    redirect(`/customer/bookings/${booking.id}`)
  }

  return (
    <div className="space-y-6">
      <CustomerTabs />

      <CustomerAvailabilityCalendar
        organizationName={activeOrganization.organization_name}
        venues={venues || []}
        bookings={bookings || []}
        createBookingAction={createAvailabilityBooking}
      />
    </div>
  )
}