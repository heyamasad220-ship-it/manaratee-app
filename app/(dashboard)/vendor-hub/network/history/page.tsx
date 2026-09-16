import { redirect } from "next/navigation"

import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export default async function VendorNetworkHistoryRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>
}) {
  const { contact } = await searchParams
  redirect(VENDOR_HUB_ROUTES.reportsHistory(contact))
}
