import { redirect } from "next/navigation"

export default async function TicketingOrdersRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const params = await searchParams
  const query = params.event ? `?event=${encodeURIComponent(params.event)}` : ""
  redirect(`/event-management/ticketing/orders${query}`)
}
