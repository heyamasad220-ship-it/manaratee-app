"use server"

import { revalidatePath } from "next/cache"

import { executeContactMerge, previewContactMerge } from "@/lib/contacts/contact-merge"
import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { getContactRecordTypeLabel, normalizeContactRecordType } from "@/lib/contacts/contact-constants"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ContactMergeSearchResult = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  contact_type: string | null
  primary_contact_name: string | null
  recordTypeLabel: string
  paymentCount: number
  pledgeCount: number
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (error && typeof error === "object") {
    const record = error as { message?: string; code?: string; details?: string }
    if (record.message?.trim()) return record.message
    if (record.details?.trim()) return record.details
    if (record.code) return `${fallback} (${record.code})`
  }

  return fallback
}

async function requireContactsManageAccess() {
  const canManage = await hasPermission(PERMISSIONS.CONTACTS_MANAGE)
  if (!canManage) {
    return { ok: false as const, error: "You do not have permission to merge contacts." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false as const, error: "No organization selected." }
  }

  const supabase = createServiceRoleClient()
  return { ok: true as const, supabase, organizationId }
}

async function countPaymentsForContacts(
  supabase: SupabaseClient,
  orgId: string,
  contactIds: string[]
) {
  const counts = new Map<string, number>()
  if (contactIds.length === 0) return counts

  const { data, error } = await supabase
    .from("payments")
    .select("contact_id")
    .eq("organization_id", orgId)
    .in("contact_id", contactIds)

  if (error) return counts

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    counts.set(contactId, (counts.get(contactId) || 0) + 1)
  }

  return counts
}

async function countPledgesForContacts(
  supabase: SupabaseClient,
  orgId: string,
  contactIds: string[]
) {
  const counts = new Map<string, number>()
  if (contactIds.length === 0) return counts

  const { data: donors, error: donorError } = await supabase
    .from("donors")
    .select("id, contact_id")
    .eq("organization_id", orgId)
    .in("contact_id", contactIds)

  if (donorError || !donors?.length) return counts

  const donorIdByContactId = new Map<string, string>()
  for (const donor of donors) {
    if (donor.contact_id && donor.id) {
      donorIdByContactId.set(donor.contact_id as string, donor.id as string)
    }
  }

  const donorIds = [...new Set(donorIdByContactId.values())]
  if (donorIds.length === 0) return counts

  const { data: pledges, error: pledgeError } = await supabase
    .from("pledges")
    .select("donor_id")
    .eq("organization_id", orgId)
    .in("donor_id", donorIds)

  if (pledgeError) return counts

  const pledgeCountByDonorId = new Map<string, number>()
  for (const pledge of pledges || []) {
    const donorId = pledge.donor_id as string | null
    if (!donorId) continue
    pledgeCountByDonorId.set(donorId, (pledgeCountByDonorId.get(donorId) || 0) + 1)
  }

  for (const [contactId, donorId] of donorIdByContactId.entries()) {
    const pledgeCount = pledgeCountByDonorId.get(donorId) || 0
    if (pledgeCount > 0) counts.set(contactId, pledgeCount)
  }

  return counts
}

export async function searchContactsForMergeAction(input: {
  search: string
  excludeContactId?: string
  limit?: number
}) {
  try {
    const access = await requireContactsManageAccess()
    if (!access.ok) return { success: false as const, error: access.error }

    const term = input.search.trim()
    if (term.length < 2) {
      return { success: true as const, contacts: [] as ContactMergeSearchResult[] }
    }

    const limit = Math.min(input.limit ?? 20, 50)
    const pattern = `%${escapeIlike(term)}%`

  let query = access.supabase
    .from("contacts")
    .select("id, full_name, email, phone, contact_type, primary_contact_name")
    .eq("organization_id", access.organizationId)
    .eq("contact_type", "individual")
    .or(
        `full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},primary_contact_name.ilike.${pattern}`
      )
      .order("full_name", { ascending: true })
      .limit(limit)

    if (input.excludeContactId) {
      query = query.neq("id", input.excludeContactId)
    }

    const { data, error } = await query
    if (error) {
      return {
        success: false as const,
        error: formatActionError(error, "Could not search contacts."),
      }
    }

    const contactIds = (data || []).map((row) => row.id as string)
    const [paymentCounts, pledgeCounts] = await Promise.all([
      countPaymentsForContacts(access.supabase, access.organizationId, contactIds),
      countPledgesForContacts(access.supabase, access.organizationId, contactIds),
    ])

    const contacts: ContactMergeSearchResult[] = (data || []).map((row) => {
      const contactId = row.id as string
      return {
        id: contactId,
        full_name: row.full_name as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
        contact_type: row.contact_type as string | null,
        primary_contact_name: row.primary_contact_name as string | null,
        recordTypeLabel: getContactRecordTypeLabel(normalizeContactRecordType(row.contact_type)),
        paymentCount: paymentCounts.get(contactId) || 0,
        pledgeCount: pledgeCounts.get(contactId) || 0,
      }
    })

    return { success: true as const, contacts }
  } catch (error) {
    return {
      success: false as const,
      error: formatActionError(error, "Could not search contacts."),
    }
  }
}

export async function previewContactMergeAction(targetContactId: string, sourceContactId: string) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const preview = await previewContactMerge(
      access.supabase,
      access.organizationId,
      targetContactId,
      sourceContactId
    )

    if ("error" in preview) {
      return { success: false as const, error: preview.error }
    }

    return { success: true as const, preview }
  } catch (error) {
    return {
      success: false as const,
      error: formatActionError(error, "Could not preview contact merge."),
    }
  }
}

export async function mergeContactsAction(targetContactId: string, sourceContactId: string) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const result = await executeContactMerge(
      access.supabase,
      access.organizationId,
      targetContactId,
      sourceContactId
    )

    if ("error" in result) {
      return { success: false as const, error: result.error }
    }

    await syncContactAffiliations(targetContactId, access.organizationId, access.supabase)

    revalidatePath("/contacts")
    revalidatePath("/contacts/people")
    revalidatePath("/contacts/organizations")
    revalidatePath("/contacts/groups")
    revalidatePath(`/contacts/${targetContactId}`)
    revalidatePath("/donations")

    return { success: true as const, targetContactId, preview: result }
  } catch (error) {
    return {
      success: false as const,
      error: formatActionError(error, "Could not merge contacts."),
    }
  }
}
