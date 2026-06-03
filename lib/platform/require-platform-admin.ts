import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type PlatformAdminContext = {
  admin: SupabaseClient
  userId: string
}

export async function requirePlatformAdmin(): Promise<
  | { ok: true; context: PlatformAdminContext }
  | { ok: false; status: number; error: string }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      error: "Missing Supabase server environment variables.",
    }
  }

  const supabaseUser = await createServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser()

  if (userError || !user) {
    return { ok: false, status: 401, error: "Unauthorized." }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!platformAdmin) {
    const { data: profile } = await admin
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.is_platform_admin) {
      return { ok: false, status: 403, error: "Forbidden." }
    }
  }

  return { ok: true, context: { admin, userId: user.id } }
}

export function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
