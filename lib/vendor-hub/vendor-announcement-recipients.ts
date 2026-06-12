import type { SupabaseClient } from "@supabase/supabase-js"

import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"
import type { VendorAnnouncementAudience } from "@/lib/vendor-hub/vendor-announcement-types"

export type VendorContactRecipient = {
  contactId: string
  email: string | null
  fullName: string | null
}

export async function getApprovedVendorContactsForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<VendorContactRecipient[]> {
  const { data: approvedApps } = await supabase
    .from("applications")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
    .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
    .eq("status", "approved")
    .not("contact_id", "is", null)

  const { data: vendorRoles } = await supabase
    .from("contact_roles")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("role", "vendor")

  const contactIds = [
    ...new Set([
      ...(approvedApps ?? []).map((row) => row.contact_id as string),
      ...(vendorRoles ?? []).map((row) => row.contact_id as string),
    ]),
  ]

  if (contactIds.length === 0) {
    return []
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, full_name, company_name")
    .eq("organization_id", organizationId)
    .in("id", contactIds)

  return (contacts ?? []).map((row) => ({
    contactId: row.id as string,
    email: (row.email as string | null) ?? null,
    fullName:
      (row.company_name as string | null) ||
      (row.full_name as string | null) ||
      null,
  }))
}

export async function getEventParticipantContacts(
  supabase: SupabaseClient,
  eventId: string,
  organizationId: string
): Promise<VendorContactRecipient[]> {
  const { data: assignments } = await supabase
    .from("vendor_hub_booth_assignments")
    .select("contact_id")
    .eq("event_id", eventId)
    .not("contact_id", "is", null)
    .in("status", ["reserved", "confirmed", "assigned", "checked_in"])

  const contactIds = [
    ...new Set((assignments ?? []).map((row) => row.contact_id as string)),
  ]

  if (contactIds.length === 0) {
    return []
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, full_name, company_name")
    .eq("organization_id", organizationId)
    .in("id", contactIds)

  return (contacts ?? []).map((row) => ({
    contactId: row.id as string,
    email: (row.email as string | null) ?? null,
    fullName:
      (row.company_name as string | null) ||
      (row.full_name as string | null) ||
      null,
  }))
}

export async function resolveVendorAnnouncementRecipients(input: {
  supabase: SupabaseClient
  organizationId: string
  eventId: string
  audience: VendorAnnouncementAudience
}): Promise<VendorContactRecipient[]> {
  if (input.audience === "event_participants") {
    const participants = await getEventParticipantContacts(
      input.supabase,
      input.eventId,
      input.organizationId
    )
    if (participants.length > 0) {
      return participants
    }
  }

  return getApprovedVendorContactsForOrganization(input.supabase, input.organizationId)
}
