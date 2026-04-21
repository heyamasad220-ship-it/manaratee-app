import { Header } from "@/components/layout/header"
import { CustomersTabNav } from "@/components/layout/customers-tab-nav"
import { PersonSubscriptions } from "@/components/people/person-subscriptions"

export default async function PersonSubscriptionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <Header title="People" />
      <CustomersTabNav customerId={id} />
      <PersonSubscriptions customerId={id} />
    </>
  )
}
