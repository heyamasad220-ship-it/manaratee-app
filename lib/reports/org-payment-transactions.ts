"use server"

import { formatFinancialActivityPaymentStatus } from "@/lib/donations/donation-status"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getProgramPaymentTransactions } from "@/lib/programs/program-payment-transactions"
import { createClient } from "@/lib/supabase/server"

export type OrgPaymentTransactionStatus =
  | "Succeeded"
  | "Failed"
  | "Refunded"
  | "Partially Refunded"
  | "Voided"

export type OrgPaymentTransactionRow = {
  id: string
  module: "donations" | "programs"
  moduleLabel: string
  paidAt: string | null
  partyName: string
  description: string | null
  amount: number
  status: OrgPaymentTransactionStatus
  detailHref: string | null
  failureHint: string | null
}

function sortByDateDesc(a: OrgPaymentTransactionRow, b: OrgPaymentTransactionRow) {
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
          contact?: { full_name?: string | null } | { full_name?: string | null }[] | null
        }
      | {
          full_name?: string | null
          contact_id?: string | null
          contact?: { full_name?: string | null } | { full_name?: string | null }[] | null
        }[]
      | null
    const donorRow = Array.isArray(donor) ? donor[0] : donor
    const contactRaw = donorRow?.contact
    const contact = Array.isArray(contactRaw) ? contactRaw[0] : contactRaw
    const partyName =
      contact?.full_name?.trim() ||
      donorRow?.full_name?.trim() ||
      "Donor"
    const status = formatFinancialActivityPaymentStatus({
      status: row.status as string | null,
      amount: row.amount as number | null,
      refunded_amount: row.refunded_amount as number | null,
    })
    const contactId = donorRow?.contact_id || null
    const rawStatus = String(row.status || "").toLowerCase()

    return {
      id: `donation:${row.id}`,
      module: "donations" as const,
      moduleLabel: "Donations",
      paidAt:
        (row.paid_at as string | null) ||
        (row.created_at as string | null) ||
        null,
      partyName,
      description: (row.memo as string | null) || null,
      amount: Number(row.amount || 0),
      status,
      detailHref: contactId
        ? `/contacts/${contactId}?tab=financial`
        : "/donations/reports/one-time",
      failureHint:
        status === "Failed"
          ? rawStatus === "voided"
            ? "Voided payment"
            : rawStatus === "pending_review"
              ? "Needs review"
              : rawStatus === "unresolved"
                ? "Unresolved / declined"
                : "Payment failed"
          : null,
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
      moduleLabel: "Programs",
      paidAt: row.paidAt,
      partyName: row.participantName,
      description: row.offeringName || row.programName || row.label,
      amount: row.amount,
      status: row.status as OrgPaymentTransactionStatus,
      detailHref: `/programs/registrations/${row.enrollmentId}`,
      failureHint: null,
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
