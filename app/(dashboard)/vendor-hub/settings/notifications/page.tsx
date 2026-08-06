import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

/** @deprecated Notifications are embedded under Settings → Notifications. */
export default function VendorHubNotificationSettingsPage() {
  redirect(`${VENDOR_HUB_ROUTES.settings}?tab=notifications`)
}
