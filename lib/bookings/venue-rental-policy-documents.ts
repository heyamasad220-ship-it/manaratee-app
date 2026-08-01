import type { VenueRentalOrgSettings } from "./venue-rental-types"

export type VenueRentalApprovalMode = "manual" | "auto_after_agreement"

/** True when the org has at least one customer document to send/agree. */
export function venueRentalOrgRequiresPolicyAgreement(
  settings: Pick<
    VenueRentalOrgSettings,
    "policiesDocumentUrl" | "pricingGuideUrl"
  >
): boolean {
  return Boolean(
    settings.policiesDocumentUrl?.trim() || settings.pricingGuideUrl?.trim()
  )
}

export function venueRentalHasCustomerDocuments(input: {
  policiesDocumentUrl?: string | null
  pricingGuideUrl?: string | null
}): boolean {
  return Boolean(
    input.policiesDocumentUrl?.trim() || input.pricingGuideUrl?.trim()
  )
}
