import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

/**
 * Legacy /vendor-hub/vendors/[id] links → Vendor Network vendor profile.
 */
export default async function VendorHubVendorDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(VENDOR_HUB_ROUTES.network.vendor(id))
}
