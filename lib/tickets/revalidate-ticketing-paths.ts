import { revalidatePath } from "next/cache"

const TICKETING_PATHS = [
  "/event-management",
  "/event-management/events",
  "/event-management/check-in",
  "/event-management/reports/orders",
  "/event-management/reports/tickets",
  "/event-management/ticketing",
  "/event-management/ticketing/events",
  "/event-management/ticketing/orders",
  "/event-management/ticketing/check-in",
  "/event-management/ticketing/reports",
  "/event-management/ticketing/settings",
  "/events/tickets",
  "/tickets",
  "/tickets/orders",
  "/customer/tickets",
] as const

export function revalidateTicketingPaths() {
  for (const path of TICKETING_PATHS) {
    revalidatePath(path)
  }
}
