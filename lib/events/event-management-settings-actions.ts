"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import {
  getEventManagementSettings,
  type EventManagementOrgSettings,
} from "@/lib/events/event-management-settings"

async function assertCanManageEventManagementSettings() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error(
      "You do not have permission to manage Event Management settings."
    )
  }
}

function revalidateSettingsPaths() {
  revalidatePath("/event-management/settings/general")
  revalidatePath("/event-management/settings")
  revalidatePath("/event-management")
  revalidatePath("/event-management/events")
}

export async function updateEventManagementSettings(input: {
  approvalRequired: boolean
}): Promise<EventManagementOrgSettings> {
  await assertCanManageEventManagementSettings()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase.from("event_management_settings").upsert(
    {
      organization_id: organizationId,
      approval_required: Boolean(input.approvalRequired),
    },
    { onConflict: "organization_id" }
  )

  if (error) {
    if (
      error.message?.toLowerCase().includes("event_management_settings") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      throw new Error(
        "Database is missing Event Management settings. Run scripts/291_event_management_settings.sql in Supabase, then try again."
      )
    }
    console.error("Failed to save event management settings", error)
    throw new Error(error.message || "Failed to save settings.")
  }

  revalidateSettingsPaths()
  return getEventManagementSettings(organizationId)
}
