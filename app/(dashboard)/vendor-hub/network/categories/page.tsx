import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

/** @deprecated Vendor types live under Settings → Vendor Types. */
export default function VendorNetworkCategoriesRedirect() {
  redirect(VENDOR_HUB_ROUTES.settings)
}
