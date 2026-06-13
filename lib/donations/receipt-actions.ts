"use server"

import { deliverPaymentReceiptById } from "@/lib/donations/donation-email-delivery"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  allocateReceiptNumber,
  buildAnnualGivingStatementPayload,
  buildPaymentReceiptPayload,
  computeDonorGivingTotals,
} from "@/lib/donations/receipt-data"
import { loadDonationReceiptSettings } from "@/lib/donations/receipt-settings"
import type {
  AnnualGivingStatementPayload,
  PaymentReceiptPayload,
  ReceiptStatus,
} from "@/lib/donations/receipt-types"

export async function getDonationReceiptSettingsAction() {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access
  try {
    const settings = await loadDonationReceiptSettings(supabase, orgId)
    return { success: true as const, settings }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function saveDonationReceiptSettingsAction(
  settings: Omit<import("@/lib/donations/receipt-types").DonationReceiptSettings, "organization_id">
) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { saveDonationReceiptSettings } = await import("@/lib/donations/receipt-settings")
  try {
    await saveDonationReceiptSettings(supabase, { ...settings, organization_id: orgId })
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function generatePaymentReceiptAction(paymentId: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data: existing } = await supabase
    .from("donation_receipts")
    .select("id, receipt_number, payload, status, sent_at")
    .eq("organization_id", orgId)
    .eq("payment_id", paymentId)
    .maybeSingle()

  if (existing?.id) {
    return {
      success: true as const,
      receipt: existing,
      payload: existing.payload as PaymentReceiptPayload,
    }
  }

  try {
    const settings = await loadDonationReceiptSettings(supabase, orgId)
    const year = new Date().getFullYear()
    const { receiptNumber } = await allocateReceiptNumber(supabase, settings, year)
    const built = await buildPaymentReceiptPayload(supabase, paymentId, settings, receiptNumber)

    const { data: inserted, error } = await supabase
      .from("donation_receipts")
      .insert({
        organization_id: orgId,
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
      .select("id, receipt_number, payload, status, sent_at")
      .single()

    if (error) throw new Error(error.message)

    return { success: true as const, receipt: inserted, payload: built.payload }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function sendPaymentReceiptEmailAction(receiptId: string, resend = false) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId, userId } = access

  const delivery = await deliverPaymentReceiptById(supabase, {
    organizationId: orgId,
    receiptId,
    resend,
    sentBy: userId,
  })

  if (!delivery.sent) {
    return {
      success: false as const,
      error: delivery.error || "Could not send receipt email",
      delivery,
    }
  }

  const { data: receipt } = await supabase
    .from("donation_receipts")
    .select("id, status, sent_at")
    .eq("id", receiptId)
    .eq("organization_id", orgId)
    .maybeSingle()

  return {
    success: true as const,
    status: (receipt?.status || "sent") as ReceiptStatus,
    delivery,
  }
}

export async function markReceiptSentAction(receiptId: string, resend = false) {
  return sendPaymentReceiptEmailAction(receiptId, resend)
}

export async function getPaymentReceiptAction(paymentId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data, error } = await supabase
    .from("donation_receipts")
    .select("id, receipt_number, payload, status, sent_at, payment_id")
    .eq("organization_id", orgId)
    .eq("payment_id", paymentId)
    .maybeSingle()

  if (error) return { success: false as const, error: error.message }
  if (!data) return { success: false as const, error: "Receipt not found" }

  return {
    success: true as const,
    receipt: data,
    payload: data.payload as PaymentReceiptPayload,
  }
}

export async function generateAnnualStatementAction(donorId: string, taxYear: number) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data: existing } = await supabase
    .from("donation_receipts")
    .select("id, receipt_number, payload, status")
    .eq("organization_id", orgId)
    .eq("donor_id", donorId)
    .eq("tax_year", taxYear)
    .eq("receipt_type", "annual_statement")
    .maybeSingle()

  if (existing?.id) {
    return {
      success: true as const,
      receipt: existing,
      payload: existing.payload as AnnualGivingStatementPayload,
    }
  }

  try {
    const settings = await loadDonationReceiptSettings(supabase, orgId)
    const { receiptNumber } = await allocateReceiptNumber(supabase, settings, taxYear)
    const payload = await buildAnnualGivingStatementPayload(
      supabase,
      orgId,
      donorId,
      taxYear,
      settings,
      receiptNumber
    )

    const { data: inserted, error } = await supabase
      .from("donation_receipts")
      .insert({
        organization_id: orgId,
        receipt_type: "annual_statement",
        receipt_number: receiptNumber,
        donor_id: donorId,
        tax_year: taxYear,
        amount: payload.totalGiving,
        payload,
        status: "not_sent",
      })
      .select("id, receipt_number, payload, status")
      .single()

    if (error) throw new Error(error.message)
    return { success: true as const, receipt: inserted, payload }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function sendAnnualStatementEmailAction(donorId: string, taxYear: number, resend = false) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const generated = await generateAnnualStatementAction(donorId, taxYear)
  if (!generated.success) return generated

  const { supabase, orgId, userId } = access

  const delivery = await deliverPaymentReceiptById(supabase, {
    organizationId: orgId,
    receiptId: generated.receipt.id,
    resend,
    sentBy: userId,
  })

  if (!delivery.sent) {
    return {
      success: false as const,
      error: delivery.error || "Could not send year-end statement email",
      delivery,
    }
  }

  return {
    success: true as const,
    receipt: generated.receipt,
    payload: generated.payload,
    delivery,
  }
}

export async function sendBulkAnnualStatementsAction(donorIds: string[], taxYear: number) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!donorIds.length) return { success: false as const, error: "No donors selected" }

  const results: Array<{
    donorId: string
    sent: boolean
    error?: string
  }> = []

  const BATCH_SIZE = 10
  for (let index = 0; index < donorIds.length; index += BATCH_SIZE) {
    const batch = donorIds.slice(index, index + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (donorId) => {
        const result = await sendAnnualStatementEmailAction(donorId, taxYear, false)
        return {
          donorId,
          sent: result.success,
          error: result.success ? undefined : result.error,
        }
      })
    )
    results.push(...batchResults)
  }

  return {
    success: true as const,
    results,
    sentCount: results.filter((r) => r.sent).length,
    failedCount: results.filter((r) => !r.sent).length,
  }
}

export async function getDonorGivingTotalsAction(donorId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access
  try {
    const totals = await computeDonorGivingTotals(supabase, orgId, donorId)
    return { success: true as const, totals }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getReceiptReportingSummaryAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const [{ data: receipts }, { data: payments }] = await Promise.all([
    supabase
      .from("donation_receipts")
      .select("id, status, receipt_type, amount")
      .eq("organization_id", orgId)
      .eq("receipt_type", "payment"),
    supabase
      .from("payments")
      .select("id, status")
      .eq("organization_id", orgId),
  ])

  const paymentRows = (payments || []).filter(
    (p) => String(p.status || "").toLowerCase() !== "voided"
  )
  const receiptRows = receipts || []

  const { data: receiptPayments } = await supabase
    .from("donation_receipts")
    .select("payment_id")
    .eq("organization_id", orgId)
    .eq("receipt_type", "payment")
    .not("payment_id", "is", null)

  const withReceipt = new Set((receiptPayments || []).map((r) => r.payment_id))

  return {
    success: true as const,
    summary: {
      receiptsGenerated: receiptRows.length,
      receiptsSent: receiptRows.filter((r) => r.status === "sent" || r.status === "resent").length,
      receiptsNotSent: receiptRows.filter((r) => r.status === "not_sent").length,
      missingReceipts: paymentRows.filter((p) => !withReceipt.has(p.id)).length,
      totalPayments: paymentRows.length,
    },
  }
}
