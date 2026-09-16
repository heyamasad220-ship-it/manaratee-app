import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

export type EventManagementOrgSettings = {
  approvalRequired: boolean
}

export const DEFAULT_EVENT_MANAGEMENT_ORG_SETTINGS: EventManagementOrgSettings =
  {
    approvalRequired: false,
  }

export async function getEventManagementSettings(
  organizationId?: string | null
): Promise<EventManagementOrgSettings> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await resolveOrganizationId())

  if (!orgId) {
    return { ...DEFAULT_EVENT_MANAGEMENT_ORG_SETTINGS }
  }

  const { data, error } = await supabase
    .from("event_management_settings")
    .select("approval_required")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message?.toLowerCase().includes("event_management_settings")
    ) {
      return { ...DEFAULT_EVENT_MANAGEMENT_ORG_SETTINGS }
    }
    console.error("Failed to load event management settings", error)
    return { ...DEFAULT_EVENT_MANAGEMENT_ORG_SETTINGS }
  }

  return {
    approvalRequired: Boolean(data?.approval_required),
  }
}
