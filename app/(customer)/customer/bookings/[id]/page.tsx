import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  FileText,
  MessageSquare,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { CustomerTabs } from "@/components/customer/customer-tabs"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function CustomerBookingDetailPage({
  params,
}: PageProps) {
  const { id } = await params

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

  const { data: booking, error } = await supabase
    .from("venue_bookings")
    .select(`
      *,
      venues (
        id,
        name,
        description,
        capacity
      )
    `)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !booking) {
    notFound()
  }

  const formatDate = (value: string | null) => {
    if (!value) return "Not set"

    return new Date(value).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
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

      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/customer/bookings"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Link>

          <h1 className="text-2xl font-bold tracking-tight">
            Booking Details
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Booking ID: {booking.id}
          </p>
        </div>

        <Badge variant="secondary" className="capitalize">
          {booking.status?.replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Event Information</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />

                <div>
                  <p className="text-sm text-muted-foreground">Venue</p>
                  <p className="font-medium">
                    {booking.venues?.name || "Venue"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />

                <div>
                  <p className="text-sm text-muted-foreground">Event Date</p>
                  <p className="font-medium">
                    {formatDate(booking.event_date)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />

                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {booking.start_time || "--"} -{" "}
                    {booking.end_time || "--"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 text-muted-foreground" />

                <div>
                  <p className="text-sm text-muted-foreground">
                    Guest Count
                  </p>
                  <p className="font-medium">
                    {booking.guest_count || 0} guests
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:col-span-2">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />

                <div>
                  <p className="text-sm text-muted-foreground">
                    Event Type
                  </p>

                  <p className="font-medium">
                    {booking.event_type || "Not specified"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm">
                  {booking.notes || "No notes provided."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Total Amount
                </span>

                <span className="font-medium">
                  {formatCurrency(booking.total_amount)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Balance Due
                </span>

                <span className="font-medium">
                  {formatCurrency(booking.balance_due)}
                </span>
              </div>

              <div className="border-t pt-4">
                <Button className="w-full">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Make Payment
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>

            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href="/customer/bookings">
                  <Calendar className="mr-2 h-4 w-4" />
                  View All Bookings
                </Link>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}