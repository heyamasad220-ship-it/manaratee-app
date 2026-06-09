import { Sidebar, ModuleSubNav, MobileSidebar, SidebarProvider } from "@/components/layout/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
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