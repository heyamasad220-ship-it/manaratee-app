import { notFound } from "next/navigation"

import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import { BazaarEventReservationsClient } from "@/components/vendor-hub/events/bazaar-event-reservations-client"
import { Card, CardContent } from "@/components/ui/card"
import { getBazaarEventReservations } from "@/lib/vendor-hub/event-reservation-queries"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import Link from "next/link"

export default async function BazaarEventApplicationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireVendorHubManage()

  const { eventId } = await params
  const event = await getVendorHubEventById(eventId)

  if (!event || !event.organization_id) {
    notFound()
  }

  const reservations = await getBazaarEventReservations(eventId, event.organization_id)

  return (
    <BazaarEventWorkspaceShell event={event}>
      <Card className="mb-4 border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Vendors apply once at the organization level. After approval they can reserve booths on
          published bazaars without re-applying.{" "}
          <Link href={VENDOR_HUB_ROUTES.network.onboarding} className="font-medium underline">
            Review vendor onboarding applications
          </Link>{" "}
          under Vendor Network.
        </CardContent>
      </Card>
      <BazaarEventReservationsClient reservations={reservations} />
    </BazaarEventWorkspaceShell>
  )
}
