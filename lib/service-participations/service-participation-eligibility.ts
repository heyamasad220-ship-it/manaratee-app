import type { SupabaseClient } from "@supabase/supabase-js"

import type { ServiceParticipationType } from "./service-participation-types"

export type ContactServiceEligibility = {
  contactId: string
  isVolunteer: boolean
  isChildcareProvider: boolean
  isVendor: boolean
  participationTypes: ServiceParticipationType[]
}

export async function resolveContactIdForAuthUser(
  supabase: SupabaseClient,
  organizationId: string,
  authUserId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  return (data?.id as string | null) ?? null
}

export async function getContactServiceEligibility(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string
): Promise<ContactServiceEligibility> {
  const participationTypes: ServiceParticipationType[] = []

  const { data: volunteerRow } = await supabase
    .from("volunteers")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  const isVolunteer =
    volunteerRow?.status === "active" ||
    (await hasContactRole(supabase, organizationId, contactId, "volunteer"))

  if (isVolunteer) {
    participationTypes.push("volunteer")
  }

  const { count: providerCount } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("application_type", "childcare_provider")
    .eq("status", "approved")

  const isChildcareProvider =
    (providerCount ?? 0) > 0 ||
    (await hasContactRole(supabase, organizationId, contactId, "childcare_provider"))

  if (isChildcareProvider) {
    participationTypes.push("childcare_provider")
  }

  const { count: vendorAppCount } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("application_type", "vendor")
    .eq("status", "approved")

  const isVendor =
    (vendorAppCount ?? 0) > 0 ||
    (await hasContactRole(supabase, organizationId, contactId, "vendor"))

  if (isVendor) {
    participationTypes.push("vendor")
  }

  return {
    contactId,
    isVolunteer,
    isChildcareProvider,
    isVendor,
    participationTypes,
  }
}

async function hasContactRole(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  role: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("contact_roles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", role)

  if (error?.code === "42P01") {
    return false
  }

  return (count ?? 0) > 0
}

export function opportunityNeedsType(
  opportunity: {
    requires_volunteers?: boolean | null
    requires_childcare?: boolean | null
    requires_vendors?: boolean | null
  },
  type: ServiceParticipationType
): boolean {
  switch (type) {
    case "volunteer":
      return opportunity.requires_volunteers === true
    case "childcare_provider":
      return opportunity.requires_childcare === true
    case "vendor":
      return opportunity.requires_vendors === true
    default:
      return false
  }
}

export function eligibleTypesForOpportunity(
  opportunity: {
    requires_volunteers?: boolean | null
    requires_childcare?: boolean | null
    requires_vendors?: boolean | null
  },
  eligibility: ContactServiceEligibility
): ServiceParticipationType[] {
  return eligibility.participationTypes.filter((type) =>
    opportunityNeedsType(opportunity, type)
  )
}
