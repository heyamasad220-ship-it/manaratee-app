import { SetupStylesClient } from "@/components/setup-styles/setup-styles-client"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

export default async function FacilitiesSetupStylesSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const organizationId = await resolveOrganizationId()
  const supabase = await createClient()

  let tablesAvailable = true
  if (organizationId) {
    const probe = await supabase
      .from("room_setup_styles")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1)

    if (probe.error?.code === "42P01" || probe.error?.code === "PGRST204") {
      tablesAvailable = false
    }
  }

  const setupStyles = tablesAvailable ? await getRoomSetupStyles() : []

  return (
    <SetupStylesClient setupStyles={setupStyles} tablesAvailable={tablesAvailable} />
  )
}
