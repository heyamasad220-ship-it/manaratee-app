export const VENDOR_HUB_BASE = "/vendor-hub"

export type VendorHubReportsTabId = "vendor-sales" | "booth-performance" | "history"

export function vendorHubReportsPath(options?: {
  tab?: VendorHubReportsTabId
  eventId?: string | null
  contact?: string | null
}) {
  const params = new URLSearchParams()
  if (options?.tab) params.set("tab", options.tab)
  if (options?.eventId && options.eventId !== "all") params.set("eventId", options.eventId)
  if (options?.contact) params.set("contact", options.contact)
  const query = params.toString()
  return query ? `${VENDOR_HUB_BASE}/reports?${query}` : `${VENDOR_HUB_BASE}/reports`
}

export const VENDOR_HUB_ROUTES = {
  dashboard: VENDOR_HUB_BASE,
  overview: VENDOR_HUB_BASE,
  network: {
    root: `${VENDOR_HUB_BASE}/network`,
    vendors: `${VENDOR_HUB_BASE}/network/vendors`,
    vendor: (contactId: string) => `${VENDOR_HUB_BASE}/network/vendors/${contactId}`,
    onboarding: `${VENDOR_HUB_BASE}/network/onboarding`,
    /** Legacy URL; redirects to Reports → Participation History */
    history: `${VENDOR_HUB_BASE}/network/history`,
    documents: `${VENDOR_HUB_BASE}/network/documents`,
    invitations: `${VENDOR_HUB_BASE}/network/invitations`,
  },
  events: {
    list: `${VENDOR_HUB_BASE}/events`,
    detail: (eventId: string) => `${VENDOR_HUB_BASE}/events/${eventId}`,
    applications: (eventId: string) => `${VENDOR_HUB_BASE}/events/${eventId}/applications`,
    booths: (eventId: string) => `${VENDOR_HUB_BASE}/events/${eventId}/booths`,
    payments: (eventId: string) => `${VENDOR_HUB_BASE}/events/${eventId}/payments`,
    evaluations: (eventId: string) => `${VENDOR_HUB_BASE}/events/${eventId}/evaluations`,
    messages: (eventId: string) => `${VENDOR_HUB_BASE}/events/${eventId}/messages`,
    settings: (eventId: string) => `${VENDOR_HUB_BASE}/events/${eventId}/settings`,
  },
  communityCalendar: "/community-calendar",
  reports: `${VENDOR_HUB_BASE}/reports`,
  reportsHistory: (contactId?: string | null) =>
    vendorHubReportsPath({ tab: "history", contact: contactId }),
  settings: `${VENDOR_HUB_BASE}/settings`,
} as const

export function vendorHubApplicationsPath(eventId?: string) {
  if (eventId) {
    return VENDOR_HUB_ROUTES.events.applications(eventId)
  }
  return VENDOR_HUB_ROUTES.network.vendors
}

/** @deprecated Use VENDOR_HUB_ROUTES.network.vendors or event-scoped applications path */
export const LEGACY_VENDOR_HUB_APPLICATIONS_PATH = `${VENDOR_HUB_BASE}/vendors/applications`
