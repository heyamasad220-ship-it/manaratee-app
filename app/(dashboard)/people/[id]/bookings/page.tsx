import { Header } from "@/components/layout/header"
import { CustomersTabNav } from "@/components/layout/customers-tab-nav"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export default async function PersonBookingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <Header title="People" />
      <CustomersTabNav customerId={id} />
      <PlaceholderPage
        title="Bookings"
        description="Space booking history and upcoming reservations. Coming soon."
      />
    </>
  )
}
