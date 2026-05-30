import { CustomerNav } from "@/components/customer/customer-nav"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { activeOrganization, organizations } =
    await getActiveOrganization()

  return (
    <div className="flex min-h-screen bg-muted/30">
      <CustomerNav
        activeOrganization={activeOrganization}
        organizations={organizations}
      />

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl p-6">
          {children}
        </div>
      </main>
    </div>
  )
}