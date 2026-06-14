export type DonationCheckoutType = "one_time" | "pledge" | "recurring_setup"

export type DonationCheckoutSessionStatus = "open" | "complete" | "expired" | "failed"

export type DonationCheckoutMetadata = {
  organization_id: string
  donor_id: string
  contact_id: string
  campaign_id?: string
  category_id?: string
  subcategory_id?: string
  recurring_donation_plan_id?: string
  checkout_type: DonationCheckoutType
  manaratee_checkout_id: string
}

export type CreateOneTimeDonationCheckoutInput = {
  organizationId: string
  donorId: string
  contactId: string
  amount: number
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  successUrl?: string
  cancelUrl?: string
  donorEmail?: string | null
  donorName?: string | null
}

export type ProcessorPaymentInsertResult = {
  paymentId: string
  created: boolean
  checkoutSessionId: string | null
}

export type RecurringStripeFrequency = "monthly" | "quarterly" | "annually"

export type CreateRecurringDonationCheckoutInput = {
  organizationId: string
  donorId: string
  contactId: string
  amount: number
  frequency: RecurringStripeFrequency
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  successUrl?: string
  cancelUrl?: string
  donorEmail?: string | null
  donorName?: string | null
}

export type RecurringSubscriptionLinkResult = {
  planId: string
  linked: boolean
  checkoutSessionId: string | null
}

export type RecurringInvoicePaymentResult = {
  paymentId: string
  created: boolean
  planId: string
}
