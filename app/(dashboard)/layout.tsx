import { Sidebar, ModuleSubNav, MobileSidebar, SidebarProvider } from "@/components/layout/sidebar"
import { DashboardAccessGuard } from "@/components/layout/dashboard-access-guard"
import { PlatformSupportBanner } from "@/components/platform/platform-support-banner"
import { OrgUserSupportBanner } from "@/components/organizations/org-user-support-banner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <DashboardAccessGuard />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <ModuleSubNav />
        <MobileSidebar />

        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <PlatformSupportBanner />
          <OrgUserSupportBanner />
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}