import { resolveContactForAuthUser } from "@/lib/operational-briefs/operational-brief-contact-resolver"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { createClient } from "@/lib/supabase/server"

export type InternalEventFormDefaults = {
  departmentId: string | null
  user: {
    id: string
    name: string
  } | null
}

export async function getInternalEventFormDefaults(): Promise<InternalEventFormDefaults> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return { departmentId: null, user: null }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { departmentId: null, user: null }
  }

  const contact = await resolveContactForAuthUser(supabase, organizationId, user.id)

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

  const profileName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : ""

  const userName = contact?.fullName?.trim() || profileName || user.email || "Current user"

  return {
    departmentId,
    user: { id: user.id, name: userName },
  }
}
