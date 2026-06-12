import Link from "next/link"

import { ModuleTabNav, type ModuleTabNavItem } from "@/components/layout/module-tab-nav"

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
  return (
    <>
      <div className="border-b border-border bg-card px-6 pt-6">
        <nav className="mb-2 text-sm text-muted-foreground">
          <Link href="/vendor-hub" className="hover:text-foreground">
            Vendor Hub
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Vendor Network</span>
          {title !== "Vendor Network" ? (
            <>
              <span className="mx-2">/</span>
              <span className="text-foreground">{title}</span>
            </>
          ) : null}
        </nav>

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
