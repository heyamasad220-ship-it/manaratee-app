import type { DonationCheckoutMetadata } from "@/lib/donations/stripe/types"

function cleanMetadataValue(value: string | null | undefined): string | undefined {
  const trimmed = String(value ?? "").trim()
  return trimmed || undefined
}

export function buildDonationCheckoutMetadata(input: {
  organizationId: string
  donorId: string
  contactId: string
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  recurringDonationPlanId?: string | null
  checkoutType: DonationCheckoutMetadata["checkout_type"]
  manarateeCheckoutId: string
}): DonationCheckoutMetadata {
  const metadata: DonationCheckoutMetadata = {
    organization_id: input.organizationId,
    donor_id: input.donorId,
    contact_id: input.contactId,
    checkout_type: input.checkoutType,
    manaratee_checkout_id: input.manarateeCheckoutId,
  }

  const campaignId = cleanMetadataValue(input.campaignId)
  const categoryId = cleanMetadataValue(input.categoryId)
  const subcategoryId = cleanMetadataValue(input.subcategoryId)
  const recurringDonationPlanId = cleanMetadataValue(input.recurringDonationPlanId)

  if (campaignId) metadata.campaign_id = campaignId
  if (categoryId) metadata.category_id = categoryId
  if (subcategoryId) metadata.subcategory_id = subcategoryId
  if (recurringDonationPlanId) metadata.recurring_donation_plan_id = recurringDonationPlanId

  return metadata
}

export function parseDonationCheckoutMetadata(
  metadata: Record<string, string> | null | undefined
): DonationCheckoutMetadata | null {
  if (!metadata) return null

  const organizationId = metadata.organization_id
  const donorId = metadata.donor_id
  const contactId = metadata.contact_id
  const checkoutType = metadata.checkout_type
  const manarateeCheckoutId = metadata.manaratee_checkout_id

  if (!organizationId || !donorId || !contactId || !checkoutType || !manarateeCheckoutId) {
    return null
  }

  if (checkoutType !== "one_time" && checkoutType !== "pledge" && checkoutType !== "recurring_setup") {
    return null
  }

  return {
    organization_id: organizationId,
    donor_id: donorId,
    contact_id: contactId,
    checkout_type: checkoutType,
    manaratee_checkout_id: manarateeCheckoutId,
    campaign_id: metadata.campaign_id || undefined,
    category_id: metadata.category_id || undefined,
    subcategory_id: metadata.subcategory_id || undefined,
    recurring_donation_plan_id: metadata.recurring_donation_plan_id || undefined,
  }
}
