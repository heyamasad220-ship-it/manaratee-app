import { Sidebar, ModuleNavDrawer, MobileSidebar, SidebarProvider, SidebarNavigationSync } from "@/components/layout/sidebar"
import { DashboardAccessGuard } from "@/components/layout/dashboard-access-guard"
import { DashboardReturnTracker } from "@/components/navigation/dashboard-return-tracker"
import { PlatformSupportBanner } from "@/components/platform/platform-support-banner"
import { OrgUserSupportBanner } from "@/components/organizations/org-user-support-banner"
import { Suspense } from "react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <DashboardAccessGuard />
      <Suspense fallback={null}>
        <DashboardReturnTracker />
      </Suspense>
      <Suspense fallback={null}>
        <SidebarNavigationSync />
      </Suspense>
      <div className="fixed inset-0 flex overflow-hidden">
        <Sidebar />
        <ModuleNavDrawer />
        <MobileSidebar />

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background">
          <PlatformSupportBanner />
          <OrgUserSupportBanner />
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}