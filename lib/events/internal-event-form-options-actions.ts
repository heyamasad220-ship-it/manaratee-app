"use server"

import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { userCanSubmitInternalEventRequest } from "@/lib/auth/staff-tools-eligibility"
import { loadInternalEventCreateFormOptions } from "@/lib/events/internal-event-form-options"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getDepartmentHeadshipForCurrentUser } from "@/lib/departments/department-access"

export async function getInternalEventCreateFormOptionsAction(input?: {
  departmentId?: string | null
}): Promise<
  | { success: true; options: Awaited<ReturnType<typeof loadInternalEventCreateFormOptions>> }
  | { success: false; error: string }
> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "You must be signed in to create an event." }
  }

  const [canManage, canSubmit, headship] = await Promise.all([
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    userCanSubmitInternalEventRequest(supabase, organizationId, user.id),
    getDepartmentHeadshipForCurrentUser(),
  ])

  if (!canManage && !canSubmit && !headship) {
    return {
      success: false,
      error: "You do not have permission to create events.",
    }
  }

  const lockDepartmentId =
    input?.departmentId?.trim() ||
    (!canManage && headship ? headship.departmentId : null)

  try {
    const options = await loadInternalEventCreateFormOptions({
      lockDepartmentId,
    })
    return { success: true, options }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load the create event form.",
    }
  }
}
