import { CustomerTicketsClient } from "@/components/tickets/customer-tickets-client"
import { getCustomerTicketOrders } from "@/lib/tickets/customer-ticket-queries"

export default async function CustomerTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; order?: string }>
}) {
  const { checkout, order } = await searchParams
  const orders = await getCustomerTicketOrders()

  return (
    <CustomerTicketsClient
      orders={orders}
      checkout={checkout}
      orderNumber={order}
    />
  )
}
