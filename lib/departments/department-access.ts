"use server"

import { redirect } from "next/navigation"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

export type DepartmentHeadship = {
  organizationId: string
  departmentId: string
  staffId: string
}

/**
 * Active staff row marked Department Head for a department (linked via contact auth user).
 */
export async function getDepartmentHeadshipForCurrentUser(): Promise<DepartmentHeadship | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!contact?.id) return null

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, department_id, is_department_head, status")
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
    console.warn("getDepartmentHeadshipForCurrentUser:", error.message)
    return null
  }

  if (!staff?.department_id) return null
  if (String(staff.status || "") === "inactive") return null

  return {
    organizationId,
    departmentId: staff.department_id as string,
    staffId: staff.id as string,
  }
}

export async function canViewDepartment(departmentId: string): Promise<boolean> {
  const id = String(departmentId || "").trim()
  if (!id) return false

  if (await hasPermission(PERMISSIONS.STAFF_VIEW)) return true

  const headship = await getDepartmentHeadshipForCurrentUser()
  return headship?.departmentId === id
}

/** Payroll / budget / year mutations for “department head”. */
export async function canManageDepartment(departmentId: string): Promise<boolean> {
  const id = String(departmentId || "").trim()
  if (!id) return false

  if (await hasPermission(PERMISSIONS.STAFF_MANAGE)) return true

  const headship = await getDepartmentHeadshipForCurrentUser()
  return headship?.departmentId === id
}

export async function requireDepartmentView(departmentId: string) {
  const allowed = await canViewDepartment(departmentId)
  if (!allowed) {
    redirect("/unauthorized")
  }
}
