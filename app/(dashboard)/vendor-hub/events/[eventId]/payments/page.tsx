import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

/** Payments tab removed — payment totals appear on the Vendors tab. */
export default async function BazaarEventPaymentsRedirectPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireVendorHubManage()
  const { eventId } = await params
  redirect(VENDOR_HUB_ROUTES.events.booths(eventId))
}
