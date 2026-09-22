export const INTERNAL_EVENT_SOURCE_MODULE = {
  eventManagement: "event_management",
  vendorHub: "vendor_hub",
} as const

export type InternalEventSourceModule =
  (typeof INTERNAL_EVENT_SOURCE_MODULE)[keyof typeof INTERNAL_EVENT_SOURCE_MODULE]

export function isVendorHubOwnedInternalEvent(event: {
  source_module?: string | null
}) {
  return event.source_module === INTERNAL_EVENT_SOURCE_MODULE.vendorHub
}

/** Hide bazaar date/place holds from Event Management lists and calendars. */
export function excludeVendorHubOwnedEvents<
  T extends { neq: (column: string, value: string) => T },
>(query: T): T {
  return query.neq("source_module", INTERNAL_EVENT_SOURCE_MODULE.vendorHub)
}
