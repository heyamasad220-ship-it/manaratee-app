import type { SupabaseClient } from "@supabase/supabase-js"

export type StaffIdentity = {
  /** Contact this login should act as for staff tools, headship, and teaching. */
  staffContactId: string | null
  /** Directory person linked via contacts.auth_user_id (personal / My Account login). */
  personalContactId: string | null
  /** True when this login is an org-owned work email assigned to a Directory person. */
  isWorkLogin: boolean
}

/**
 * Resolve who a signed-in user is for staff vs personal surfaces.
 *
 * Work logins (`organization_members.assigned_contact_id`) act as that Directory
 * person and do not use a personal portal. Personal logins whose contact already
 * has a work email assigned to a different user keep My Account / teaching, but
 * Staff Tools from the employee role move to the work login.
 */
export async function resolveStaffIdentityForUser(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<StaffIdentity> {
  const { data: membership } = await supabase
    .from("organization_members")
    .select("assigned_contact_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  const assignedContactId =
    (membership?.assigned_contact_id as string | null | undefined) ?? null

  const { data: personal } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  const personalContactId = (personal?.id as string | undefined) ?? null

  if (assignedContactId) {
    return {
      staffContactId: assignedContactId,
      personalContactId,
      isWorkLogin: true,
    }
  }

  if (personalContactId) {
    const { data: otherWork } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("assigned_contact_id", personalContactId)
      .neq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (otherWork?.id) {
      return {
        staffContactId: null,
        personalContactId,
        isWorkLogin: false,
      }
    }

    return {
      staffContactId: personalContactId,
      personalContactId,
      isWorkLogin: false,
    }
  }

  return {
    staffContactId: null,
    personalContactId: null,
    isWorkLogin: false,
  }
}
