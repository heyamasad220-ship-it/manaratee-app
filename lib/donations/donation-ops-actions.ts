"use server"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export type DonationOpsSnapshot = {
  failedEmails: number
  failedReceipts: number
  pendingMatchPayments: number
  unresolvedPayments: number
  failedProcessorEvents: number
  recentFailedEmails: Array<{
    id: string
    recipient: string
    template: string
    error_message: string | null
    created_at: string
  }>
  recentProcessorFailures: Array<{
    id: string
    event_type: string
    error_message: string | null
    created_at: string
  }>
}

export async function getDonationOpsSnapshotAction() {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const { supabase, orgId } = access

  const [
    failedEmailsResult,
    failedReceiptsResult,
    pendingMatchResult,
    unresolvedPaymentsResult,
    processorFailuresResult,
    recentFailedEmails,
    recentProcessorFailures,
  ] = await Promise.all([
    supabase
      .from("transactional_email_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "failed"),
    supabase
      .from("donation_receipts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "failed"),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending_review"),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "unresolved"),
    supabase
      .from("payment_processor_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("processing_status", "failed"),
    supabase
      .from("transactional_email_log")
      .select("id, recipient, template, error_message, created_at")
      .eq("organization_id", orgId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("payment_processor_events")
      .select("id, event_type, error_message, created_at")
      .eq("organization_id", orgId)
      .eq("processing_status", "failed")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const snapshot: DonationOpsSnapshot = {
    failedEmails: failedEmailsResult.count ?? 0,
    failedReceipts: failedReceiptsResult.count ?? 0,
    pendingMatchPayments: pendingMatchResult.count ?? 0,
    unresolvedPayments: unresolvedPaymentsResult.count ?? 0,
    failedProcessorEvents: processorFailuresResult.count ?? 0,
    recentFailedEmails: recentFailedEmails.data || [],
    recentProcessorFailures: recentProcessorFailures.data || [],
  }

  return { success: true as const, snapshot }
}
