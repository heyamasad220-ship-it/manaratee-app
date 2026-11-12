"use server"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  formatChargeFailureCard,
  formatChargeFailureKind,
  formatChargeFailureReason,
} from "@/lib/donations/charge-failure-reason"

export type DonationChargeFailureRow = {
  id: string
  occurredAt: string
  amount: number | null
  currency: string
  donorName: string
  contactId: string | null
  kind: string
  reason: string
  cardLabel: string | null
  campaignName: string | null
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function fetchDonationChargeFailuresAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("donation_charge_failures")
    .select(
      "id, occurred_at, amount, currency, charge_kind, decline_code, failure_code, failure_message, card_brand, card_last4, contact_id, donors(full_name), campaigns(name)"
    )
    .eq("organization_id", access.orgId)
    .order("occurred_at", { ascending: false })
    .limit(200)

  if (error) return { success: false as const, error: error.message }

  const failures: DonationChargeFailureRow[] = (data || []).map((row) => {
    const donor = firstRelated(row.donors as { full_name?: string | null } | { full_name?: string | null }[] | null)
    const campaign = firstRelated(row.campaigns as { name?: string | null } | { name?: string | null }[] | null)
    return {
      id: row.id as string,
      occurredAt: row.occurred_at as string,
      amount: row.amount == null ? null : Number(row.amount),
      currency: String(row.currency || "USD"),
      donorName: donor?.full_name?.trim() || "Unknown donor",
      contactId: (row.contact_id as string | null) ?? null,
      kind: formatChargeFailureKind(row.charge_kind as string),
      reason: formatChargeFailureReason({
        declineCode: row.decline_code as string | null,
        failureCode: row.failure_code as string | null,
        failureMessage: row.failure_message as string | null,
      }),
      cardLabel: formatChargeFailureCard({
        brand: row.card_brand as string | null,
        last4: row.card_last4 as string | null,
      }),
      campaignName: campaign?.name?.trim() || null,
    }
  })

  return { success: true as const, failures }
}
