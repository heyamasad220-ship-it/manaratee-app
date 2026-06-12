import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2, ChevronDown, Plus } from "lucide-react"

import { VenueRentalRequestCard } from "@/components/customer/venue-rental-request-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCustomerRentalFinancialContexts } from "@/lib/bookings/customer-venue-rental-queries"
import { partitionCustomerVenueRentalsForDashboard } from "@/lib/bookings/customer-venue-rental-experience"
import { getCustomerVenueRentals } from "@/lib/bookings/venue-rental-queries"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

export default async function CustomerVenueRentalsPage() {
  const { session } = await getCustomerPortalSupabase()

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const organizationId = activeOrganization.organization_id
  const userId = session.effectiveUserId

  const rentals = await getCustomerVenueRentals(userId, organizationId)

  const statusByRentalId = Object.fromEntries(
    rentals.map((rental) => [rental.id, rental.status])
  )
  const financialContexts = await getCustomerRentalFinancialContexts(
    rentals.map((rental) => rental.id),
    organizationId,
    statusByRentalId
  )

  const { active, past } = partitionCustomerVenueRentalsForDashboard(
    rentals,
    financialContexts
  )
  const hasAnyRentals = rentals.length > 0

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {activeOrganization.organization_name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Venue Rentals</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Track your venue requests, approvals, payments, and upcoming
            reservations.
          </p>
        </div>
        <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
          <Link href="/customer/rentals/new">
            <Plus className="mr-2 h-4 w-4" />
            Request Venue Rental
          </Link>
        </Button>
      </div>

      {!hasAnyRentals ? (
        <Card>
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No rental requests yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Choose a space, pick your date and time, and submit a request for
              supervisor approval.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/customer/rentals/new">
                <Plus className="mr-2 h-4 w-4" />
                Request Venue Rental
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {active.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {active.length === 1 ? "Your rental" : "Your rentals"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {active.length === 1
                    ? "Everything you need to know about your current request."
                    : `${active.length} active requests — tap a card for the full timeline and payment details.`}
                </p>
              </div>
              <div className="space-y-4">
                {active.map((rental) => (
                  <VenueRentalRequestCard
                    key={rental.id}
                    rental={rental}
                    financialContext={financialContexts.get(rental.id)}
                    variant="active"
                  />
                ))}
              </div>
            </section>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No active rentals right now. Browse past rentals below or submit a
                new request.
              </CardContent>
            </Card>
          )}

          {past.length > 0 ? (
            <details className="group space-y-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
                Past rentals
              </summary>
              <p className="text-sm text-muted-foreground">
                Completed, cancelled, declined, and refunded requests.
              </p>
              <div className="space-y-2">
                {past.map((rental) => (
                  <VenueRentalRequestCard
                    key={rental.id}
                    rental={rental}
                    financialContext={financialContexts.get(rental.id)}
                    variant="past"
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  )
}
