import type { SupabaseClient } from "@supabase/supabase-js"

export type PaymentDonorDisplayFields = {
  sender_name?: string | null
  donor_id?: string | null
  contact_id?: string | null
  donor_display_name?: string | null
  donor_contact_id?: string | null
}

export function resolvePaymentDonorDisplayName(input: {
  senderName?: string | null
  donorFullName?: string | null
  contactFullName?: string | null
}): string {
  const contactName = input.contactFullName?.trim()
  if (contactName) return contactName

  const donorName = input.donorFullName?.trim()
  if (donorName) return donorName

  return input.senderName?.trim() || "—"
}

export async function attachPaymentDonorDisplayNames<
  T extends PaymentDonorDisplayFields,
>(supabase: SupabaseClient, organizationId: string, payments: T[]): Promise<T[]> {
  if (payments.length === 0) return payments

  const donorIds = Array.from(
    new Set(payments.map((payment) => payment.donor_id).filter(Boolean))
  ) as string[]

  const directContactIds = Array.from(
    new Set(payments.map((payment) => payment.contact_id).filter(Boolean))
  ) as string[]

  const donorNameById = new Map<string, string | null>()
  const donorContactIdById = new Map<string, string | null>()

  if (donorIds.length > 0) {
    const { data: donorRows } = await supabase
      .from("donors")
      .select("id, full_name, contact_id")
      .eq("organization_id", organizationId)
      .in("id", donorIds)

    for (const row of donorRows || []) {
      const donorId = row.id as string
      donorNameById.set(donorId, (row.full_name as string | null) ?? null)
      donorContactIdById.set(donorId, (row.contact_id as string | null) ?? null)
    }
  }

  const contactIds = Array.from(
    new Set([
      ...directContactIds,
      ...Array.from(donorContactIdById.values()).filter(Boolean),
    ])
  ) as string[]

  const contactNameById = new Map<string, string | null>()

  if (contactIds.length > 0) {
    const { data: contactRows } = await supabase
      .from("contacts")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .in("id", contactIds)

    for (const row of contactRows || []) {
      contactNameById.set(row.id as string, (row.full_name as string | null) ?? null)
    }
  }

  for (const payment of payments) {
    const donorContactId = payment.donor_id
      ? donorContactIdById.get(payment.donor_id) ?? null
      : null
    const resolvedContactId = payment.contact_id ?? donorContactId ?? null

    payment.donor_contact_id = resolvedContactId
    payment.donor_display_name = resolvePaymentDonorDisplayName({
      senderName: payment.sender_name,
      donorFullName: payment.donor_id ? donorNameById.get(payment.donor_id) ?? null : null,
      contactFullName: resolvedContactId
        ? contactNameById.get(resolvedContactId) ?? null
        : null,
    })
  }

  return payments
}

export async function syncPaymentSenderNamesForDonor(
  supabase: SupabaseClient,
  organizationId: string,
  donorId: string,
  senderName: string
) {
  const normalized = senderName.trim()
  if (!normalized) return

  const { error } = await supabase
    .from("payments")
    .update({ sender_name: normalized })
    .eq("organization_id", organizationId)
    .eq("donor_id", donorId)

  if (error && error.code !== "42P01") {
    throw new Error(`payments sender_name sync: ${error.message}`)
  }
}

export async function resolveCanonicalDonorSenderName(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  donorId?: string | null
): Promise<string | null> {
  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  const contactName = (contact?.full_name as string | null)?.trim()
  if (contactName) return contactName

  if (!donorId) return null

  const { data: donor } = await supabase
    .from("donors")
    .select("full_name")
    .eq("organization_id", organizationId)
    .eq("id", donorId)
    .maybeSingle()

  return (donor?.full_name as string | null)?.trim() || null
}
