"use server"

import { revalidatePath } from "next/cache"

import { requireContactsManageAccess } from "@/lib/contacts/group-member-access"
import { donationGroupHref } from "@/lib/donations/donation-group-path"
import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import {
  normalizeGivingGroupKind,
  type GivingGroupKind,
} from "@/lib/donations/giving-group-kind"
import { getDepartments } from "@/lib/departments/department-queries"
import { fetchHrTeams } from "@/lib/hr/hr-team-actions"

function isMissingGivingGroupColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  const message = (error.message || "").toLowerCase()
  return (
    message.includes("giving_group_kind") ||
    message.includes("linked_hr_team_id") ||
    message.includes("linked_department_id")
  )
}

export async function listGivingGroupLinkOptionsAction() {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const [teams, departments] = await Promise.all([
      fetchHrTeams({ includeInactive: true }),
      getDepartments(),
    ])

    return {
      success: true as const,
      membershipGroups: teams.map((team) => ({
        id: team.id,
        name: team.name,
      })),
      departments: departments.map((department) => ({
        id: department.id as string,
        name: (department.name as string) || "Untitled department",
      })),
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load link options.",
    }
  }
}

export async function updateGivingGroupAction(input: {
  groupContactId: string
  fullName: string
  primaryContactName?: string | null
  status: string
  notes?: string | null
  givingGroupKind: GivingGroupKind
  linkedHrTeamId?: string | null
  linkedDepartmentId?: string | null
}) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const cleanName = input.fullName.trim()
  if (!cleanName) {
    return { success: false as const, error: "Group name is required." }
  }

  const kind = normalizeGivingGroupKind(input.givingGroupKind)
  const linkedHrTeamId =
    kind === "membership_group" ? input.linkedHrTeamId?.trim() || null : null
  const linkedDepartmentId =
    kind === "department" ? input.linkedDepartmentId?.trim() || null : null

  if (kind === "membership_group" && !linkedHrTeamId) {
    return {
      success: false as const,
      error: "Select the Membership Group this giving collective represents.",
    }
  }

  if (kind === "department" && !linkedDepartmentId) {
    return {
      success: false as const,
      error: "Select the Department this giving collective represents.",
    }
  }

  const { data: existing, error: loadError } = await access.supabase
    .from("contacts")
    .select("id, contact_type")
    .eq("organization_id", access.organizationId)
    .eq("id", input.groupContactId)
    .maybeSingle()

  if (loadError || !existing || existing.contact_type !== "group") {
    return { success: false as const, error: "Giving group not found." }
  }

  const basePayload = {
    full_name: cleanName,
    primary_contact_name: input.primaryContactName?.trim() || null,
    status: input.status,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const withCategoryPayload = {
    ...basePayload,
    giving_group_kind: kind,
    linked_hr_team_id: linkedHrTeamId,
    linked_department_id: linkedDepartmentId,
  }

  let { error } = await access.supabase
    .from("contacts")
    .update(withCategoryPayload)
    .eq("organization_id", access.organizationId)
    .eq("id", input.groupContactId)

  if (error && isMissingGivingGroupColumn(error)) {
    const retry = await access.supabase
      .from("contacts")
      .update(basePayload)
      .eq("organization_id", access.organizationId)
      .eq("id", input.groupContactId)
    error = retry.error
    if (!error) {
      return {
        success: false as const,
        error:
          "Group name saved, but category columns are missing. Run scripts/167_giving_group_category.sql in Supabase.",
      }
    }
  }

  if (error) {
    return { success: false as const, error: error.message || "Could not update group." }
  }

  revalidatePath(donationGroupHref(input.groupContactId))
  revalidatePath(DONATIONS_GROUP_GIVING_REPORT_PATH)
  return { success: true as const }
}

export async function createGivingGroupAction(input: { fullName: string }) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const cleanName = input.fullName.trim()
  if (!cleanName) {
    return { success: false as const, error: "Group name is required." }
  }

  const payload = {
    organization_id: access.organizationId,
    full_name: cleanName,
    contact_type: "group",
    status: "active",
    giving_group_kind: "group_donation",
    updated_at: new Date().toISOString(),
  }

  let inserted: { id: string } | null = null
  const withCategory = await access.supabase
    .from("contacts")
    .insert(payload)
    .select("id")
    .single()

  if (withCategory.error && isMissingGivingGroupColumn(withCategory.error)) {
    const { giving_group_kind: _kind, ...basePayload } = payload
    const retry = await access.supabase
      .from("contacts")
      .insert(basePayload)
      .select("id")
      .single()
    if (retry.error || !retry.data) {
      return {
        success: false as const,
        error: retry.error?.message || "Could not create group.",
      }
    }
    inserted = retry.data
  } else if (withCategory.error || !withCategory.data) {
    return {
      success: false as const,
      error: withCategory.error?.message || "Could not create group.",
    }
  } else {
    inserted = withCategory.data
  }

  revalidatePath(DONATIONS_GROUP_GIVING_REPORT_PATH)
  revalidatePath(donationGroupHref(inserted.id))
  return { success: true as const, groupContactId: inserted.id }
}
