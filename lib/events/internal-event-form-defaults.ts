import { resolveContactForAuthUser } from "@/lib/operational-briefs/operational-brief-contact-resolver"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"

export type InternalEventFormDefaults = {
  departmentId: string | null
  user: {
    id: string
    name: string
  } | null
}

export async function getInternalEventFormDefaults(): Promise<InternalEventFormDefaults> {
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return { departmentId: null, user: null }
  }

  let supabase
  let userId: string | null = null
  let userName = "User"

  try {
    const { supabase: dataClient, session } = await getCustomerPortalSupabase()
    supabase = dataClient
    userId = session.effectiveUserId

    const { data: profile } = await dataClient
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .maybeSingle()

    userName =
      `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
      (profile?.email as string | undefined) ||
      session.authenticatedUser.email ||
      "User"
  } catch {
    return { departmentId: null, user: null }
  }

  if (!userId) {
    return { departmentId: null, user: null }
  }

  const contact = await resolveContactForAuthUser(supabase, organizationId, userId)

  let departmentId: string | null = null

  if (contact?.contactId) {
    const { data: staff } = await supabase
      .from("staff")
      .select("department_id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contact.contactId)
      .maybeSingle()

    departmentId = (staff?.department_id as string | null) ?? null
  }

  const resolvedName = contact?.fullName?.trim() || userName

  return {
    departmentId,
    user: { id: userId, name: resolvedName },
  }
}
