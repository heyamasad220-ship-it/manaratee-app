import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export default function DeferredOperationsRedirect() {
  redirect(VENDOR_HUB_ROUTES.dashboard)
}
