"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { upsertActiveGroupMember } from "@/lib/contacts/group-membership-data"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createClient } from "@/lib/supabase/server"

export type DonationGroupPickerOption = {
  contactId: string
  full_name: string | null
  primary_contact_name: string | null
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

function formatGroupLabel(row: {
  full_name: string | null
  primary_contact_name: string | null
}) {
  return row.full_name || row.primary_contact_name || "Unnamed group"
}

async function loadGroupContact(
  supabase: SupabaseClient,
  organizationId: string,
  groupContactId: string
) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, contact_type")
    .eq("organization_id", organizationId)
    .eq("id", groupContactId)
    .maybeSingle()

  if (error || !data || data.contact_type !== "group") {
    return { ok: false as const, error: "Group not found." }
  }

  return { ok: true as const, group: data }
}

async function loadIndividualContact(
  supabase: SupabaseClient,
  organizationId: string,
  memberContactId: string
) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, contact_type")
    .eq("organization_id", organizationId)
    .eq("id", memberContactId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: "Contact not found." }
  }

  if (data.contact_type !== "individual") {
    return {
      ok: false as const,
      error: "Only individual contacts can be linked to a group on a personal gift.",
    }
  }

  return { ok: true as const, contact: data }
}

export async function searchGroupsForDonationPickerAction(search: string, limit = 30) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("contacts")
    .select("id, full_name, primary_contact_name")
    .eq("organization_id", access.orgId)
    .eq("contact_type", "group")
    .order("full_name", { ascending: true })
    .limit(Math.min(limit, 50))

  if (search.trim()) {
    const term = `%${escapeIlike(search.trim())}%`
    query = query.or(
      `full_name.ilike.${term},primary_contact_name.ilike.${term}`
    )
  }

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    groups: (data || []).map((row) => ({
      contactId: row.id as string,
      full_name: row.full_name as string | null,
      primary_contact_name: row.primary_contact_name as string | null,
      label: formatGroupLabel({
        full_name: row.full_name as string | null,
        primary_contact_name: row.primary_contact_name as string | null,
      }),
    })) satisfies Array<DonationGroupPickerOption & { label: string }>,
  }
}

export async function ensureGroupMembershipForDonationAction(input: {
  memberContactId: string
  groupContactId: string | null
}) {
  if (!input.groupContactId) {
    return { success: true as const, groupContactId: null as string | null }
  }

  const donationAccess = await requireDonationStaffAccess("manage")
  if (!donationAccess.ok) {
    const canManageContacts = await hasPermission(PERMISSIONS.CONTACTS_MANAGE)
    if (!canManageContacts) {
      return { success: false as const, error: donationAccess.error }
    }
  }

  const organizationId =
    donationAccess.ok ? donationAccess.orgId : await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const supabase = donationAccess.ok ? donationAccess.supabase : await createClient()

  const [group, member] = await Promise.all([
    loadGroupContact(supabase, organizationId, input.groupContactId),
    loadIndividualContact(supabase, organizationId, input.memberContactId),
  ])

  if (!group.ok) return { success: false as const, error: group.error }
  if (!member.ok) return { success: false as const, error: member.error }

  const membership = await upsertActiveGroupMember(
    supabase,
    organizationId,
    input.groupContactId,
    input.memberContactId
  )

  if (!membership.ok) return { success: false as const, error: membership.error }

  return { success: true as const, groupContactId: input.groupContactId }
}
