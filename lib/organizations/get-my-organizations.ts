import { createClient } from "@/lib/supabase/server"

export async function getMyOrganizations() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return []
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      organization_id,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", user.id)

  if (error) {
    console.error("Get my organizations error:", error)
    return []
  }

  return (data || [])
    .map((row: any) => row.organizations)
    .filter(Boolean)
}