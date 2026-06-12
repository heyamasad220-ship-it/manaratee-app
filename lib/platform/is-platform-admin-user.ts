import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"

export async function isPlatformAdminUserId(
  userId: string,
  adminClient?: SupabaseClient
): Promise<boolean> {
  const admin = adminClient ?? getServiceRoleClient()

  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (platformAdmin) {
    return true
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle()

  return profile?.is_platform_admin === true
}

export async function isCurrentUserPlatformAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  return isPlatformAdminUserId(user.id)
}
