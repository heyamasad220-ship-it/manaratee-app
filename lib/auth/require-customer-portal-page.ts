import { redirect } from "next/navigation"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

export async function requireCustomerPortalPageContext() {
  let session
  try {
    ;({ session } = await getCustomerPortalSupabase())
  } catch {
    redirect("/login")
  }

  const { activeOrganization, organizations } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  return {
    session,
    userId: session.effectiveUserId,
    organizationId: activeOrganization.organization_id,
    activeOrganization,
    organizations,
  }
}
