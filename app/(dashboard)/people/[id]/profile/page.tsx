import { Header } from "@/components/layout/header"
import { CustomersTabNav } from "@/components/layout/customers-tab-nav"
import { CustomerProfileInfo } from "@/components/customers/customer-profile-info"

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <Header title="People" />
      <CustomersTabNav customerId={id} />
      <CustomerProfileInfo />
    </>
  )
}
