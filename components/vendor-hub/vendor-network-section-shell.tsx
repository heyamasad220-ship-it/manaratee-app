import { ModuleTabNav, type ModuleTabNavItem } from "@/components/layout/module-tab-nav"
import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export function VendorNetworkSectionShell({
  title,
  description,
  tabs,
  children,
}: {
  title: string
  description?: string
  tabs?: ModuleTabNavItem[]
  children: React.ReactNode
}) {
  const items =
    title === "Vendor Network"
      ? [
          { label: "Vendor Hub", href: "/vendor-hub" },
          { label: "Vendor Network" },
        ]
      : [
          { label: "Vendor Hub", href: "/vendor-hub" },
          {
            label: "Vendor Network",
            href: VENDOR_HUB_ROUTES.network.root,
          },
          { label: title },
        ]

  return (
    <>
      <div className="border-b border-border bg-card px-6 pt-6">
        <PageBreadcrumbs className="mb-2" items={items} />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
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
