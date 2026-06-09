import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  Briefcase,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMyInternalEventRequests } from "@/lib/events/customer-staff-event-queries"
import {
  getInternalEventStatusLabel,
  isInternalEventPendingApproval,
} from "@/lib/events/internal-event-status"
import { getUserPortalCapabilities, requireStaffToolsPortal } from "@/lib/auth/portal-capabilities"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { createClient } from "@/lib/supabase/server"
import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"

export default async function CustomerStaffToolsPage() {
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
  const hasStaffTools = await requireStaffToolsPortal(user.id, organizationId)

  if (!hasStaffTools) {
    redirect("/customer/dashboard")
  }

  const portalCapabilities = await getUserPortalCapabilities(user.id, organizationId)
  const myRequests = await getMyInternalEventRequests(user.id, organizationId)
  const pendingCount = myRequests.filter((event) =>
    isInternalEventPendingApproval(event.status)
  ).length

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          Staff Tools
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Department events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit internal event requests for supervisor approval. This is separate
          from personal venue rentals in My Account.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="sm:col-span-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Request a department event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a space and time, add setup details, and submit for approval.
              Approved events appear on the organization calendar.
            </p>
            <Button asChild>
              <Link href="/customer/staff/events/request">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Request Event
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{myRequests.length}</p>
            <p className="text-sm text-muted-foreground">
              {pendingCount} awaiting approval
            </p>
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/customer/staff/events">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {portalCapabilities.canManageEventRequests ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Review queue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Approve or decline requests from all departments.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/event-management/overview#event-requests">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Open admin queue
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Need a personal rental?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Private celebrations and personal bookings use Venue Rentals in My
                Account.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/customer/rentals/new">Request venue rental</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {myRequests.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recent requests</h2>
          <div className="space-y-3">
            {myRequests.slice(0, 5).map((event) => (
              <Card key={event.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.venues?.name || "Venue TBD"}
                      {event.start_at && event.end_at
                        ? ` · ${formatVenueRentalTimeRange(event.start_at, event.end_at)}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {getInternalEventStatusLabel(event.status)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/event-management/${event.id}`}>View details</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {portalCapabilities.hasAdminPortal ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <LayoutDashboard className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Full Event Management</p>
                <p className="text-sm text-muted-foreground">
                  Settings, all events, and organization-wide calendar tools live in
                  the admin dashboard.
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/event-management/overview">Open Event Management</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
