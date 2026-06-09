import { createClient } from "@/lib/supabase/client"

function getOrganizationIdFromCookie() {
  if (typeof document === "undefined") {
    return null
  }

  const match = document.cookie.match(/(?:^|;\s*)selected_organization_id=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

let inFlightOrgId: Promise<string | null> | null = null

async function fetchOrganizationIdFromAuth(): Promise<string | null> {
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
    .maybeSingle()

  if (error) {
    console.error("Error fetching org:", error)
    return null
  }

  return data?.organization_id || null
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const cookieOrganizationId = getOrganizationIdFromCookie()
  if (cookieOrganizationId) {
    return cookieOrganizationId
  }

  if (!inFlightOrgId) {
    inFlightOrgId = fetchOrganizationIdFromAuth().finally(() => {
      inFlightOrgId = null
    })
  }

  return inFlightOrgId
}
