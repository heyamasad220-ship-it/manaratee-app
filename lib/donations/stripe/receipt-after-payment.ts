import type { SupabaseClient } from "@supabase/supabase-js"

import { deliverPaymentReceiptById } from "@/lib/donations/donation-email-delivery"
import {
  allocateReceiptNumber,
  buildPaymentReceiptPayload,
} from "@/lib/donations/receipt-data"
import { loadDonationReceiptSettings } from "@/lib/donations/receipt-settings"

export async function maybeAutoGeneratePaymentReceipt(
  supabase: SupabaseClient,
  organizationId: string,
  paymentId: string
): Promise<{ generated: boolean; receiptId?: string; error?: string }> {
  try {
    const settings = await loadDonationReceiptSettings(supabase, organizationId)
    if (!settings.auto_generate_receipts) {
      return { generated: false }
    }

    const { data: existing } = await supabase
      .from("donation_receipts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("payment_id", paymentId)
      .maybeSingle()

    if (existing?.id) {
      return { generated: false, receiptId: existing.id }
    }

    const year = new Date().getFullYear()
    const { receiptNumber } = await allocateReceiptNumber(supabase, settings, year)
    const built = await buildPaymentReceiptPayload(supabase, paymentId, settings, receiptNumber)

    const { data: inserted, error } = await supabase
      .from("donation_receipts")
      .insert({
        organization_id: organizationId,
        receipt_type: "payment",
        receipt_number: receiptNumber,
        payment_id: paymentId,
        donor_id: built.donorId,
        contact_id: built.contactId,
        tax_year: year,
        amount: built.payload.amount,
        payload: built.payload,
        status: "not_sent",
      })
      .select("id")
      .single()

    if (error) {
      return { generated: false, error: error.message }
    }

    return { generated: true, receiptId: inserted.id }
  } catch (error) {
    return {
      generated: false,
      error: error instanceof Error ? error.message : "Receipt generation failed",
    }
  }
}

export async function maybeAutoGenerateAndEmailPaymentReceipt(
  supabase: SupabaseClient,
  organizationId: string,
  paymentId: string
): Promise<{
  generated: boolean
  receiptId?: string
  emailed: boolean
  emailError?: string
  error?: string
}> {
  const generated = await maybeAutoGeneratePaymentReceipt(supabase, organizationId, paymentId)
  if (!generated.receiptId) {
    return { ...generated, emailed: false }
  }

  const settings = await loadDonationReceiptSettings(supabase, organizationId)
  if (!settings.email_receipts_automatically) {
    return { ...generated, emailed: false }
  }

  const delivery = await deliverPaymentReceiptById(supabase, {
    organizationId,
    receiptId: generated.receiptId,
  })

  return {
    ...generated,
    emailed: delivery.sent,
    emailError: delivery.error,
  }
}
