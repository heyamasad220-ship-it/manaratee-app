import { Header } from "@/components/layout/header"
import { EventManagementReportsHeader } from "@/components/events/event-management-reports-header"

export default function EventManagementReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header title="Reports" />
      <EventManagementReportsHeader />
      {children}
    </>
  )
}
