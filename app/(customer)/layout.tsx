import { CustomerNav } from "@/components/customer/customer-nav"

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CustomerNav />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
