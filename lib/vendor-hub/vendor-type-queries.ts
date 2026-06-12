import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

import type { VendorHubVendorType } from "./vendor-type-types"

export async function getVendorHubVendorTypes(options?: { activeOnly?: boolean }) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("vendor_hub_vendor_types")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST204") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load vendor types")
  }

  return (data || []) as VendorHubVendorType[]
}
