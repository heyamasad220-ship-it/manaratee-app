import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveStaffIdentityForUser } from "@/lib/organizations/work-email-lookups"

export type DepartmentHeadship = {
  organizationId: string
  departmentId: string
  departmentName: string
  staffId: string
}

/**
 * Active staff row marked Department Head for the signed-in contact.
 * Uses the work-email assignment when this login is an org mailbox;
 * otherwise `contacts.auth_user_id`. Personal logins whose contact already
 * has a work email assigned to someone else do not get headship here.
 */
export async function resolveDepartmentHeadship(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<DepartmentHeadship | null> {
  const identity = await resolveStaffIdentityForUser(
    supabase,
    organizationId,
    userId
  )
  const contactId = identity.staffContactId
  if (!contactId) return null

  const { data: staff, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      department_id,
      is_department_head,
      status,
      department:department_id ( id, name )
    `
    )
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("is_department_head", true)
    .not("department_id", "is", null)
    .maybeSingle()

  if (error) {
    // Column may be missing until script 186 is applied.
    if (
      error.message.includes("is_department_head") ||
      error.message.toLowerCase().includes("does not exist")
    ) {
      return null
    }
    console.warn("resolveDepartmentHeadship:", error.message)
    return null
  }

  if (!staff?.department_id) return null
  if (String(staff.status || "") === "inactive") return null

  const department = staff.department as
    | { id?: string; name?: string }
    | { id?: string; name?: string }[]
    | null
  const departmentRow = Array.isArray(department) ? department[0] : department

  return {
    organizationId,
    departmentId: staff.department_id as string,
    departmentName: (departmentRow?.name || "Department").trim() || "Department",
    staffId: staff.id as string,
  }
}
