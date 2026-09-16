import type { ModuleTabNavItem } from "@/components/layout/module-tab-nav"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export const VENDOR_NETWORK_TABS: ModuleTabNavItem[] = [
  { label: "Vendors", href: VENDOR_HUB_ROUTES.network.vendors },
  { label: "Onboarding", href: VENDOR_HUB_ROUTES.network.onboarding },
  { label: "Documents", href: VENDOR_HUB_ROUTES.network.documents },
  { label: "Invitations", href: VENDOR_HUB_ROUTES.network.invitations },
]

export function bazaarEventTabs(eventId: string): ModuleTabNavItem[] {
  return [
    { label: "Overview", href: VENDOR_HUB_ROUTES.events.detail(eventId), exact: true },
    { label: "Vendors", href: VENDOR_HUB_ROUTES.events.booths(eventId) },
    { label: "Evaluations", href: VENDOR_HUB_ROUTES.events.evaluations(eventId) },
    { label: "Messages", href: VENDOR_HUB_ROUTES.events.messages(eventId) },
    { label: "Settings", href: VENDOR_HUB_ROUTES.events.settings(eventId) },
  ]
}
