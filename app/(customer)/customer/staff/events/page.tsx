import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { requireStaffToolsPortal } from "@/lib/auth/portal-capabilities"
import {
  formatInternalEventRequestSummary,
  getMyInternalEventRequests,
} from "@/lib/events/customer-staff-event-queries"
import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import { isInternalEventPendingApproval } from "@/lib/events/internal-event-status"
import { cn } from "@/lib/utils"

export default async function CustomerStaffEventsPage() {
  const { userId, organizationId } = await requireCustomerPortalPageContext()
  const hasStaffTools = await requireStaffToolsPortal(userId, organizationId)

  if (!hasStaffTools) {
    redirect("/customer/dashboard")
  }

  const requests = await getMyInternalEventRequests(userId, organizationId)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My event requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Department events you have submitted for approval.
          </p>
        </div>
        <Button asChild>
          <Link href="/customer/staff/events/request">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Request Event
          </Link>
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No event requests yet. Submit your first department event request to
            get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((event) => {
            const summary = formatInternalEventRequestSummary(event)
            const pending = isInternalEventPendingApproval(event.status)

            return (
              <Card
                key={event.id}
                className={cn(pending && "border-amber-200 bg-amber-50/40")}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {summary.venueLabel} · {summary.dateLabel}
                    </p>
                    {event.start_at && event.end_at ? (
                      <p className="text-sm text-muted-foreground">
                        {formatVenueRentalTimeRange(event.start_at, event.end_at)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm font-medium">{summary.statusLabel}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/event-management/${event.id}`}>View details</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
