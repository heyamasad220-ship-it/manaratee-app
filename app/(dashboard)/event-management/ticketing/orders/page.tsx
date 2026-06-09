import { TicketingOrdersClient } from "@/components/tickets/ticketing-orders-client"
import { getTicketOrders, getTicketedEvents } from "@/lib/tickets/ticket-order-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementTicketingOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const params = await searchParams
  const initialEventFilter = params.event || "all"

  const [orders, events, canManage] = await Promise.all([
    getTicketOrders(),
    getTicketedEvents(),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <div className="p-6">
      <TicketingOrdersClient
        orders={orders}
        events={events}
        initialEventFilter={initialEventFilter}
        canManage={canManage}
      />
    </div>
  )
}
