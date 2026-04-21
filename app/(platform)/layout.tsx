import { PlatformSidebar } from "@/components/platform/platform-sidebar"

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <PlatformSidebar />
      <main className="flex flex-1 flex-col overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}