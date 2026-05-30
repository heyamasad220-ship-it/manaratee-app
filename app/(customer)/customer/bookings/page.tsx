import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  ChevronRight,
  Building2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { CustomerTabs } from "@/components/customer/customer-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function CustomerBookingsPage() {
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

  const { data: bookings, error } = await supabase
    .from("venue_bookings")
    .select(`
      id,
      event_type,
      event_date,
      start_time,
      end_time,
      guest_count,
      status,
      total_amount,
      balance_due,
      created_at,
      venues (
        id,
        name
      )
    `)
    .eq("organization_id", activeOrganization.organization_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const formatDate = (value: string | null) => {
    if (!value) return "Date not set"

    return new Date(value).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatShortMonth = (value: string | null) => {
    if (!value) return "--"

    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
    })
  }

  const formatDay = (value: string | null) => {
    if (!value) return "--"

    return String(new Date(value).getDate())
  }

  const formatCurrency = (amount: number | null) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0)
  }

  return (
    <div className="space-y-6">
      <CustomerTabs />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {activeOrganization.organization_name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">My Bookings</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your venue booking requests.
          </p>
        </div>

        <Button asChild>
          <Link href="/customer/book-venue">
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-destructive">
              Could not load bookings.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure the <strong>venue_bookings</strong> table exists.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && (!bookings || bookings.length === 0) && (
        <Card>
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No bookings yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Start by choosing a venue and submitting your first booking
              request.
            </p>

            <Button className="mt-6" asChild>
              <Link href="/customer/book-venue">
                <Plus className="mr-2 h-4 w-4" />
                Book a Venue
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && bookings && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking: any) => (
            <Link key={booking.id} href={`/customer/bookings/${booking.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10">
                        <span className="text-xs font-medium text-primary">
                          {formatShortMonth(booking.event_date)}
                        </span>
                        <span className="text-2xl font-bold text-primary">
                          {formatDay(booking.event_date)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">
                            {booking.event_type || "Venue Booking"}
                          </h3>

                          <Badge variant="secondary" className="capitalize">
                            {booking.status?.replaceAll("_", " ")}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {booking.venues?.name || "Venue"}
                          </span>

                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(booking.event_date)}
                          </span>

                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {booking.start_time || "--"} -{" "}
                            {booking.end_time || "--"}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Booking ID: {booking.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-semibold">
                          {formatCurrency(booking.total_amount)}
                        </p>

                        {Number(booking.balance_due || 0) > 0 && (
                          <p className="text-xs text-orange-600">
                            Balance: {formatCurrency(booking.balance_due)}
                          </p>
                        )}
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}