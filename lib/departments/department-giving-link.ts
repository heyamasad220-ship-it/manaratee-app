"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type DepartmentGivingPair = {
  departmentId: string
  departmentName: string
  departmentColor: string | null
  departmentDescription: string | null
  groupContactId: string
  groupName: string | null
  groupStatus: string | null
  linkSource: "linked" | "name_match"
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  const message = (error.message || "").toLowerCase()
  return (
    message.includes("giving_group_kind") ||
    message.includes("linked_department_id") ||
    message.includes("linked_hr_team_id")
  )
}

async function requireOrg() {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null
  return organizationId
}

export async function findGivingGroupForDepartmentAction(
  departmentId: string
): Promise<
  | { success: true; pair: DepartmentGivingPair | null }
  | { success: false; error: string }
> {
  const canView =
    (await hasPermission(PERMISSIONS.STAFF_VIEW)) ||
    (await hasPermission(PERMISSIONS.CONTACTS_VIEW))
  if (!canView) {
    return { success: false, error: "Not authorized." }
  }

  const organizationId = await requireOrg()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("id, name, description, color")
    .eq("organization_id", organizationId)
    .eq("id", departmentId)
    .maybeSingle()

  if (departmentError || !department) {
    return { success: false, error: "Department not found." }
  }

  const departmentName = (department.name as string) || "Department"

  const linked = await supabase
    .from("contacts")
    .select("id, full_name, status, linked_department_id, giving_group_kind")
    .eq("organization_id", organizationId)
    .eq("contact_type", "group")
    .eq("linked_department_id", departmentId)
    .limit(1)
    .maybeSingle()

  if (!linked.error && linked.data) {
    return {
      success: true,
      pair: {
        departmentId: department.id as string,
        departmentName,
        departmentColor: (department.color as string | null) ?? null,
        departmentDescription: (department.description as string | null) ?? null,
        groupContactId: linked.data.id as string,
        groupName: (linked.data.full_name as string | null) ?? null,
        groupStatus: (linked.data.status as string | null) ?? null,
        linkSource: "linked",
      },
    }
  }

  if (linked.error && !isMissingColumnError(linked.error)) {
    return { success: false, error: linked.error.message }
  }

  const { data: byName, error: nameError } = await supabase
    .from("contacts")
    .select("id, full_name, status, linked_department_id, giving_group_kind")
    .eq("organization_id", organizationId)
    .eq("contact_type", "group")
    .ilike("full_name", departmentName)
    .limit(2)

  if (nameError && !isMissingColumnError(nameError)) {
    // Retry without category columns
    const retry = await supabase
      .from("contacts")
      .select("id, full_name, status")
      .eq("organization_id", organizationId)
      .eq("contact_type", "group")
      .ilike("full_name", departmentName)
      .limit(2)
    if (retry.error) {
      return { success: false, error: retry.error.message }
    }
    if ((retry.data || []).length === 1) {
      const row = retry.data![0]
      return {
        success: true,
        pair: {
          departmentId: department.id as string,
          departmentName,
          departmentColor: (department.color as string | null) ?? null,
          departmentDescription: (department.description as string | null) ?? null,
          groupContactId: row.id as string,
          groupName: (row.full_name as string | null) ?? null,
          groupStatus: (row.status as string | null) ?? null,
          linkSource: "name_match",
        },
      }
    }
    return { success: true, pair: null }
  }

  if ((byName || []).length === 1) {
    const row = byName![0]
    return {
      success: true,
      pair: {
        departmentId: department.id as string,
        departmentName,
        departmentColor: (department.color as string | null) ?? null,
        departmentDescription: (department.description as string | null) ?? null,
        groupContactId: row.id as string,
        groupName: (row.full_name as string | null) ?? null,
        groupStatus: (row.status as string | null) ?? null,
        linkSource: "name_match",
      },
    }
  }

  return { success: true, pair: null }
}

export async function findDepartmentForGivingGroupAction(
  groupContactId: string
): Promise<
  | { success: true; pair: DepartmentGivingPair | null }
  | { success: false; error: string }
> {
  const canView =
    (await hasPermission(PERMISSIONS.STAFF_VIEW)) ||
    (await hasPermission(PERMISSIONS.CONTACTS_VIEW))
  if (!canView) {
    return { success: false, error: "Not authorized." }
  }

  const organizationId = await requireOrg()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()

  let group: {
    id: string
    full_name: string | null
    status: string | null
    linked_department_id?: string | null
    giving_group_kind?: string | null
  } | null = null

  const withCategory = await supabase
    .from("contacts")
    .select("id, full_name, status, linked_department_id, giving_group_kind, contact_type")
    .eq("organization_id", organizationId)
    .eq("id", groupContactId)
    .maybeSingle()

  if (withCategory.error && isMissingColumnError(withCategory.error)) {
    const basic = await supabase
      .from("contacts")
      .select("id, full_name, status, contact_type")
      .eq("organization_id", organizationId)
      .eq("id", groupContactId)
      .maybeSingle()
    if (basic.error || !basic.data || basic.data.contact_type !== "group") {
      return { success: false, error: "Giving group not found." }
    }
    group = basic.data
  } else if (withCategory.error || !withCategory.data || withCategory.data.contact_type !== "group") {
    return { success: false, error: "Giving group not found." }
  } else {
    group = withCategory.data
  }

  const groupName = (group.full_name as string | null)?.trim() || "Group"

  if (group.linked_department_id) {
    const { data: department } = await supabase
      .from("departments")
      .select("id, name, description, color")
      .eq("organization_id", organizationId)
      .eq("id", group.linked_department_id)
      .maybeSingle()

    if (department) {
      return {
        success: true,
        pair: {
          departmentId: department.id as string,
          departmentName: (department.name as string) || "Department",
          departmentColor: (department.color as string | null) ?? null,
          departmentDescription: (department.description as string | null) ?? null,
          groupContactId: group.id as string,
          groupName: group.full_name,
          groupStatus: group.status,
          linkSource: "linked",
        },
      }
    }
  }

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, description, color")
    .eq("organization_id", organizationId)
    .ilike("name", groupName)
    .limit(2)

  if ((departments || []).length === 1) {
    const department = departments![0]
    return {
      success: true,
      pair: {
        departmentId: department.id as string,
        departmentName: (department.name as string) || "Department",
        departmentColor: (department.color as string | null) ?? null,
        departmentDescription: (department.description as string | null) ?? null,
        groupContactId: group.id as string,
        groupName: group.full_name,
        groupStatus: group.status,
        linkSource: "name_match",
      },
    }
  }

  return { success: true, pair: null }
}

/** Persist name-match as an explicit department link so both areas stay in sync. */
export async function ensureDepartmentGivingLinkAction(input: {
  departmentId: string
  groupContactId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const canManage =
    (await hasPermission(PERMISSIONS.CONTACTS_MANAGE)) ||
    (await hasPermission(PERMISSIONS.STAFF_MANAGE))
  if (!canManage) {
    return { success: false, error: "Not authorized to link department and giving group." }
  }

  const organizationId = await requireOrg()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from("contacts")
    .update({
      giving_group_kind: "department",
      linked_department_id: input.departmentId,
      linked_hr_team_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", input.groupContactId)
    .eq("contact_type", "group")

  if (error) {
    if (isMissingColumnError(error)) {
      return {
        success: false,
        error: "Run scripts/167_giving_group_category.sql to enable department linking.",
      }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}
