import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

/** Reservations tab removed — participating vendors live on the Vendors tab. */
export default async function BazaarEventApplicationsRedirectPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireVendorHubManage()
  const { eventId } = await params
  redirect(VENDOR_HUB_ROUTES.events.booths(eventId))
}
