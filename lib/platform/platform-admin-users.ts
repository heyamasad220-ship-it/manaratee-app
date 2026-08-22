import type { SupabaseClient } from "@supabase/supabase-js"

/** Platform owner login — never an organization Super Admin / owner. */
export const PLATFORM_OWNER_EMAIL = "admin@manaratee.com"

export function isPlatformOwnerEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PLATFORM_OWNER_EMAIL
}

export async function getPlatformAdminUserIds(
  admin: SupabaseClient
): Promise<Set<string>> {
  const ids = new Set<string>()

  const { data: platformAdmins, error: platformAdminsError } = await admin
    .from("platform_admins")
    .select("user_id")

  if (platformAdminsError) {
    throw new Error(platformAdminsError.message)
  }

  for (const row of platformAdmins || []) {
    if (row.user_id) {
      ids.add(row.user_id as string)
    }
  }

  const { data: profileAdmins, error: profileAdminsError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_platform_admin", true)

  if (profileAdminsError) {
    throw new Error(profileAdminsError.message)
  }

  for (const row of profileAdmins || []) {
    if (row.id) {
      ids.add(row.id as string)
    }
  }

  return ids
}

export function isPlatformAdminUserId(
  userId: string,
  platformAdminUserIds: Set<string>
) {
  return platformAdminUserIds.has(userId)
}
