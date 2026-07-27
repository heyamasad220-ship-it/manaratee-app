import type { SupabaseClient } from "@supabase/supabase-js"

export type DepartmentHeadship = {
  organizationId: string
  departmentId: string
  departmentName: string
  staffId: string
}

/**
 * Active staff row marked Department Head for the signed-in contact
 * (`contacts.auth_user_id` → `staff.is_department_head` + `department_id`).
 */
export async function resolveDepartmentHeadship(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<DepartmentHeadship | null> {
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  if (!contact?.id) return null

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
    .eq("contact_id", contact.id)
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
