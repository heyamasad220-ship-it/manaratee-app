export const EVENT_MANAGEMENT_REPORTS_PATH = "/event-management/reports"
export const EVENT_MANAGEMENT_ORDERS_REPORTS_PATH =
  "/event-management/reports/orders"
export const EVENT_MANAGEMENT_TICKETS_REPORTS_PATH =
  "/event-management/reports/tickets"
export const EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH =
  "/event-management/reports/childcare"

export type EventManagementReportsTabId = "orders" | "tickets" | "childcare"

export const EVENT_MANAGEMENT_REPORTS_TABS: Array<{
  id: EventManagementReportsTabId
  label: string
  href: string
}> = [
  {
    id: "orders",
    label: "Orders",
    href: EVENT_MANAGEMENT_ORDERS_REPORTS_PATH,
  },
  {
    id: "tickets",
    label: "Tickets",
    href: EVENT_MANAGEMENT_TICKETS_REPORTS_PATH,
  },
  {
    id: "childcare",
    label: "Childcare",
    href: EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH,
  },
]

export function eventManagementOrdersHref(eventId?: string | null) {
  if (!eventId) return EVENT_MANAGEMENT_ORDERS_REPORTS_PATH
  return `${EVENT_MANAGEMENT_ORDERS_REPORTS_PATH}?event=${encodeURIComponent(eventId)}`
}
