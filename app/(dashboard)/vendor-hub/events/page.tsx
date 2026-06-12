import { BazaarEventsListClient } from "@/components/vendor-hub/events/bazaar-events-list-client"
import { getVendorHubEvents } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function BazaarEventsListPage() {
  await requireVendorHubManage()

  const events = await getVendorHubEvents()

  return (
    <div className="p-6">
      <BazaarEventsListClient events={events} />
    </div>
  )
}
