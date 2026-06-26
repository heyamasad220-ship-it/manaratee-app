import type { SupabaseClient } from "@supabase/supabase-js"
import {
  formatOrganizationAddress,
  formatReceiptNumber,
  isVoidedPaymentForReceipt,
  type AnnualGivingStatementPayload,
  type DonationReceiptSettings,
  type DonorGivingTotals,
  type PaymentReceiptLineItem,
  type PaymentReceiptPayload,
} from "@/lib/donations/receipt-types"
import { loadDonationReceiptSettings } from "@/lib/donations/receipt-settings"
import { countsTowardGivingTotals, paymentNetAmount } from "@/lib/donations/payment-net-amount"

type PaymentRow = {
  id: string
  organization_id: string
  donor_id: string | null
  contact_id: string | null
  pledge_id: string | null
  campaign_id: string | null
  category_id: string | null
  subcategory_id: string | null
  sender_name: string | null
  amount: number | null
  refunded_amount?: number | null
  payment_date: string | null
  source: string | null
  status: string | null
  memo: string | null
}

async function resolveDonorName(
  supabase: SupabaseClient,
  payment: PaymentRow
): Promise<{ name: string; email: string | null; donorId: string | null; contactId: string | null }> {
  if (payment.donor_id) {
    const { data } = await supabase
      .from("donors")
      .select("id, full_name, email, contact_id")
      .eq("id", payment.donor_id)
      .maybeSingle()
    return {
      name: data?.full_name || payment.sender_name || "Donor",
      email: data?.email ?? null,
      donorId: data?.id ?? payment.donor_id,
      contactId: data?.contact_id ?? payment.contact_id,
    }
  }

  if (payment.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, email")
      .eq("id", payment.contact_id)
      .maybeSingle()
    return {
      name: data?.full_name || payment.sender_name || "Donor",
      email: data?.email ?? null,
      donorId: null,
      contactId: data?.id ?? payment.contact_id,
    }
  }

  return {
    name: payment.sender_name || "Donor",
    email: null,
    donorId: null,
    contactId: null,
  }
}

async function resolveCampaignAndFund(
  supabase: SupabaseClient,
  payment: PaymentRow
): Promise<{ campaignName: string | null; fundName: string | null }> {
  let campaignId = payment.campaign_id
  let categoryId = payment.category_id
  let subcategoryId = payment.subcategory_id

  if (payment.pledge_id) {
    const { data: pledge } = await supabase
      .from("pledges")
      .select("campaign_id, category_id, subcategory_id")
      .eq("id", payment.pledge_id)
      .maybeSingle()
    campaignId = campaignId ?? pledge?.campaign_id ?? null
    categoryId = categoryId ?? pledge?.category_id ?? null
    subcategoryId = subcategoryId ?? pledge?.subcategory_id ?? null
  }

  let campaignName: string | null = null
  let fundName: string | null = null

  if (campaignId) {
    const { data } = await supabase.from("campaigns").select("name").eq("id", campaignId).maybeSingle()
    campaignName = data?.name ?? null
  }

  if (subcategoryId) {
    const { data } = await supabase
      .from("donation_subcategories")
      .select("name")
      .eq("id", subcategoryId)
      .maybeSingle()
    fundName = data?.name ?? null
  } else if (categoryId) {
    const { data } = await supabase
      .from("donation_categories")
      .select("name")
      .eq("id", categoryId)
      .maybeSingle()
    fundName = data?.name ?? null
  }

  return { campaignName, fundName }
}

export async function buildPaymentReceiptPayload(
  supabase: SupabaseClient,
  paymentId: string,
  settings: DonationReceiptSettings,
  receiptNumber: string
): Promise<{
  payload: PaymentReceiptPayload
  payment: PaymentRow
  donorId: string | null
  contactId: string | null
}> {
  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, organization_id, donor_id, contact_id, pledge_id, campaign_id, category_id, subcategory_id, sender_name, amount, payment_date, source, status, memo"
    )
    .eq("id", paymentId)
    .single()

  if (error || !payment) {
    throw new Error(error?.message || "Payment not found")
  }

  if (isVoidedPaymentForReceipt(payment.status)) {
    throw new Error("Voided payments cannot generate receipts")
  }

  const donor = await resolveDonorName(supabase, payment as PaymentRow)
  const { campaignName, fundName } = await resolveCampaignAndFund(
    supabase,
    payment as PaymentRow
  )

  const paymentDate = payment.payment_date
    ? new Date(payment.payment_date).toLocaleDateString("en-US")
    : new Date().toLocaleDateString("en-US")

  const payload: PaymentReceiptPayload = {
    receiptNumber,
    receiptDate: new Date().toLocaleDateString("en-US"),
    donorName: donor.name,
    donorEmail: donor.email,
    organizationName: settings.legal_name || "Organization",
    organizationAddress: formatOrganizationAddress(settings),
    taxId: settings.tax_id,
    paymentDate,
    amount: Number(payment.amount || 0),
    paymentMethod: payment.source || "—",
    campaignName,
    fundName,
    taxDisclaimer:
      settings.receipt_footer_text ||
      "No goods or services were provided in exchange for this contribution.",
    signerName: settings.authorized_signer_name,
    signerTitle: settings.authorized_signer_title,
    footerText: settings.receipt_footer_text,
  }

  return {
    payload,
    payment: payment as PaymentRow,
    donorId: donor.donorId,
    contactId: donor.contactId,
  }
}

export async function buildAnnualGivingStatementPayload(
  supabase: SupabaseClient,
  organizationId: string,
  donorId: string,
  taxYear: number,
  settings: DonationReceiptSettings,
  receiptNumber: string
): Promise<AnnualGivingStatementPayload> {
  const { data: donor, error: donorError } = await supabase
    .from("donors")
    .select("id, full_name, email")
    .eq("id", donorId)
    .eq("organization_id", organizationId)
    .single()

  if (donorError || !donor) {
    throw new Error(donorError?.message || "Donor not found")
  }

  const yearStart = `${taxYear}-01-01T00:00:00`
  const yearEnd = `${taxYear + 1}-01-01T00:00:00`

  const { data: payments, error } = await supabase
    .from("payments")
    .select(
      "id, donor_id, contact_id, pledge_id, campaign_id, category_id, subcategory_id, sender_name, amount, payment_date, source, status, memo"
    )
    .eq("organization_id", organizationId)
    .eq("donor_id", donorId)
    .gte("payment_date", yearStart)
    .lt("payment_date", yearEnd)
    .order("payment_date", { ascending: true })

  if (error) throw new Error(error.message)

  const lineItems: PaymentReceiptLineItem[] = []
  let totalGiving = 0

  for (const payment of payments || []) {
    if (isVoidedPaymentForReceipt(payment.status)) continue
    const { campaignName, fundName } = await resolveCampaignAndFund(
      supabase,
      payment as PaymentRow
    )
    const amount = Number(payment.amount || 0)
    totalGiving += amount
    lineItems.push({
      paymentId: payment.id,
      paymentDate: payment.payment_date
        ? new Date(payment.payment_date).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })
        : "—",
      amount,
      paymentMethod: payment.source || "—",
      campaignName,
      fundName,
      memo: payment.memo,
    })
  }

  return {
    receiptNumber,
    statementDate: new Date().toLocaleDateString("en-US"),
    taxYear,
    donorName: donor.full_name || "Donor",
    donorEmail: donor.email,
    organizationName: settings.legal_name || "Organization",
    organizationAddress: formatOrganizationAddress(settings),
    taxId: settings.tax_id,
    lineItems,
    totalGiving,
    footerText: settings.receipt_footer_text,
    signerName: settings.authorized_signer_name,
    signerTitle: settings.authorized_signer_title,
  }
}

export async function computeDonorGivingTotals(
  supabase: SupabaseClient,
  organizationId: string,
  donorId: string
): Promise<DonorGivingTotals> {
  const { data: payments, error } = await supabase
    .from("payments")
    .select("amount, refunded_amount, payment_date, status")
    .eq("organization_id", organizationId)
    .eq("donor_id", donorId)

  if (error) throw new Error(error.message)

  const now = new Date()
  const currentYear = now.getFullYear()
  const previousYear = currentYear - 1

  let lifetimeGiving = 0
  let currentYearGiving = 0
  let previousYearGiving = 0

  for (const payment of payments || []) {
    if (!countsTowardGivingTotals(payment)) continue
    const amount = paymentNetAmount(payment.amount, payment.refunded_amount)
    const year = payment.payment_date ? new Date(payment.payment_date).getFullYear() : null
    lifetimeGiving += amount
    if (year === currentYear) currentYearGiving += amount
    if (year === previousYear) previousYearGiving += amount
  }

  return {
    lifetimeGiving,
    currentYearGiving,
    previousYearGiving,
    currentYear,
    previousYear,
  }
}

export async function allocateReceiptNumber(
  supabase: SupabaseClient,
  settings: DonationReceiptSettings,
  year = new Date().getFullYear()
): Promise<{ receiptNumber: string; nextSequence: number }> {
  const receiptNumber = formatReceiptNumber(
    settings.receipt_number_format,
    settings.receipt_number_prefix,
    settings.next_receipt_sequence,
    year
  )
  const nextSequence = settings.next_receipt_sequence + 1

  const { error } = await supabase
    .from("donation_settings")
    .update({ next_receipt_sequence: nextSequence })
    .eq("organization_id", settings.organization_id)

  if (error) throw new Error(error.message)

  return { receiptNumber, nextSequence }
}

export async function loadDonationReceiptSettingsForOrg(
  supabase: SupabaseClient,
  organizationId: string
) {
  return loadDonationReceiptSettings(supabase, organizationId)
}
