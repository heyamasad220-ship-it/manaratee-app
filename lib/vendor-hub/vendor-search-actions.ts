"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

function businessNameFromFormData(formData: unknown) {
  if (!formData || typeof formData !== "object") return null
  const value = (formData as Record<string, unknown>).business_name
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

export type VendorPickerOption = {
  contactId: string
  businessName: string
  contactName: string
  email: string | null
  phone: string | null
  vendorTypeId: string | null
}

/** Search Vendor Network contacts (vendor role) by business, name, email, or phone. */
export async function searchVendorsForPickerAction(search: string, limit = 30) {
  try {
    await requireVendorHubManage()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false as const, error: "No organization selected." }
    }

    const supabase = await createClient()
    const capped = Math.min(limit, 50)
    const term = search.trim()
    const matchedIds = new Set<string>()

    const { data: roleRows, error: roleError } = await supabase
      .from("contact_roles")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .eq("role", "vendor")

    if (roleError) {
      return { success: false as const, error: roleError.message }
    }

    const vendorContactIds = [
      ...new Set(
        (roleRows || [])
          .map((row) => row.contact_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    if (vendorContactIds.length === 0) {
      return { success: true as const, vendors: [] as VendorPickerOption[] }
    }

    if (term) {
      const pattern = `%${escapeIlike(term)}%`
      const { data: contactMatches } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", vendorContactIds)
        .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(capped)

      for (const row of contactMatches || []) {
        matchedIds.add(row.id as string)
      }

      const { data: appMatches } = await supabase
        .from("applications")
        .select("contact_id, form_data")
        .eq("organization_id", organizationId)
        .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
        .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
        .in("contact_id", vendorContactIds)
        .limit(500)

      const lower = term.toLowerCase()
      for (const row of appMatches || []) {
        const business = businessNameFromFormData(row.form_data)
        if (business && business.toLowerCase().includes(lower) && row.contact_id) {
          matchedIds.add(row.contact_id as string)
        }
      }
    } else {
      for (const id of vendorContactIds.slice(0, capped)) {
        matchedIds.add(id)
      }
    }

    const ids = [...matchedIds].slice(0, capped)
    if (ids.length === 0) {
      return { success: true as const, vendors: [] as VendorPickerOption[] }
    }

    const [{ data: contacts }, { data: applications }] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, full_name, email, phone")
        .eq("organization_id", organizationId)
        .in("id", ids)
        .order("full_name", { ascending: true }),
      supabase
        .from("applications")
        .select("contact_id, form_data")
        .eq("organization_id", organizationId)
        .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
        .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
        .in("contact_id", ids)
        .order("created_at", { ascending: false }),
    ])

    const formByContact = new Map<string, Record<string, unknown>>()
    for (const row of applications || []) {
      const contactId = row.contact_id as string | null
      if (!contactId || formByContact.has(contactId)) continue
      formByContact.set(
        contactId,
        row.form_data && typeof row.form_data === "object"
          ? (row.form_data as Record<string, unknown>)
          : {}
      )
    }

    const vendors: VendorPickerOption[] = (contacts || []).map((row) => {
      const contactId = row.id as string
      const contactName = (row.full_name as string | null)?.trim() || "Unnamed"
      const form = formByContact.get(contactId) || {}
      const businessName = businessNameFromFormData(form) || contactName
      const vendorTypeId =
        typeof form.vendor_type_id === "string" && form.vendor_type_id.trim()
          ? form.vendor_type_id.trim()
          : null

      return {
        contactId,
        businessName,
        contactName,
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        vendorTypeId,
      }
    })

    vendors.sort((a, b) => a.businessName.localeCompare(b.businessName))

    return { success: true as const, vendors }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not search vendors.",
    }
  }
}

/** Search all CRM contacts when creating a vendor that is not yet in the network. */
export async function searchContactsForVendorCreateAction(search: string, limit = 30) {
  try {
    await requireVendorHubManage()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false as const, error: "No organization selected." }
    }

    const supabase = await createClient()
    let query = supabase
      .from("contacts")
      .select("id, full_name, email, phone, contact_type")
      .eq("organization_id", organizationId)
      .order("full_name", { ascending: true })
      .limit(Math.min(limit, 50))

    if (search.trim()) {
      const pattern = `%${escapeIlike(search.trim())}%`
      query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
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
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not search contacts.",
    }
  }
}
