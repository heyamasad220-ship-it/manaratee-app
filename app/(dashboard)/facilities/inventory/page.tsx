import { FacilityInventoryClient } from "@/components/facilities/facility-inventory-client"
import { getFacilityInventoryItems } from "@/lib/facility-inventory/facility-inventory-queries"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

export default async function FacilitiesInventoryPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE
  )

  const organizationId = await resolveOrganizationId()
  const supabase = await createClient()

  let tablesAvailable = true
  if (organizationId) {
    const probe = await supabase
      .from("facility_inventory_items")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1)

    if (probe.error?.code === "42P01" || probe.error?.code === "PGRST204") {
      tablesAvailable = false
    }
  }

  const [items, canManage] = await Promise.all([
    tablesAvailable ? getFacilityInventoryItems() : Promise.resolve([]),
    hasAnyPermission(PERMISSIONS.SPACES_MANAGE, PERMISSIONS.BOOKINGS_MANAGE),
  ])

  return (
    <FacilityInventoryClient
      items={items}
      tablesAvailable={tablesAvailable}
      canManage={canManage}
    />
  )
}
