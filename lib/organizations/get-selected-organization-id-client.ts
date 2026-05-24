import { createClient } from "@/lib/supabase/client"

export async function getSelectedOrganizationIdClient() {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed to load selected organization:", error)
    return null
  }

  return data?.organization_id || null
}