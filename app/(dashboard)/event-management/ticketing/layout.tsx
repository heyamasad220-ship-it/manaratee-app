import { Header } from "@/components/layout/header"
import { TicketingSectionHeader } from "@/components/layout/ticketing-section-header"

export default function EventManagementTicketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <TicketingSectionHeader />
      {children}
    </>
  )
}
