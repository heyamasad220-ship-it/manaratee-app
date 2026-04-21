import { Sidebar, MobileSidebar, SidebarProvider } from "@/components/layout/sidebar"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"
import { OrganizationSwitcher } from "@/components/organization-switcher"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const selectedOrganizationId = await getSelectedOrganizationId()
  const organizations = await getMyOrganizations()

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MobileSidebar />

        <main className="flex flex-1 flex-col overflow-auto bg-background">
          {/* Org Switcher (correct place) */}
          <div className="border-b bg-background px-4 py-3">
            <OrganizationSwitcher
              organizations={organizations}
              selectedOrganizationId={selectedOrganizationId}
            />
          </div>

          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}