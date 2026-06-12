/**
 * Vendor Hub data model: CRM contacts are the single vendor identity.
 *
 * - Do not store duplicate phone, email, or name fields in Vendor Hub tables.
 * - Link participation (applications, assignments, payments, invitations) via contact_id.
 * - The legacy `vendors` table and `vendor_hub_vendors` exist for historical rows only.
 * - New features must read/write contact_id and use CRM contact profiles for detail views.
 */

export type VendorHubContactRef = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  organization_name?: string | null
  company_name?: string | null
}

/** @deprecated Legacy event-scoped vendor row. Do not use for new writes. */
export type LegacyVendorHubVendorRef = {
  id: string
  business_name?: string | null
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  status?: string | null
  contact_id?: string | null
}

export function formatContactDisplayName(contact?: VendorHubContactRef | null): string {
  if (!contact) {
    return "Unknown vendor"
  }

  const personName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
  const orgName = (contact.organization_name || contact.company_name || "").trim()

  if (personName && orgName) {
    return `${personName} (${orgName})`
  }

  return personName || orgName || "Unknown vendor"
}

export function resolveParticipantDisplayName(options: {
  contact?: VendorHubContactRef | null
  legacyVendor?: LegacyVendorHubVendorRef | null
}): string {
  const fromContact = formatContactDisplayName(options.contact)
  if (fromContact !== "Unknown vendor") {
    return fromContact
  }

  if (options.legacyVendor?.business_name?.trim()) {
    return options.legacyVendor.business_name.trim()
  }

  if (options.legacyVendor?.contact_name?.trim()) {
    return options.legacyVendor.contact_name.trim()
  }

  return "Unknown vendor"
}

export function contactProfilePath(contactId: string) {
  return `/contacts/${contactId}`
}
