import { createClient } from "@/lib/supabase/client"

function getSelectedOrganizationIdFromCookie() {
  if (typeof document === "undefined") {
    return null
  }

  const match = document.cookie.match(
    /(?:^|;\s*)selected_organization_id=([^;]*)/
  )

  return match ? decodeURIComponent(match[1]) : null
}

export async function getSelectedOrganizationIdClient() {
  const cookieOrganizationId = getSelectedOrganizationIdFromCookie()

  if (cookieOrganizationId) {
    return cookieOrganizationId
  }

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
