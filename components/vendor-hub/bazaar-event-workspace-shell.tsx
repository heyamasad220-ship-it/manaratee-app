import { ModuleTabNav } from "@/components/layout/module-tab-nav"
import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { bazaarEventTabs } from "@/lib/vendor-hub/vendor-hub-nav"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"

export function BazaarEventWorkspaceShell({
  event,
  children,
}: {
  event: VendorHubEventWithInternal
  children: React.ReactNode
}) {
  const displayDate =
    event.event_date ?? event.internal_event?.start_at?.slice(0, 10) ?? "Date not set"
  const displayLocation =
    event.location ?? event.internal_event?.location_label ?? "Location not set"

  return (
    <>
      <div className="border-b border-border bg-card px-6 pt-6">
        <PageBreadcrumbs
          className="mb-2"
          items={[
            { label: "Vendor Hub", href: "/vendor-hub" },
            { label: "Bazaar Events", href: VENDOR_HUB_ROUTES.events.list },
            { label: event.name },
          ]}
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
            {event.internal_event_id ? (
              <Badge variant="secondary">Linked to Event Management</Badge>
            ) : null}
            {event.status && event.status !== "draft" ? (
              <Badge variant="outline" className="capitalize">
                {event.status}
              </Badge>
            ) : null}
            {event.calendar_status && event.calendar_status !== "not_published" ? (
              <Badge variant="outline">{event.calendar_status.replace(/_/g, " ")}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {displayDate} · {displayLocation}
          </p>
        </div>

        <div className="mt-4">
          <ModuleTabNav tabs={bazaarEventTabs(event.id)} />
        </div>
      </div>

      <div className="p-6">{children}</div>
    </>
  )
}
