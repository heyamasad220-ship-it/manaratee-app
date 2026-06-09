import { Header } from "@/components/layout/header"
import { EventManagementReportsSectionHeader } from "@/components/layout/event-management-reports-section-header"

export default function EventManagementReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <EventManagementReportsSectionHeader />
      {children}
    </>
  )
}
