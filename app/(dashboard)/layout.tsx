import { Sidebar, ModuleSubNav, MobileSidebar, SidebarProvider } from "@/components/layout/sidebar"
import { DashboardAccessGuard } from "@/components/layout/dashboard-access-guard"

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
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}