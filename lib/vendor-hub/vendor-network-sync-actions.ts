"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  isVendorInactiveByLastActivity,
  vendorLastActivityAt,
} from "@/lib/vendor-hub/vendor-activity"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"

/**
 * Ensure every approved org vendor application contact has the sticky `vendor` role.
 * Returns how many roles were inserted.
 */
export async function ensureVendorNetworkRolesForCurrentOrg() {
  await requireVendorHubManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected.", inserted: 0 }
  }

  const supabase = await createClient()

  const [{ data: apps, error: appsError }, { data: roles, error: rolesError }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("contact_id")
        .eq("organization_id", organizationId)
        .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
        .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
        .eq("status", "approved")
        .not("contact_id", "is", null),
      supabase
        .from("contact_roles")
        .select("contact_id")
        .eq("organization_id", organizationId)
        .eq("role", "vendor"),
    ])

  if (appsError) {
    return { success: false as const, error: appsError.message, inserted: 0 }
  }
  if (rolesError) {
    return { success: false as const, error: rolesError.message, inserted: 0 }
  }

  const withRole = new Set(
    (roles || []).map((row) => row.contact_id as string).filter(Boolean)
  )
  const missing = [
    ...new Set(
      (apps || [])
        .map((row) => row.contact_id as string | null)
        .filter((id): id is string => Boolean(id) && !withRole.has(id))
    ),
  ]

  if (missing.length === 0) {
    return { success: true as const, inserted: 0 }
  }

  const payload = missing.map((contactId) => ({
    organization_id: organizationId,
    contact_id: contactId,
    role: "vendor" as const,
  }))

  const { error: insertError } = await supabase.from("contact_roles").insert(payload)
  if (insertError) {
    let inserted = 0
    for (const row of payload) {
      const { error } = await supabase.from("contact_roles").insert(row)
      if (!error) inserted += 1
      else if (!error.message.toLowerCase().includes("duplicate")) {
        return { success: false as const, error: error.message, inserted }
      }
    }
    return { success: true as const, inserted }
  }

  return { success: true as const, inserted: missing.length }
}

/**
 * Set vendor contact status from Last Activity only (`last_activity_at`, else `created_at`).
 * Older than 2 years → inactive; otherwise → active.
 */
export async function ensureVendorInactiveStatusForCurrentOrg() {
  await requireVendorHubManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected.", updated: 0 }
  }

  const supabase = await createClient()

  const { data: roleRows, error: rolesError } = await supabase
    .from("contact_roles")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("role", "vendor")

  if (rolesError) {
    return { success: false as const, error: rolesError.message, updated: 0 }
  }

  const contactIds = [
    ...new Set(
      (roleRows || []).map((row) => row.contact_id as string).filter(Boolean)
    ),
  ]
  if (contactIds.length === 0) {
    return { success: true as const, updated: 0 }
  }

  const toInactive: string[] = []
  const toActive: string[] = []
  const chunkSize = 200
  const now = Date.now()

  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, status, last_activity_at, created_at")
      .eq("organization_id", organizationId)
      .in("id", chunk)

    if (error) {
      return { success: false as const, error: error.message, updated: 0 }
    }

    for (const contact of contacts || []) {
      const id = contact.id as string
      const current = ((contact.status as string | null) || "active").toLowerCase()
      const lastActivity = vendorLastActivityAt({
        last_activity_at: contact.last_activity_at as string | null,
        created_at: contact.created_at as string | null,
      })
      const shouldBeInactive = isVendorInactiveByLastActivity(lastActivity, now)

      if (shouldBeInactive && current !== "inactive") {
        toInactive.push(id)
      } else if (!shouldBeInactive && current !== "active") {
        toActive.push(id)
      }
    }
  }

  let updated = 0

  async function updateStatus(ids: string[], status: "active" | "inactive") {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { error } = await supabase
        .from("contacts")
        .update({ status })
        .eq("organization_id", organizationId)
        .in("id", chunk)
      if (error) return error.message
      updated += chunk.length
    }
    return null
  }

  const inactiveError = await updateStatus(toInactive, "inactive")
  if (inactiveError) {
    return { success: false as const, error: inactiveError, updated }
  }
  const activeError = await updateStatus(toActive, "active")
  if (activeError) {
    return { success: false as const, error: activeError, updated }
  }

  // Do not revalidatePath here — these helpers run during page render.
  return { success: true as const, updated }
}

/** Distinct contacts in the Vendor Network (have vendor role). */
export async function countVendorNetworkContacts(organizationId?: string) {
  const orgId = organizationId || (await getSelectedOrganizationId())
  if (!orgId) return 0

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("contact_roles")
    .select("contact_id")
    .eq("organization_id", orgId)
    .eq("role", "vendor")

  if (error) {
    console.error("countVendorNetworkContacts:", error.message)
    return 0
  }

  return new Set((data || []).map((row) => row.contact_id as string).filter(Boolean)).size
}

/**
 * Vendor Network contacts whose Last Activity is within 2 years
 * (`last_activity_at`, else `created_at`).
 */
export async function countActiveVendorNetworkContacts(organizationId?: string) {
  const orgId = organizationId || (await getSelectedOrganizationId())
  if (!orgId) return 0

  const supabase = await createClient()
  const { data: roleRows, error: rolesError } = await supabase
    .from("contact_roles")
    .select("contact_id")
    .eq("organization_id", orgId)
    .eq("role", "vendor")

  if (rolesError) {
    console.error("countActiveVendorNetworkContacts roles:", rolesError.message)
    return 0
  }

  const contactIds = [
    ...new Set(
      (roleRows || []).map((row) => row.contact_id as string).filter(Boolean)
    ),
  ]
  if (contactIds.length === 0) return 0

  const now = Date.now()
  let active = 0
  const chunkSize = 200

  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, last_activity_at, created_at")
      .eq("organization_id", orgId)
      .in("id", chunk)

    if (error) {
      console.error("countActiveVendorNetworkContacts contacts:", error.message)
      continue
    }

    for (const contact of contacts || []) {
      const lastActivity = vendorLastActivityAt({
        last_activity_at: contact.last_activity_at as string | null,
        created_at: contact.created_at as string | null,
      })
      if (!isVendorInactiveByLastActivity(lastActivity, now)) {
        active += 1
      }
    }
  }

  return active
}
