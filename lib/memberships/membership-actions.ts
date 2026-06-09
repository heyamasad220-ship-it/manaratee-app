"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  addMonthsToDate,
  isMembershipStatus,
  type MembershipStatus,
} from "@/lib/memberships/membership-constants"
import { syncMembershipContactRole } from "@/lib/memberships/membership-role-sync"
import { findOrCreateContact } from "@/lib/contacts/contact-actions"

import {
  MEMBERSHIP_BASE_PATH,
  MEMBERSHIP_MEMBERS_PATH,
  MEMBERSHIP_BENEFITS_PATH,
  MEMBERSHIP_SETTINGS_PATH,
} from "@/lib/memberships/membership-module-label"

function revalidateMembershipPaths(contactId?: string) {
  revalidatePath(MEMBERSHIP_BASE_PATH)
  revalidatePath(MEMBERSHIP_MEMBERS_PATH)
  revalidatePath(MEMBERSHIP_SETTINGS_PATH)
  revalidatePath("/contacts")
  revalidatePath("/contacts/members")
  if (contactId) {
    revalidatePath(`/contacts/${contactId}`)
  }
}

function normalizeDate(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || null
}

async function assertIndividualContact(
  organizationId: string,
  contactId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, contact_type")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message || "Contact not found")
  }

  if (data.contact_type === "organization") {
    throw new Error("Organization contacts cannot hold MAS memberships.")
  }
}

async function resolveEndDate(input: {
  startDate: string
  endDate?: string | null
  membershipTypeId?: string | null
  organizationId: string
}) {
  const explicitEnd = normalizeDate(input.endDate)
  if (explicitEnd) return explicitEnd

  if (!input.membershipTypeId) return null

  const supabase = await createClient()
  const { data: membershipType } = await supabase
    .from("membership_types")
    .select("default_duration_months")
    .eq("organization_id", input.organizationId)
    .eq("id", input.membershipTypeId)
    .maybeSingle()

  if (!membershipType?.default_duration_months) return null

  return addMonthsToDate(input.startDate, membershipType.default_duration_months)
}

export async function saveMembershipType(input: {
  id?: string
  name: string
  description?: string
  defaultDurationMonths?: number | null
  isActive?: boolean
  sortOrder?: number
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Membership type name is required")
  }

  const payload = {
    organization_id: organizationId,
    name,
    description: input.description?.trim() || null,
    default_duration_months: input.defaultDurationMonths ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  }

  if (input.id) {
    const { error } = await supabase
      .from("membership_types")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      throw new Error(error.message || "Could not update membership type")
    }
  } else {
    const { error } = await supabase.from("membership_types").insert(payload)
    if (error) {
      throw new Error(error.message || "Could not create membership type")
    }
  }

  revalidateMembershipPaths()
}

export async function createMembership(input: {
  contactId: string
  membershipTypeId?: string | null
  status?: MembershipStatus
  startDate: string
  endDate?: string | null
  renewalDate?: string | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const status = input.status && isMembershipStatus(input.status) ? input.status : "active"
  const startDate = normalizeDate(input.startDate) || new Date().toISOString().slice(0, 10)

  await assertIndividualContact(organizationId, input.contactId)

  if (status === "active") {
    const { data: existingActive } = await supabase
      .from("memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", input.contactId)
      .eq("status", "active")
      .maybeSingle()

    if (existingActive) {
      throw new Error("This contact already has an active membership. Update or lapse it first.")
    }
  }

  const endDate = await resolveEndDate({
    startDate,
    endDate: input.endDate,
    membershipTypeId: input.membershipTypeId,
    organizationId,
  })

  const { data, error } = await supabase
    .from("memberships")
    .insert({
      organization_id: organizationId,
      contact_id: input.contactId,
      membership_type_id: input.membershipTypeId || null,
      status,
      start_date: startDate,
      end_date: endDate,
      renewal_date: normalizeDate(input.renewalDate),
      notes: input.notes?.trim() || null,
    })
    .select("id, contact_id")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Could not create membership")
  }

  if (status === "active") {
    await syncMembershipContactRole(organizationId, input.contactId)
  }

  revalidateMembershipPaths(input.contactId)
  return data
}

export async function updateMembership(input: {
  id: string
  membershipTypeId?: string | null
  status: MembershipStatus
  startDate: string
  endDate?: string | null
  renewalDate?: string | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!isMembershipStatus(input.status)) {
    throw new Error("Invalid membership status")
  }

  const { data: existing, error: existingError } = await supabase
    .from("memberships")
    .select("id, contact_id, status")
    .eq("organization_id", organizationId)
    .eq("id", input.id)
    .maybeSingle()

  if (existingError || !existing) {
    throw new Error(existingError?.message || "Membership not found")
  }

  if (input.status === "active") {
    const { data: otherActive } = await supabase
      .from("memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", existing.contact_id)
      .eq("status", "active")
      .neq("id", input.id)
      .maybeSingle()

    if (otherActive) {
      throw new Error("Another active membership already exists for this contact.")
    }
  }

  const startDate = normalizeDate(input.startDate) || new Date().toISOString().slice(0, 10)
  const endDate = await resolveEndDate({
    startDate,
    endDate: input.endDate,
    membershipTypeId: input.membershipTypeId,
    organizationId,
  })

  const { error } = await supabase
    .from("memberships")
    .update({
      membership_type_id: input.membershipTypeId || null,
      status: input.status,
      start_date: startDate,
      end_date: endDate,
      renewal_date: normalizeDate(input.renewalDate),
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not update membership")
  }

  await syncMembershipContactRole(organizationId, existing.contact_id as string)
  revalidateMembershipPaths(existing.contact_id as string)
}

export async function lapseMembership(membershipId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: existing, error: existingError } = await supabase
    .from("memberships")
    .select("id, contact_id, start_date")
    .eq("organization_id", organizationId)
    .eq("id", membershipId)
    .maybeSingle()

  if (existingError || !existing) {
    throw new Error(existingError?.message || "Membership not found")
  }

  const { error } = await supabase
    .from("memberships")
    .update({ status: "lapsed" })
    .eq("id", membershipId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not lapse membership")
  }

  await syncMembershipContactRole(organizationId, existing.contact_id as string)
  revalidateMembershipPaths(existing.contact_id as string)
}

export async function addMemberWithMembership(input: {
  fullName: string
  email?: string
  phone?: string
  membershipTypeId?: string | null
  startDate?: string
  endDate?: string | null
  renewalDate?: string | null
  notes?: string | null
}) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { contactId } = await findOrCreateContact({
    organizationId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    contactType: "individual",
  })

  await createMembership({
    contactId,
    membershipTypeId: input.membershipTypeId,
    status: "active",
    startDate: input.startDate || new Date().toISOString().slice(0, 10),
    endDate: input.endDate,
    renewalDate: input.renewalDate,
    notes: input.notes,
  })

  return { contactId }
}

/** Idempotently grant active membership (used when customers join an organization). */
export async function ensureActiveMembershipForContact(input: {
  organizationId: string
  contactId: string
  membershipTypeName?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any
}) {
  const supabase = input.supabase || (await createClient())

  const { data: existingMembership, error: lookupError } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("contact_id", input.contactId)
    .eq("status", "active")
    .maybeSingle()

  if (lookupError?.code === "42P01") {
    const { data: existingRole } = await supabase
      .from("contact_roles")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("contact_id", input.contactId)
      .eq("role", "member")
      .maybeSingle()

    if (!existingRole) {
      await supabase.from("contact_roles").insert({
        organization_id: input.organizationId,
        contact_id: input.contactId,
        role: "member",
      })
    }
    return
  }

  if (lookupError) {
    throw new Error(lookupError.message || "Could not check membership")
  }

  if (existingMembership) {
    await syncMembershipContactRole(input.organizationId, input.contactId, supabase)
    return
  }

  let membershipTypeId: string | null = null
  const typeName = input.membershipTypeName?.trim() || "Individual"

  const { data: membershipType } = await supabase
    .from("membership_types")
    .select("id, default_duration_months")
    .eq("organization_id", input.organizationId)
    .eq("name", typeName)
    .maybeSingle()

  membershipTypeId = membershipType?.id ?? null

  const startDate = new Date().toISOString().slice(0, 10)
  const endDate = membershipTypeId
    ? await resolveEndDate({
        startDate,
        membershipTypeId,
        organizationId: input.organizationId,
      })
    : null

  const { error: insertError } = await supabase.from("memberships").insert({
    organization_id: input.organizationId,
    contact_id: input.contactId,
    membership_type_id: membershipTypeId,
    status: "active",
    start_date: startDate,
    end_date: endDate,
    notes: "Created automatically when joining organization",
  })

  if (insertError) {
    throw new Error(insertError.message || "Could not create membership")
  }

  await syncMembershipContactRole(input.organizationId, input.contactId, supabase)
}
