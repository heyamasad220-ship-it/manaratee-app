import { Header } from "@/components/layout/header"
import { DonorsPaginatedList } from "@/components/donations/donors-paginated-list"

export default function DonationsDonorsPage() {
  return (
    <>
      <Header title="Donors" />
      <DonorsPaginatedList />
    </>
  )
}
