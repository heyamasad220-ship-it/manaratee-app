import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

import { CustomerTabs } from "@/components/customer/customer-tabs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

type PageProps = {
  searchParams?: Promise<{
    venueId?: string
  }>
}

export default async function NewBookingPage({
  searchParams,
}: PageProps) {
  const params = await searchParams

  const venueId = params?.venueId

  if (!venueId) {
    redirect("/customer/book-venue")
  }

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

  const { data: venue } = await supabase
    .from("venues")
    .select("*")
    .eq("id", venueId)
    .eq("organization_id", activeOrganization.organization_id)
    .maybeSingle()

  if (!venue) {
    redirect("/customer/book-venue")
  }

  async function createBooking(formData: FormData) {
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
      redirect("/customer/book-venue")
    }

    const eventType = String(formData.get("event_type") || "")
    const eventDate = String(formData.get("event_date") || "")
    const startTime = String(formData.get("start_time") || "")
    const endTime = String(formData.get("end_time") || "")
    const guestCount = Number(formData.get("guest_count") || 0)
    const notes = String(formData.get("notes") || "")

    const { data: booking, error } = await supabase
      .from("venue_bookings")
      .insert({
        organization_id: activeOrganization.organization_id,
        venue_id: venue.id,
        user_id: user.id,
        event_type: eventType,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        guest_count: guestCount,
        notes,
        status: "pending_review",
      })
      .select()
      .single()

    if (error || !booking) {
      throw new Error("Failed to create booking")
    }

    revalidatePath("/customer/bookings")

    redirect(`/customer/bookings/${booking.id}`)
  }

  return (
    <div className="space-y-6">
      <CustomerTabs />

      <div>
        <p className="text-sm text-muted-foreground">
          {activeOrganization.organization_name}
        </p>

        <h1 className="text-2xl font-bold tracking-tight">
          Booking Request
        </h1>

        <p className="text-sm text-muted-foreground">
          Submit a booking request for {venue.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{venue.name}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {venue.description && <p>{venue.description}</p>}

          {venue.capacity && (
            <p>Maximum Capacity: {venue.capacity} guests</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={createBooking} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type</Label>

                <Input
                  id="event_type"
                  name="event_type"
                  placeholder="Wedding Reception"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_count">Guest Count</Label>

                <Input
                  id="guest_count"
                  name="guest_count"
                  type="number"
                  min="1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_date">Event Date</Label>

                <Input
                  id="event_date"
                  name="event_date"
                  type="date"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time</Label>

                  <Input
                    id="start_time"
                    name="start_time"
                    type="time"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>

                  <Input
                    id="end_time"
                    name="end_time"
                    type="time"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>

              <Textarea
                id="notes"
                name="notes"
                rows={5}
                placeholder="Tell us more about your event..."
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit">
                Submit Booking Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}