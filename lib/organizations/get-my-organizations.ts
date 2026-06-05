import { createClient } from "@/lib/supabase/server"
import type { CustomerOrganization } from "@/lib/customer/customer-organization-types"
import { normalizeCustomerOrganizations } from "@/lib/customer/customer-portal-role-label"

export async function getMyOrganizations(): Promise<CustomerOrganization[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_my_organizations")

  if (error) {
    console.error("Get my organizations error:", error)
    return []
  }

  return normalizeCustomerOrganizations((data || []) as CustomerOrganization[])
}