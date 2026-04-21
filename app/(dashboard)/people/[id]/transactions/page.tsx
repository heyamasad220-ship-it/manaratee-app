import { Header } from "@/components/layout/header"
import { CustomersTabNav } from "@/components/layout/customers-tab-nav"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export default async function PersonTransactionsPage({
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
        title="Transactions"
        description="Payment history and transaction records. Coming soon."
      />
    </>
  )
}
