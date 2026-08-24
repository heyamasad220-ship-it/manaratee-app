import { PlatformSidebar } from "@/components/platform/platform-sidebar"

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <PlatformSidebar />
      <main className="platform-main-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-scroll overscroll-y-contain bg-background">
        {children}
      </main>
    </div>
  )
}