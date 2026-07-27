import { ModuleTabNav, type ModuleTabNavItem } from "@/components/layout/module-tab-nav"
import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"
import { VendorHubEventSelector } from "@/components/vendor-hub/vendor-hub-event-selector"

export function VendorHubSectionShell({
  title,
  description,
  tabs,
  showEventSelector = true,
  children,
}: {
  title: string
  description?: string
  tabs?: ModuleTabNavItem[]
  showEventSelector?: boolean
  children: React.ReactNode
}) {
  return (
    <>
      <div className="border-b border-border bg-card px-6 pt-6">
        <PageBreadcrumbs
          className="mb-2"
          items={[
            { label: "Vendor Hub", href: "/vendor-hub" },
            { label: title },
          ]}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {showEventSelector ? <VendorHubEventSelector /> : null}
        </div>

        {tabs?.length ? (
          <div className="mt-4">
            <ModuleTabNav tabs={tabs} />
          </div>
        ) : null}
      </div>

      <div className="p-6">{children}</div>
    </>
  )
}
