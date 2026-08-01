import assert from "node:assert/strict"
import { test } from "node:test"

import { venueRentalOrgRequiresPolicyAgreement } from "./venue-rental-policy-documents"

test("requires agreement when either document URL is set", () => {
  assert.equal(
    venueRentalOrgRequiresPolicyAgreement({
      policiesDocumentUrl: null,
      pricingGuideUrl: null,
    }),
    false
  )
  assert.equal(
    venueRentalOrgRequiresPolicyAgreement({
      policiesDocumentUrl: "https://example.com/policies.pdf",
      pricingGuideUrl: null,
    }),
    true
  )
  assert.equal(
    venueRentalOrgRequiresPolicyAgreement({
      policiesDocumentUrl: null,
      pricingGuideUrl: "https://example.com/pricing.pdf",
    }),
    true
  )
})
