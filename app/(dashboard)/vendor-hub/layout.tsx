import { VendorHubEventProvider } from "@/components/vendor-hub/vendor-hub-event-provider"
import { getVendorHubEvents } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"
import { requireVendorHubView } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function VendorHubLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("vendor-hub")
  await requireVendorHubView()

  const events = await getVendorHubEvents()

  return (
    <VendorHubEventProvider initialEvents={events}>{children}</VendorHubEventProvider>
  )
}
