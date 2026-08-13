"use server"

import { formatFinancialActivityPaymentStatus } from "@/lib/donations/donation-status"
import { formatPaymentSourceLabel } from "@/lib/donations/payment-source-channel"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  formatPaymentMethodLabel,
  formatPaymentTransactionStatus,
  type PaymentTransactionStatus,
} from "@/lib/programs/payment-transaction-display"
import { getProgramPaymentTransactions } from "@/lib/programs/program-payment-transactions"
import { createClient } from "@/lib/supabase/server"

export type OrgPaymentTransactionStatus = PaymentTransactionStatus

export type OrgPaymentTransactionRow = {
  id: string
  module: "donations" | "programs"
  paidAt: string | null
  contactName: string
  contactProfileId: string | null
  departmentId: string | null
  departmentName: string | null
  programId: string | null
  programName: string | null
  programKind: "academic" | "seasonal" | null
  offeringId: string | null
  offeringName: string | null
  offeringActivity: "active" | "closed" | null
  paymentType: string
  paymentMethod: string
  amount: number
  status: OrgPaymentTransactionStatus
  detailHref: string | null
  failureHint: string | null
}

function sortByDateDesc(
  a: OrgPaymentTransactionRow,
  b: OrgPaymentTransactionRow
) {
  const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0
  const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0
  return bTime - aTime
}

async function loadDonationPayments(
  organizationId: string,
  limit: number
): Promise<OrgPaymentTransactionRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      amount,
      status,
      refunded_amount,
      paid_at,
      created_at,
      source,
      memo,
      donor:donor_id (
        full_name,
        contact_id,
        contact:contact_id ( full_name )
      )
    `
    )
    .eq("organization_id", organizationId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error("loadDonationPayments:", error.message)
    return []
  }

  return (data || []).map((row) => {
    const donor = row.donor as
      | {
          full_name?: string | null
          contact_id?: string | null
          contact?:
            | { full_name?: string | null }
            | { full_name?: string | null }[]
            | null
        }
      | {
          full_name?: string | null
          contact_id?: string | null
          contact?:
            | { full_name?: string | null }
            | { full_name?: string | null }[]
            | null
        }[]
      | null
    const donorRow = Array.isArray(donor) ? donor[0] : donor
    const contactRaw = donorRow?.contact
    const contact = Array.isArray(contactRaw) ? contactRaw[0] : contactRaw
    const contactName =
      contact?.full_name?.trim() || donorRow?.full_name?.trim() || "Donor"
    const rawStatus = String(row.status || "").toLowerCase()
    const status: OrgPaymentTransactionStatus =
      rawStatus === "voided"
        ? "Voided"
        : rawStatus === "unresolved" || rawStatus === "failed"
          ? "Failed"
          : formatPaymentTransactionStatus(
              formatFinancialActivityPaymentStatus({
                status: row.status as string | null,
                amount: row.amount as number | null,
                refunded_amount: row.refunded_amount as number | null,
              })
            )
    const contactId = donorRow?.contact_id || null

    return {
      id: `donation:${row.id}`,
      module: "donations" as const,
      paidAt:
        (row.paid_at as string | null) ||
        (row.created_at as string | null) ||
        null,
      contactName,
      contactProfileId: contactId,
      departmentId: null,
      departmentName: null,
      programId: null,
      programName: null,
      programKind: null,
      offeringId: null,
      offeringName: null,
      offeringActivity: null,
      paymentType: "Donation",
      paymentMethod: formatPaymentMethodLabel(
        formatPaymentSourceLabel(row.source as string | null)
      ),
      amount: Number(row.amount || 0),
      status,
      detailHref: contactId
        ? `/contacts/${contactId}?tab=financial`
        : "/donations/reports/one-time",
      failureHint:
        status === "Failed" ? "Card or payment method declined" : null,
    }
  })
}

async function loadProgramPayments(
  limit: number
): Promise<OrgPaymentTransactionRow[]> {
  try {
    const rows = await getProgramPaymentTransactions({ limit })
    return rows.map((row) => ({
      id: `program:${row.id}`,
      module: "programs" as const,
      paidAt: row.paidAt,
      contactName: row.contactName,
      contactProfileId: row.contactProfileId,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      programId: row.programId,
      programName: row.programName,
      programKind: row.programKind,
      offeringId: row.offeringId,
      offeringName: row.offeringName,
      offeringActivity: row.offeringActivity,
      paymentType: row.paymentType,
      paymentMethod: row.paymentMethod,
      amount: row.amount,
      status: row.status,
      detailHref: row.contactProfileId
        ? `/contacts/${row.contactProfileId}?tab=financial`
        : `/programs/registrations/${row.enrollmentId}`,
      failureHint:
        row.status === "Failed" ? "Card or payment method declined" : null,
    }))
  } catch (error) {
    console.error("loadProgramPayments:", error)
    return []
  }
}

export async function getOrgPaymentTransactions(filters?: {
  failedOnly?: boolean
  limit?: number
}): Promise<OrgPaymentTransactionRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const limit = filters?.limit ?? 300
  const [donations, programs] = await Promise.all([
    loadDonationPayments(organizationId, limit),
    loadProgramPayments(limit),
  ])

  let rows = [...donations, ...programs].sort(sortByDateDesc)
  if (filters?.failedOnly) {
    rows = rows.filter((row) => row.status === "Failed")
  }
  return rows.slice(0, limit)
}

export async function fetchOrgPaymentTransactionsAction(filters?: {
  failedOnly?: boolean
  limit?: number
}) {
  try {
    const rows = await getOrgPaymentTransactions(filters)
    return { success: true as const, rows }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load payment transactions.",
    }
  }
}
