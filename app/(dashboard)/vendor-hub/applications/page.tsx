import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export default function LegacyApplicationsRedirect() {
  redirect(VENDOR_HUB_ROUTES.events.list)
}
