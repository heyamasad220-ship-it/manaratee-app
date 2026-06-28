"use server"

import { revalidatePath } from "next/cache"

import {
  fetchGroupMembers,
  formatGroupMemberActionError,
  isMissingGroupMembersTable,
  loadGroupContactRecord,
  loadMemberContactsByIds,
  upsertActiveGroupMember,
} from "@/lib/contacts/group-membership-data"
import type { ContactGroupSummary } from "@/lib/contacts/group-member-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

async function requireContactsViewAccess() {
  const canView = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!canView) {
    return { ok: false as const, error: "You do not have permission to view contacts." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false as const, error: "No organization selected." }
  }

  const supabase = createServiceRoleClient()
  return { ok: true as const, supabase, organizationId }
}

async function requireContactsManageAccess() {
  const canManage = await hasPermission(PERMISSIONS.CONTACTS_MANAGE)
  if (!canManage) {
    return { ok: false as const, error: "You do not have permission to manage contacts." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false as const, error: "No organization selected." }
  }

  const supabase = createServiceRoleClient()
  return { ok: true as const, supabase, organizationId }
}

export async function fetchContactGroupsAction(memberContactId: string) {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("contact_group_members")
    .select("id, group_contact_id, status")
    .eq("organization_id", access.organizationId)
    .eq("member_contact_id", memberContactId)
    .eq("status", "active")
    .order("created_at", { ascending: true })

  if (error) {
    if (isMissingGroupMembersTable(error)) {
      return { success: true as const, groups: [] as ContactGroupSummary[] }
    }
    return {
      success: false as const,
      error: formatGroupMemberActionError(error, "Could not load linked groups."),
    }
  }

  const groupContactIds = (data || [])
    .map((row) => row.group_contact_id as string | null)
    .filter((id): id is string => Boolean(id))

  const groupContacts = await loadMemberContactsByIds(
    access.supabase,
    access.organizationId,
    groupContactIds
  )

  const groups: ContactGroupSummary[] = (data || [])
    .map((row) => {
      const groupContactId = row.group_contact_id as string
      const groupRecord = groupContacts.get(groupContactId)
      if (!groupRecord) return null
      return {
        id: groupContactId,
        groupName: groupRecord.full_name,
        memberStatus: row.status as string,
      }
    })
    .filter((row): row is ContactGroupSummary => Boolean(row))

  return { success: true as const, groups }
}

export async function searchGroupsForContactMemberAction(search: string, limit = 30) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("contacts")
    .select("id, full_name, primary_contact_name")
    .eq("organization_id", access.organizationId)
    .eq("contact_type", "group")
    .order("full_name", { ascending: true })
    .limit(Math.min(limit, 50))

  if (search.trim()) {
    const term = `%${escapeIlike(search.trim())}%`
    query = query.or(`full_name.ilike.${term},primary_contact_name.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    groups: (data || []).map((row) => ({
      contactId: row.id as string,
      full_name: row.full_name as string | null,
      primary_contact_name: row.primary_contact_name as string | null,
    })),
  }
}

export async function searchIndividualsForGroupMemberAction(search: string, limit = 30) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", access.organizationId)
    .eq("contact_type", "individual")
    .order("full_name", { ascending: true })
    .limit(Math.min(limit, 50))

  if (search.trim()) {
    const term = `%${escapeIlike(search.trim())}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    contacts: (data || []).map((row) => ({
      contactId: row.id as string,
      full_name: row.full_name as string | null,
      email: row.email as string | null,
      phone: row.phone as string | null,
    })),
  }
}

export async function addGroupMemberAction(input: {
  groupContactId: string
  memberContactId: string
  notes?: string | null
}) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const group = await loadGroupContactRecord(
    access.supabase,
    access.organizationId,
    input.groupContactId
  )
  if (!group.ok) return { success: false as const, error: group.error }

  const { data: member, error: memberError } = await access.supabase
    .from("contacts")
    .select("id, contact_type")
    .eq("organization_id", access.organizationId)
    .eq("id", input.memberContactId)
    .maybeSingle()

  if (memberError || !member) {
    return { success: false as const, error: "Member contact was not found." }
  }

  if (member.contact_type !== "individual") {
    return { success: false as const, error: "Only individual contacts can be added as group members." }
  }

  const membership = await upsertActiveGroupMember(
    access.supabase,
    access.organizationId,
    input.groupContactId,
    input.memberContactId
  )

  if (!membership.ok) {
    return { success: false as const, error: membership.error }
  }

  revalidatePath(contactProfileHref(input.groupContactId))
  revalidatePath(contactProfileHref(input.memberContactId))
  revalidatePath("/contacts/groups")
  return { success: true as const }
}

export async function removeGroupMemberAction(membershipId: string) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: row, error: loadError } = await access.supabase
    .from("contact_group_members")
    .select("id, group_contact_id, member_contact_id")
    .eq("organization_id", access.organizationId)
    .eq("id", membershipId)
    .maybeSingle()

  if (loadError || !row) {
    return { success: false as const, error: loadError?.message || "Membership not found." }
  }

  const { error } = await access.supabase
    .from("contact_group_members")
    .update({ status: "inactive" })
    .eq("id", membershipId)
    .eq("organization_id", access.organizationId)

  if (error) return { success: false as const, error: error.message }

  revalidatePath(contactProfileHref(row.group_contact_id as string))
  revalidatePath(contactProfileHref(row.member_contact_id as string))
  return { success: true as const }
}

export async function fetchGroupGivingRollupAction(groupContactId: string) {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const membersResult = await fetchGroupMembers(
    access.supabase,
    access.organizationId,
    groupContactId
  )
  if (!membersResult.success) return membersResult

  let groupDirectTotal = 0
  let groupDirectCount = 0
  let groupDirectLast: string | null = null

  const { data: groupDonor } = await access.supabase
    .from("donors")
    .select("id")
    .eq("organization_id", access.organizationId)
    .eq("contact_id", groupContactId)
    .maybeSingle()

  if (groupDonor?.id) {
    const { data: summary } = await access.supabase
      .from("donor_summary_view")
      .select("total_donations, donation_count, last_donation_date")
      .eq("id", groupDonor.id)
      .maybeSingle()

    groupDirectTotal = Number(summary?.total_donations || 0)
    groupDirectCount = Number(summary?.donation_count || 0)
    groupDirectLast = (summary?.last_donation_date as string | null) ?? null
  }

  const memberIndividualTotal = membersResult.members.reduce(
    (sum, member) => sum + member.totalDonations,
    0
  )
  const memberIndividualCount = membersResult.members.reduce(
    (sum, member) => sum + member.donationCount,
    0
  )

  return {
    success: true as const,
    rollup: {
      groupDirectTotal,
      groupDirectCount,
      groupDirectLast,
      memberIndividualTotal,
      memberIndividualCount,
      combinedTotal: groupDirectTotal + memberIndividualTotal,
      memberCount: membersResult.members.length,
      members: membersResult.members,
    },
  }
}
