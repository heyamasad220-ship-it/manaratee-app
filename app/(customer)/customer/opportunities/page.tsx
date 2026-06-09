import { redirect } from "next/navigation"

import { OpportunitiesClient } from "@/components/customer/opportunities-client"
import { getServiceOpportunitiesForCurrentUser } from "@/lib/service-participations/service-participation-queries"
import { createClient } from "@/lib/supabase/server"

export default async function CustomerOpportunitiesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { opportunities, eligibility } = await getServiceOpportunitiesForCurrentUser()

  return (
    <OpportunitiesClient opportunities={opportunities} eligibility={eligibility} />
  )
}
