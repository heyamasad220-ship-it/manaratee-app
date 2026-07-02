import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isEntityContactType,
  normalizeContactRecordType,
  type ContactRecordType,
} from "@/lib/contacts/contact-constants"

export type PledgeMemberGroup = {
  id: string
  groupName: string | null
}

export type PledgeDonorContextFields = {
  contactType: ContactRecordType | null
  primaryContactName: string | null
  memberGroups: PledgeMemberGroup[]
}

export type PledgeWithDonorContext = {
  contactId: string | null
  donorId: string | null
} & PledgeDonorContextFields

export const PLEDGE_GROUP_BADGE_COLORS = [
  "border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100",
  "border-transparent bg-violet-100 text-violet-700 hover:bg-violet-100",
  "border-transparent bg-teal-100 text-teal-700 hover:bg-teal-100",
  "border-transparent bg-rose-100 text-rose-700 hover:bg-rose-100",
  "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100",
  "border-transparent bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
] as const

export function pledgeGroupBadgeClassName(index: number) {
  return PLEDGE_GROUP_BADGE_COLORS[index % PLEDGE_GROUP_BADGE_COLORS.length]
}

export function emptyPledgeDonorContext(): PledgeDonorContextFields {
  return {
    contactType: null,
    primaryContactName: null,
    memberGroups: [],
  }
}

export async function attachPledgeDonorContext<T extends PledgeWithDonorContext>(
  supabase: SupabaseClient,
  organizationId: string,
  pledges: T[]
): Promise<T[]> {
  if (pledges.length === 0) return pledges

  for (const pledge of pledges) {
    pledge.contactType = null
    pledge.primaryContactName = null
    pledge.memberGroups = []
  }

  const contactIds = Array.from(
    new Set(pledges.map((pledge) => pledge.contactId).filter(Boolean))
  ) as string[]

  const donorIdsNeedingContact = Array.from(
    new Set(
      pledges
        .filter((pledge) => !pledge.contactId && pledge.donorId)
        .map((pledge) => pledge.donorId as string)
    )
  )

  const donorTypeById = new Map<string, string | null>()
  const contactIdByDonorId = new Map<string, string>()

  if (donorIdsNeedingContact.length > 0) {
    const { data: donorRows } = await supabase
      .from("donors")
      .select("id, donor_type, contact_id")
      .eq("organization_id", organizationId)
      .in("id", donorIdsNeedingContact)

    for (const row of donorRows || []) {
      const donorId = row.id as string
      donorTypeById.set(donorId, (row.donor_type as string | null) ?? null)
      const linkedContactId = row.contact_id as string | null
      if (linkedContactId) {
        contactIdByDonorId.set(donorId, linkedContactId)
        if (!contactIds.includes(linkedContactId)) {
          contactIds.push(linkedContactId)
        }
      }
    }

    for (const pledge of pledges) {
      if (!pledge.contactId && pledge.donorId) {
        const linkedContactId = contactIdByDonorId.get(pledge.donorId)
        if (linkedContactId) {
          pledge.contactId = linkedContactId
        }
      }
    }
  }

  const contactTypeById = new Map<string, ContactRecordType>()
  const primaryContactNameById = new Map<string, string | null>()

  if (contactIds.length > 0) {
    const { data: contactRows } = await supabase
      .from("contacts")
      .select("id, contact_type, primary_contact_name")
      .eq("organization_id", organizationId)
      .in("id", contactIds)

    for (const row of contactRows || []) {
      const contactId = row.id as string
      contactTypeById.set(
        contactId,
        normalizeContactRecordType(row.contact_type as string | null)
      )
      primaryContactNameById.set(
        contactId,
        (row.primary_contact_name as string | null)?.trim() || null
      )
    }
  }

  const individualContactIds = contactIds.filter(
    (contactId) => contactTypeById.get(contactId) === "individual"
  )

  const groupsByMember = new Map<string, PledgeMemberGroup[]>()

  if (individualContactIds.length > 0) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("contact_group_members")
      .select("member_contact_id, group_contact_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .in("member_contact_id", individualContactIds)
      .order("created_at", { ascending: true })

    if (!membershipError) {
      const groupContactIds = Array.from(
        new Set(
          (membershipRows || [])
            .map((row) => row.group_contact_id as string | null)
            .filter(Boolean)
        )
      ) as string[]

      const groupNameById = new Map<string, string | null>()

      if (groupContactIds.length > 0) {
        const { data: groupRows } = await supabase
          .from("contacts")
          .select("id, full_name")
          .eq("organization_id", organizationId)
          .in("id", groupContactIds)

        for (const row of groupRows || []) {
          groupNameById.set(row.id as string, (row.full_name as string | null) ?? null)
        }
      }

      for (const row of membershipRows || []) {
        const memberContactId = row.member_contact_id as string
        const groupContactId = row.group_contact_id as string
        const existing = groupsByMember.get(memberContactId) ?? []
        existing.push({
          id: groupContactId,
          groupName: groupNameById.get(groupContactId) ?? null,
        })
        groupsByMember.set(memberContactId, existing)
      }
    }
  }

  for (const pledge of pledges) {
    if (pledge.contactId) {
      const contactType = contactTypeById.get(pledge.contactId) ?? "individual"
      pledge.contactType = contactType
      pledge.primaryContactName = primaryContactNameById.get(pledge.contactId) ?? null

      if (contactType === "individual") {
        pledge.memberGroups = groupsByMember.get(pledge.contactId) ?? []
      }
      continue
    }

    if (pledge.donorId && donorTypeById.get(pledge.donorId) === "organization") {
      pledge.contactType = "organization"
    }
  }

  return pledges
}

export function showsPrimaryContactSubline(contactType: ContactRecordType | null) {
  return isEntityContactType(contactType)
}
