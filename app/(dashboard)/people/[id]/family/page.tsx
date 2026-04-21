import { Header } from "@/components/layout/header"
import { CustomersTabNav } from "@/components/layout/customers-tab-nav"
import { CustomerFamily } from "@/components/customers/customer-family"

export default async function PersonFamilyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <Header title="People" />
      <CustomersTabNav customerId={id} />
      <CustomerFamily />
    </>
  )
}
