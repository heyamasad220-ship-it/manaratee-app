import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrganizationMemberSystemRole } from "@/lib/organizations/organization-member-constants"

/** Map organization_members.role → profiles.role (profiles check constraint). */
export function profileRoleFromSystemRole(systemRole: string): string {
  if (
    systemRole === "super_admin" ||
    systemRole === "admin" ||
    systemRole === "coordinator" ||
    systemRole === "member" ||
    systemRole === "viewer" ||
    systemRole === "owner"
  ) {
    return systemRole
  }

  return "viewer"
}

export async function syncProfileForOrganizationMember(
  admin: SupabaseClient,
  input: {
    userId: string
    email: string
    firstName: string
    lastName: string
    organizationId: string
    systemRole: OrganizationMemberSystemRole | string
  }
) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: input.userId,
      email: input.email,
      first_name: input.firstName || null,
      last_name: input.lastName || null,
      organization_id: input.organizationId,
      role: profileRoleFromSystemRole(input.systemRole),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )

  if (error) {
    console.warn("Profile sync during invite failed:", error.message)
  }

  return error
}
