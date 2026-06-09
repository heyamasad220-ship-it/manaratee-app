"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  AUTO_REMOVABLE_DERIVED_ROLES,
  type DerivedAffiliationRole,
} from "@/lib/contacts/contact-affiliation-rules"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"

type RoleRow = {
  id: string
  role: string
  is_manual: boolean
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

  if (donorIds.length > 0) {
    derived.add("donor")
  }

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

  return derived
}

async function upsertDerivedRole(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  role: DerivedAffiliationRole,
  existingRows: RoleRow[]
) {
  const existing = existingRows.find((row) => row.role === role)
  if (existing) return

  const { error } = await supabase.from("contact_roles").insert({
    organization_id: organizationId,
    contact_id: contactId,
    role,
    is_manual: false,
  })

  if (error && error.code !== "23505") {
    throw new Error(error.message || `Could not add ${role} affiliation`)
  }
}

function revalidateAffiliationPaths() {
  revalidatePath("/contacts")
  revalidatePath("/contacts/settings")
  revalidatePath("/contacts/people")
  revalidatePath("/contacts/organizations")
  revalidatePath("/donations/donors")
  revalidatePath("/vendor-hub/vendors")
  revalidatePath("/workforce/childcare")
  revalidatePath("/workforce/employees")
  revalidatePath("/workforce/volunteers")
  revalidatePath("/membership/members")
}

/**
 * Reconcile contact_roles with activity-derived affiliations.
 * Manual overrides (is_manual=true) are preserved unless staff edits them directly.
 */
export async function syncContactAffiliations(
  contactId: string,
  organizationIdInput?: string | null,
  supabaseClient?: SupabaseClient
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  const organizationId = organizationIdInput ?? (await getSelectedOrganizationId())

  if (!organizationId || !contactId) return

  const derived = await computeDerivedAffiliations(organizationId, contactId, supabase)

  if (derived.has("donor")) {
    await ensureDonorExtensionForContact(organizationId, contactId, supabase)
  }

  let existingRows: RoleRow[] = []
  const { data: roleRows, error: roleError } = await supabase
    .from("contact_roles")
    .select("id, role, is_manual")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)

  if (roleError) {
    if (roleError.code === "42703") {
      const { data: legacyRows, error: legacyError } = await supabase
        .from("contact_roles")
        .select("id, role")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)

      if (legacyError) {
        throw new Error(legacyError.message || "Could not load contact affiliations")
      }

      existingRows = (legacyRows || []).map((row) => ({
        id: row.id as string,
        role: row.role as string,
        is_manual: false,
      }))
    } else {
      throw new Error(roleError.message || "Could not load contact affiliations")
    }
  } else {
    existingRows = (roleRows || []) as RoleRow[]
  }

  for (const role of derived) {
    await upsertDerivedRole(supabase, organizationId, contactId, role, existingRows)
  }

  for (const row of existingRows) {
    if (row.is_manual) continue
    if (!AUTO_REMOVABLE_DERIVED_ROLES.includes(row.role as DerivedAffiliationRole)) {
      continue
    }
    if (derived.has(row.role as DerivedAffiliationRole)) {
      continue
    }

    const { error: deleteError } = await supabase
      .from("contact_roles")
      .delete()
      .eq("id", row.id)

    if (deleteError) {
      throw new Error(deleteError.message || "Could not remove outdated affiliation")
    }
  }

  revalidateAffiliationPaths()
  revalidatePath(`/contacts/${contactId}`)
}

/** Call after a donation payment is recorded or matched. */
export async function handleDonationAffiliationSync(input: {
  contactId?: string | null
  donorId?: string | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
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

  await ensureDonorExtensionForContact(organizationId, contactId, supabase)
  await syncContactAffiliations(contactId, organizationId, supabase)
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
  await syncContactAffiliations(contactId)
}
