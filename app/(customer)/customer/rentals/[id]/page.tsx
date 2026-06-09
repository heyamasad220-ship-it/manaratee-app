import { notFound, redirect } from "next/navigation"

import { CustomerRentalDetailView } from "@/components/customer/rentals/customer-rental-detail-view"
import { getCustomerVenueRentalDetail } from "@/lib/bookings/customer-venue-rental-queries"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function CustomerVenueRentalDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const detail = await getCustomerVenueRentalDetail(
    id,
    user.id,
    activeOrganization.organization_id
  )

  if (!detail) {
    notFound()
  }

  return <CustomerRentalDetailView detail={detail} />
}
