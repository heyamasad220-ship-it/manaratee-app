import { notFound } from "next/navigation"

import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import { BazaarEventVendorsClient } from "@/components/vendor-hub/events/bazaar-event-vendors-client"
import { getBoothOrders } from "@/lib/vendor-hub/booth-orders-queries"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
import { createClient } from "@/lib/supabase/server"
import type { EventBoothOption } from "@/lib/vendor-hub/add-event-vendor-actions"

export default async function BazaarEventVendorsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireVendorHubManage()

  const { eventId } = await params
  const event = await getVendorHubEventById(eventId)

  if (!event) {
    notFound()
  }

  const supabase = await createClient()
  const [orders, vendorTypes, boothResult] = await Promise.all([
    getBoothOrders(eventId),
    getVendorHubVendorTypes({ activeOnly: false }),
    supabase
      .from("vendor_hub_booths")
      .select("id, number, status, location")
      .eq("event_id", eventId)
      .order("number", { ascending: true }),
  ])

  const booths: EventBoothOption[] = (boothResult.data || []).map((row) => ({
    id: row.id as string,
    number: String(row.number ?? ""),
    status: (row.status as string | null) ?? null,
    location: (row.location as string | null) ?? null,
  }))

  return (
    <BazaarEventWorkspaceShell event={event}>
      <BazaarEventVendorsClient
        eventId={eventId}
        orders={orders}
        vendorTypes={vendorTypes}
        booths={booths}
      />
    </BazaarEventWorkspaceShell>
  )
}
