"use server"

import { redirect } from "next/navigation"

import { resolveDepartmentHeadship } from "@/lib/departments/department-headship"
import type { DepartmentHeadship } from "@/lib/departments/department-headship"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

/**
 * Active staff row marked Department Head for a department (linked via contact auth user).
 * Type: import `DepartmentHeadship` from `@/lib/departments/department-headship` (not from this file).
 */
export async function getDepartmentHeadshipForCurrentUser(): Promise<DepartmentHeadship | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  return resolveDepartmentHeadship(supabase, organizationId, user.id)
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
