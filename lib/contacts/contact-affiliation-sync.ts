"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  PROGRAM_PARTICIPANT_TERMINAL_STATUSES,
  VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES,
  type DerivedAffiliationRole,
} from "@/lib/contacts/contact-affiliation-rules"
import { loadAffiliationAutoSyncFlags } from "@/lib/contacts/contact-affiliation-settings"
import { syncContactDiscountTags } from "@/lib/contacts/contact-discount-tag-sync"
import { syncFullTimeEmployeeBenefitTag } from "@/lib/benefits/employee-benefit"

function isMissingDbColumnError(
  error: { code?: string; message?: string } | null,
  columnName: string
) {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  const message = (error.message || "").toLowerCase()
  return message.includes(columnName.toLowerCase()) && message.includes("does not exist")
}

export async function computeDerivedAffiliations(
  organizationId: string,
  contactId: string,
  supabaseClient?: SupabaseClient
): Promise<Set<DerivedAffiliationRole>> {
  const supabase = supabaseClient || (await createClient())
  const derived = new Set<DerivedAffiliationRole>()

  const { data: activeMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .maybeSingle()

  if (activeMembership) {
    derived.add("member")
  }

  const { data: donorRows } = await supabase
    .from("donors")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)

  const donorIds = (donorRows || []).map((row) => row.id as string)

  const { count: paymentByContactCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)

  if ((paymentByContactCount ?? 0) > 0) {
    derived.add("donor")
  }

  if (!derived.has("donor") && donorIds.length > 0) {
    const { count: paymentByDonorCount } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("donor_id", donorIds)

    if ((paymentByDonorCount ?? 0) > 0) {
      derived.add("donor")
    }
  }

  const { data: volunteerRow } = await supabase
    .from("volunteers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle()

  if (volunteerRow) {
    derived.add("volunteer")
  }

  const { data: activeStaff } = await supabase
    .from("staff")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .maybeSingle()

  if (activeStaff) {
    derived.add("employee")
  }

  const { data: approvedVendorApplication } = await supabase
    .from("applications")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("application_type", "vendor")
    .eq("status", "approved")
    .limit(1)
    .maybeSingle()

  if (approvedVendorApplication) {
    derived.add("vendor")
  }

  const { data: vendorRow } = await supabase
    .from("vendors")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle()

  if (vendorRow) {
    derived.add("vendor")
  }

  const { data: approvedChildcareApplication } = await supabase
    .from("applications")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("application_type", "childcare_provider")
    .eq("status", "approved")
    .limit(1)
    .maybeSingle()

  if (approvedChildcareApplication) {
    derived.add("childcare_provider")
  }

  const terminalStatuses = PROGRAM_PARTICIPANT_TERMINAL_STATUSES.join(",")
  const { count: programAsParticipantCount } = await supabase
    .from("program_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("participant_contact_id", contactId)
    .not("status", "in", `(${terminalStatuses})`)

  const { count: programAsRegistrantCount } = await supabase
    .from("program_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("registrant_contact_id", contactId)
    .not("status", "in", `(${terminalStatuses})`)

  if (
    (programAsParticipantCount ?? 0) > 0 ||
    (programAsRegistrantCount ?? 0) > 0
  ) {
    derived.add("program_participant")
  }

  const { count: completedTicketOrderCount } = await supabase
    .from("ticket_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("status", "completed")

  const excludedRentalStatuses = VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES.join(",")
  let venueRentalCount = 0
  const venueRentalResult = await supabase
    .from("venue_rentals")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("billing_contact_id", contactId)
    .not("status", "in", `(${excludedRentalStatuses})`)

  if (isMissingDbColumnError(venueRentalResult.error, "billing_contact_id")) {
    venueRentalCount = 0
  } else if (venueRentalResult.error) {
    console.warn("Could not load venue rental customer affiliations:", venueRentalResult.error.message)
    venueRentalCount = 0
  } else {
    venueRentalCount = venueRentalResult.count ?? 0
  }

  if ((completedTicketOrderCount ?? 0) > 0 || venueRentalCount > 0) {
    derived.add("customer")
  }

  const autoSyncFlags = await loadAffiliationAutoSyncFlags(organizationId, supabase)
  for (const role of [...derived]) {
    if (!autoSyncFlags.get(role)) {
      derived.delete(role)
    }
  }

  return derived
}

function revalidateAffiliationPaths() {
  revalidatePath("/contacts")
  revalidatePath("/contacts/settings")
  revalidatePath("/contacts/people")
  revalidatePath("/contacts/organizations")
  revalidatePath("/donations/donors")
  revalidatePath("/vendor-hub/network/vendors")
  revalidatePath("/workforce/childcare")
  revalidatePath("/workforce/employees")
  revalidatePath("/workforce/volunteers")
  revalidatePath("/membership/members")
}

/**
 * Reconcile contact_roles with activity-derived affiliations.
 * Manual overrides (is_manual=true) are preserved unless staff edits them directly.
 * Authoritative logic lives in `sync_contact_affiliations` (SECURITY DEFINER RPC).
 */
export async function syncContactAffiliations(
  contactId: string,
  organizationIdInput?: string | null,
  supabaseClient?: SupabaseClient,
  revalidate = true
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  const organizationId = organizationIdInput ?? (await getSelectedOrganizationId())

  if (!organizationId || !contactId) return

  const { error } = await supabase.rpc("sync_contact_affiliations", {
    p_organization_id: organizationId,
    p_contact_id: contactId,
  })

  if (error) {
    if (isMissingDbColumnError(error, "billing_contact_id")) {
      console.warn(
        "sync_contact_affiliations skipped: venue_rentals.billing_contact_id is missing. Run scripts/147_venue_rentals_billing_contact_id.sql."
      )
      return
    }
    throw new Error(error.message || "Could not sync contact affiliations")
  }

  await syncContactDiscountTags(contactId, organizationId, supabase)
  await syncFullTimeEmployeeBenefitTag(contactId, organizationId, supabase)

  if (revalidate) {
    revalidateAffiliationPaths()
    revalidatePath(`/contacts/${contactId}`)
  }
}

export type HandleDonationAffiliationSyncInput = {
  contactId?: string | null
  donorId?: string | null
  /** Required for webhook/service-role callers without a staff session. */
  organizationId?: string | null
  /** Service-role or server Supabase client (e.g. Stripe webhooks). */
  supabaseClient?: SupabaseClient
}

/**
 * Call after a donation payment is recorded or matched.
 *
 * Staff UI callers may omit `organizationId` and `supabaseClient` (selected org session is used).
 * Webhook and background jobs must pass explicit `organizationId` and `supabaseClient`.
 */
export async function handleDonationAffiliationSync(
  input: HandleDonationAffiliationSyncInput
) {
  const supabase = input.supabaseClient ?? (await createClient())
  const organizationId =
    input.organizationId ?? (await getSelectedOrganizationId())
  if (!organizationId) return

  let contactId = input.contactId ?? null

  if (!contactId && input.donorId) {
    const { data: donor } = await supabase
      .from("donors")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .eq("id", input.donorId)
      .maybeSingle()

    contactId = (donor?.contact_id as string | null) ?? null
  }

  if (!contactId) return

  await syncContactAffiliations(contactId, organizationId, supabase)
}

export type WebhookDonationAffiliationSyncInput = {
  organizationId: string
  supabaseClient: SupabaseClient
  contactId?: string | null
  donorId?: string | null
}

/**
 * Stripe webhooks and other service-role jobs must use this entry point.
 * Requires explicit organizationId and service-role client — never uses session cookies.
 */
export async function syncDonationAffiliationFromWebhook(
  input: WebhookDonationAffiliationSyncInput
): Promise<void> {
  const organizationId = input.organizationId?.trim()
  if (!organizationId) {
    throw new Error("Webhook donation affiliation sync requires organizationId")
  }
  if (!input.supabaseClient) {
    throw new Error("Webhook donation affiliation sync requires supabaseClient")
  }

  await handleDonationAffiliationSync({
    organizationId,
    supabaseClient: input.supabaseClient,
    contactId: input.contactId,
    donorId: input.donorId,
  })
}

/** Call after staff records change for a linked contact. */
export async function syncContactAffiliationsForStaff(staffId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return

  const { data: staff } = await supabase
    .from("staff")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("id", staffId)
    .maybeSingle()

  const contactId = staff?.contact_id as string | null
  if (contactId) {
    await syncContactAffiliations(contactId, organizationId, supabase)
  }
}

/** Refresh affiliations when opening a contact profile. */
export async function refreshContactAffiliations(contactId: string) {
  await syncContactAffiliations(contactId, undefined, undefined, false)
}
