import Link from "next/link"

export function EventManagementReportsSectionHeader() {
  return (
    <div className="border-b border-border bg-card px-6 pt-6 pb-4">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/event-management/overview" className="hover:text-foreground">
          Event Management
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Reports</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ticketing analytics and event operational reporting.
      </p>
    </div>
  )
}
