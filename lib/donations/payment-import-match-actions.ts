"use server"

import { findOrCreateContact } from "@/lib/contacts/contact-actions"
import { handleDonationAffiliationSync } from "@/lib/contacts/contact-affiliation-sync"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import {
  buildContactLookupIndex,
  buildContactSearchFilter,
  buildManualSearchFilter,
  canAutoCreateContactFromPaymentHints,
  findAutoMatchForPayment,
  getNameParts,
  guessImportContactType,
  normalizeName,
  rankContactMatches,
  resolvePaymentMatchHints,
  type ContactLookupIndex,
  type ContactMatchInput,
  type ContactMatchResult,
} from "@/lib/donations/payment-contact-matching"
import {
  pickPledgeForImportAllocation,
  type PledgeAllocationCandidate,
} from "@/lib/donations/payment-pledge-allocation"
import {
  dedupeValidPaymentCsvRows,
  makePaymentDuplicateKey,
  normalizeAmount,
  normalizeDate,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  PAYMENT_CSV_IMPORT_CHUNK_SIZE,
  type ParsedPaymentCsvRow,
} from "@/lib/donations/payment-import-csv"
import type { ImportPaymentCsvResult, PaymentMatchQueueItem } from "@/lib/donations/payment-import-match-types"
import {
  buildAttributionLookupMaps,
  mergePaymentAttribution,
  parseImportAttributionFromRawRow,
  resolveAttributionFromNames,
  toPaymentAttributionColumns,
  type PaymentAttribution,
} from "@/lib/donations/payment-attribution"

const PAYMENT_INSERT_BATCH_SIZE = 200
const PAYMENT_KEY_PAGE_SIZE = 1000
const BULK_AUTO_MATCH_PAYMENT_BATCH = 500
const BULK_PAYMENT_UPDATE_PARALLEL = 40
const BULK_AFFILIATION_SYNC_PARALLEL = 20
const CONTACT_FETCH_PAGE_SIZE = 1000

async function fetchExistingPaymentKeys(
  supabase: Awaited<ReturnType<typeof requireDonationStaffAccess>> extends { ok: true; supabase: infer S }
    ? S
    : never,
  orgId: string
) {
  const keys = new Set<string>()
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("payments")
      .select("sender_name, amount, payment_date, memo")
      .eq("organization_id", orgId)
      .range(from, from + PAYMENT_KEY_PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    const rows = data || []
    for (const row of rows) {
      keys.add(
        makePaymentDuplicateKey({
          sender_name: row.sender_name,
          amount: Number(row.amount || 0),
          payment_date: row.payment_date,
          memo: row.memo,
        })
      )
    }

    if (rows.length < PAYMENT_KEY_PAGE_SIZE) break
    from += PAYMENT_KEY_PAGE_SIZE
  }

  return keys
}

async function insertPaymentsInBatches(
  supabase: Awaited<ReturnType<typeof requireDonationStaffAccess>> extends { ok: true; supabase: infer S }
    ? S
    : never,
  rows: Record<string, unknown>[]
) {
  for (let index = 0; index < rows.length; index += PAYMENT_INSERT_BATCH_SIZE) {
    const chunk = rows.slice(index, index + PAYMENT_INSERT_BATCH_SIZE)
    const { error } = await supabase.from("payments").insert(chunk)
    if (error) throw new Error(error.message)
  }
}

export async function beginPaymentCsvImportAction(input: {
  fileName: string
  totalRows: number
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const existingKeys = await fetchExistingPaymentKeys(access.supabase, access.orgId)

    const { data: batch, error: batchError } = await access.supabase
      .from("payment_import_batches")
      .insert({
        organization_id: access.orgId,
        file_name: input.fileName || "payment-import.csv",
        row_count: input.totalRows,
        status: "processing",
        import_seen_keys: Array.from(existingKeys),
      })
      .select("id")
      .single()

    if (batchError || !batch) {
      return { success: false as const, error: batchError?.message || "Could not create import batch" }
    }

    return { success: true as const, batchId: batch.id as string }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not start import",
    }
  }
}

export async function importPaymentCsvChunkAction(input: {
  batchId: string
  rows: ParsedPaymentCsvRow[]
  defaultAttribution: PaymentAttribution
  isLastChunk: boolean
  totalRows: number
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const validRows = input.rows.filter((row) => {
    return normalizeText(row.sender_name) !== "" && normalizeAmount(row.amount) > 0
  })

  if (validRows.length === 0 && !input.isLastChunk) {
    return { success: true as const, imported: 0, duplicates: 0 }
  }

  const { data: batch, error: batchError } = await access.supabase
    .from("payment_import_batches")
    .select("id, import_seen_keys")
    .eq("organization_id", access.orgId)
    .eq("id", input.batchId)
    .maybeSingle()

  if (batchError || !batch) {
    return { success: false as const, error: batchError?.message || "Import batch not found" }
  }

  try {
    const seenKeys = new Set<string>(
      Array.isArray(batch.import_seen_keys) ? (batch.import_seen_keys as string[]) : []
    )
    const lookupMaps = await buildAttributionLookupMaps(access.supabase, access.orgId)
    const fallbackAttribution = input.defaultAttribution

    const paymentPayload: Record<string, unknown>[] = []
    let duplicates = 0

    for (const row of validRows) {
      const senderName = normalizeText(row.sender_name)
      const amount = normalizeAmount(row.amount)
      const paymentDate = normalizeDate(row.payment_date)
      const reference = normalizeText(row.reference)
      const importEmail = normalizeEmail(row.email) || null
      const importPhone = normalizeText(row.phone) || null

      const key = makePaymentDuplicateKey({
        sender_name: senderName,
        amount,
        payment_date: paymentDate,
        memo: reference,
      })

      if (seenKeys.has(key)) {
        duplicates += 1
        continue
      }

      seenKeys.add(key)

      const fromRow = resolveAttributionFromNames(
        parseImportAttributionFromRawRow(row),
        lookupMaps
      )
      const attribution = mergePaymentAttribution(fromRow, fallbackAttribution)

      paymentPayload.push({
        organization_id: access.orgId,
        donor_id: null,
        contact_id: null,
        pledge_id: null,
        sender_name: senderName,
        amount,
        payment_date: paymentDate ? `${paymentDate}T12:00:00` : new Date().toISOString(),
        memo: reference || null,
        source: row.source || "import",
        source_type: "import",
        status: "pending_review",
        is_verified: false,
        import_batch_id: batch.id,
        import_email: importEmail,
        import_phone: importPhone,
        ...toPaymentAttributionColumns(attribution),
      })
    }

    if (paymentPayload.length > 0) {
      await insertPaymentsInBatches(access.supabase, paymentPayload)
    }

    const batchUpdate: Record<string, unknown> = {
      import_seen_keys: Array.from(seenKeys),
    }

    if (input.isLastChunk) {
      batchUpdate.status = "imported"
      batchUpdate.row_count = input.totalRows
      batchUpdate.import_seen_keys = []
    }

    const { error: updateError } = await access.supabase
      .from("payment_import_batches")
      .update(batchUpdate)
      .eq("id", input.batchId)

    if (updateError) {
      return { success: false as const, error: updateError.message }
    }

    return {
      success: true as const,
      imported: paymentPayload.length,
      duplicates,
    }
  } catch (error) {
    await access.supabase
      .from("payment_import_batches")
      .update({ status: "failed" })
      .eq("id", input.batchId)

    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Import chunk failed",
    }
  }
}

/** @deprecated Prefer beginPaymentCsvImportAction + importPaymentCsvChunkAction for large files. */
export async function importPaymentCsvAction(input: {
  fileName: string
  rows: ParsedPaymentCsvRow[]
  defaultAttribution: PaymentAttribution
}) {
  const begin = await beginPaymentCsvImportAction({
    fileName: input.fileName,
    totalRows: input.rows.length,
  })

  if (!begin.success) return begin

  const invalid = input.rows.filter((row) => {
    return normalizeText(row.sender_name) === "" || normalizeAmount(row.amount) <= 0
  }).length

  const { unique, duplicates: fileDuplicates } = dedupeValidPaymentCsvRows(input.rows)
  let imported = 0
  let dbDuplicates = 0

  for (let index = 0; index < unique.length; index += PAYMENT_CSV_IMPORT_CHUNK_SIZE) {
    const chunk = unique.slice(index, index + PAYMENT_CSV_IMPORT_CHUNK_SIZE)
    const isLastChunk = index + PAYMENT_CSV_IMPORT_CHUNK_SIZE >= unique.length

    const chunkResult = await importPaymentCsvChunkAction({
      batchId: begin.batchId,
      rows: chunk,
      defaultAttribution: input.defaultAttribution,
      isLastChunk,
      totalRows: input.rows.length,
    })

    if (!chunkResult.success) return chunkResult

    imported += chunkResult.imported
    dbDuplicates += chunkResult.duplicates
  }

  return {
    success: true as const,
    result: {
      batchId: begin.batchId,
      imported,
      duplicates: fileDuplicates + dbDuplicates,
      invalid,
    } satisfies ImportPaymentCsvResult,
  }
}

export async function fetchPaymentMatchQueueAction() {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("payments")
    .select(
      "id, amount, payment_date, source, memo, status, donor_id, contact_id, sender_name, import_email, import_phone"
    )
    .eq("organization_id", access.orgId)
    .in("status", ["pending_review", "unallocated", "unresolved"])
    .is("pledge_id", null)
    .order("payment_date", { ascending: false })

  if (error) return { success: false as const, error: error.message }

  const payments: PaymentMatchQueueItem[] = (data || []).map((row) => ({
    id: row.id as string,
    source: String(row.source || "import").toLowerCase(),
    senderName: (row.sender_name as string | null) || "Unknown",
    amount: Number(row.amount || 0),
    date: (row.payment_date as string | null) || null,
    memo: (row.memo as string | null) || "",
    status: (row.status as PaymentMatchQueueItem["status"]) || "pending_review",
    donorId: (row.donor_id as string | null) || null,
    contactId: (row.contact_id as string | null) || null,
    importEmail: (row.import_email as string | null) || null,
    importPhone: (row.import_phone as string | null) || null,
  }))

  return { success: true as const, payments }
}

async function loadDonorStatsByContactId(
  supabase: Awaited<ReturnType<typeof requireDonationStaffAccess>> extends { ok: true; supabase: infer S }
    ? S
    : never,
  orgId: string,
  contactIds: string[]
) {
  const stats = new Map<string, { donorId: string | null; totalDonations: number; lastDonation: string }>()

  if (contactIds.length === 0) return stats

  const { data } = await supabase
    .from("donor_summary_view")
    .select("id, contact_id, total_donations, last_donation_date")
    .eq("organization_id", orgId)
    .in("contact_id", contactIds)

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    stats.set(contactId, {
      donorId: row.id as string,
      totalDonations: Number(row.total_donations || 0),
      lastDonation: (row.last_donation_date as string | null) || "",
    })
  }

  return stats
}

async function findCandidateContacts(
  supabase: Awaited<ReturnType<typeof requireDonationStaffAccess>> extends { ok: true; supabase: infer S }
    ? S
    : never,
  orgId: string,
  hints: { senderName: string; email?: string | null; phone?: string | null }
) {
  const candidates = new Map<string, ContactMatchInput>()

  const importEmail = normalizeEmail(hints.email)
  const importPhone = normalizePhone(hints.phone)

  if (importEmail) {
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .ilike("email", importEmail)
      .limit(10)

    for (const row of data || []) {
      candidates.set(row.id as string, {
        contactId: row.id as string,
        full_name: row.full_name as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
      })
    }
  }

  if (importPhone.length >= 7) {
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .not("phone", "is", null)
      .limit(200)

    for (const row of data || []) {
      if (normalizePhone(row.phone as string | null) !== importPhone) continue
      candidates.set(row.id as string, {
        contactId: row.id as string,
        full_name: row.full_name as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
      })
    }
  }

  const nameParts = getNameParts(hints.senderName)
  if (nameParts.length > 0) {
    const orFilter = buildContactSearchFilter(nameParts)
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .or(orFilter)
      .limit(40)

    for (const row of data || []) {
      candidates.set(row.id as string, {
        contactId: row.id as string,
        full_name: row.full_name as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
      })
    }
  }

  const donorStats = await loadDonorStatsByContactId(
    supabase,
    orgId,
    Array.from(candidates.keys())
  )

  return Array.from(candidates.values()).map((contact) => {
    const stat = donorStats.get(contact.contactId)
    return {
      ...contact,
      donorId: stat?.donorId ?? null,
      totalDonations: stat?.totalDonations ?? 0,
      lastDonation: stat?.lastDonation ?? "",
    }
  })
}

export async function findContactMatchesForPaymentAction(input: {
  senderName: string
  importEmail?: string | null
  importPhone?: string | null
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const contacts = await findCandidateContacts(access.supabase, access.orgId, {
    senderName: input.senderName,
    email: input.importEmail,
    phone: input.importPhone,
  })

  const hints = resolvePaymentMatchHints({
    senderName: input.senderName,
    importEmail: input.importEmail,
    importPhone: input.importPhone,
  })

  const matches = rankContactMatches(hints, contacts, 5)

  return { success: true as const, matches }
}

export async function searchContactsForPaymentMatchAction(search: string, limit = 20) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const trimmed = search.trim()
  if (!trimmed) {
    return { success: true as const, matches: [] as ContactMatchResult[] }
  }

  const { data, error } = await access.supabase
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", access.orgId)
    .or(buildManualSearchFilter(trimmed))
    .order("full_name", { ascending: true })
    .limit(Math.min(limit, 50))

  if (error) return { success: false as const, error: error.message }

  const contacts: ContactMatchInput[] = (data || []).map((row) => ({
    contactId: row.id as string,
    full_name: row.full_name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
  }))

  const donorStats = await loadDonorStatsByContactId(
    access.supabase,
    access.orgId,
    contacts.map((contact) => contact.contactId)
  )

  const enriched = contacts.map((contact) => {
    const stat = donorStats.get(contact.contactId)
    return {
      ...contact,
      donorId: stat?.donorId ?? null,
      totalDonations: stat?.totalDonations ?? 0,
      lastDonation: stat?.lastDonation ?? "",
    }
  })

  const matches = rankContactMatches(
    {
      senderName: trimmed,
      email: trimmed.includes("@") ? trimmed : null,
      phone: /^\d/.test(trimmed.replace(/\D/g, "")) ? trimmed : null,
    },
    enriched,
    limit
  )

  return { success: true as const, matches }
}

async function resolveDonorForContact(orgId: string, contactId: string) {
  const donorId = await ensureDonorExtensionForContact(orgId, contactId)
  if (!donorId) return null
  return { donorId, contactId }
}

async function fetchDonorIdsWithActiveRecurringPlans(
  supabase: SupabaseFromAccess,
  orgId: string,
  donorIds: string[]
) {
  const active = new Set<string>()
  if (donorIds.length === 0) return active

  for (let index = 0; index < donorIds.length; index += 200) {
    const chunk = donorIds.slice(index, index + 200)
    const { data, error } = await supabase
      .from("recurring_donation_plans")
      .select("donor_id")
      .eq("organization_id", orgId)
      .in("donor_id", chunk)
      .in("status", ["active", "past_due"])

    if (error) throw new Error(error.message)

    for (const row of data || []) {
      const donorId = row.donor_id as string | null
      if (donorId) active.add(donorId)
    }
  }

  return active
}

async function fetchOpenPledgesByDonorIds(
  supabase: SupabaseFromAccess,
  orgId: string,
  donorIds: string[]
) {
  const byDonor = new Map<string, PledgeAllocationCandidate[]>()
  if (donorIds.length === 0) return byDonor

  for (let index = 0; index < donorIds.length; index += 200) {
    const chunk = donorIds.slice(index, index + 200)
    const { data, error } = await supabase
      .from("pledge_status_view")
      .select("id, donor_id, balance_remaining, frequency, pledge_type")
      .eq("organization_id", orgId)
      .in("donor_id", chunk)
      .gt("balance_remaining", 0)
      .neq("calculated_status", "cancelled")

    if (error) throw new Error(error.message)

    for (const row of data || []) {
      const donorId = row.donor_id as string | null
      if (!donorId) continue

      const list = byDonor.get(donorId) || []
      list.push({
        id: row.id as string,
        donorId,
        balanceRemaining: Number(row.balance_remaining || 0),
        frequency: (row.frequency as string | null) || null,
        pledgeType: (row.pledge_type as string | null) || null,
      })
      byDonor.set(donorId, list)
    }
  }

  return byDonor
}

async function pickSmartPledgeForDonor(
  supabase: SupabaseFromAccess,
  orgId: string,
  donorId: string,
  pledgesByDonor: Map<string, PledgeAllocationCandidate[]>,
  recurringDonorIds: Set<string>
) {
  const pledges = pledgesByDonor.get(donorId) || []
  return pickPledgeForImportAllocation(pledges, {
    donorHasActiveRecurringPlan: recurringDonorIds.has(donorId),
  })
}

async function applyPaymentContactMatch(
  supabase: SupabaseFromAccess,
  orgId: string,
  input: {
    paymentId: string
    donorId: string
    contactId: string
    pledgeId?: string | null
    pledgeAttributionColumns?: Record<string, unknown>
    reconciledAt: string
  }
) {
  const allocated = Boolean(input.pledgeId)

  const { error } = await supabase
    .from("payments")
    .update({
      donor_id: input.donorId,
      contact_id: input.contactId,
      pledge_id: input.pledgeId ?? null,
      status: allocated ? "allocated" : "unallocated",
      reconciled_at: input.reconciledAt,
      ...(input.pledgeAttributionColumns || {}),
    })
    .eq("organization_id", orgId)
    .eq("id", input.paymentId)

  return { error, allocated }
}

export async function matchPaymentToContactAction(input: {
  paymentId: string
  contactId: string
  mode?: "match_only" | "allocate_best_pledge"
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const resolved = await resolveDonorForContact(access.orgId, input.contactId)
  if (!resolved) {
    return { success: false as const, error: "Could not resolve donor for this contact" }
  }

  if (input.mode === "allocate_best_pledge") {
    const pledgesByDonor = await fetchOpenPledgesByDonorIds(
      access.supabase,
      access.orgId,
      [resolved.donorId]
    )
    const recurringDonorIds = await fetchDonorIdsWithActiveRecurringPlans(
      access.supabase,
      access.orgId,
      [resolved.donorId]
    )
    const bestPledge = await pickSmartPledgeForDonor(
      access.supabase,
      access.orgId,
      resolved.donorId,
      pledgesByDonor,
      recurringDonorIds
    )

    if (bestPledge?.id) {
      const { fetchPledgeAttribution, toPaymentAttributionColumns } = await import(
        "@/lib/donations/payment-attribution"
      )
      const pledgeAttribution = await fetchPledgeAttribution(access.supabase, bestPledge.id)

      const { error } = await access.supabase
        .from("payments")
        .update({
          donor_id: resolved.donorId,
          contact_id: resolved.contactId,
          pledge_id: bestPledge.id,
          status: "allocated",
          reconciled_at: new Date().toISOString(),
          ...toPaymentAttributionColumns(pledgeAttribution),
        })
        .eq("organization_id", access.orgId)
        .eq("id", input.paymentId)

      if (error) return { success: false as const, error: error.message }

      await handleDonationAffiliationSync({
        organizationId: access.orgId,
        supabaseClient: access.supabase,
        donorId: resolved.donorId,
        contactId: resolved.contactId,
      })

      return { success: true as const, allocated: true as const }
    }
  }

  const { error } = await access.supabase
    .from("payments")
    .update({
      donor_id: resolved.donorId,
      contact_id: resolved.contactId,
      status: "unallocated",
      reconciled_at: new Date().toISOString(),
    })
    .eq("organization_id", access.orgId)
    .eq("id", input.paymentId)

  if (error) return { success: false as const, error: error.message }

  await handleDonationAffiliationSync({
    organizationId: access.orgId,
    supabaseClient: access.supabase,
    donorId: resolved.donorId,
    contactId: resolved.contactId,
  })

  return { success: true as const, allocated: false as const }
}

export async function allocatePaymentToPledgeAction(input: {
  paymentId: string
  contactId: string
  pledgeId: string
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const resolved = await resolveDonorForContact(access.orgId, input.contactId)
  if (!resolved) {
    return { success: false as const, error: "Could not resolve donor for this contact" }
  }

  const { fetchPledgeAttribution, toPaymentAttributionColumns } = await import(
    "@/lib/donations/payment-attribution"
  )
  const pledgeAttribution = await fetchPledgeAttribution(access.supabase, input.pledgeId)

  const { error } = await access.supabase
    .from("payments")
    .update({
      donor_id: resolved.donorId,
      contact_id: resolved.contactId,
      pledge_id: input.pledgeId,
      status: "allocated",
      reconciled_at: new Date().toISOString(),
      ...toPaymentAttributionColumns(pledgeAttribution),
    })
    .eq("organization_id", access.orgId)
    .eq("id", input.paymentId)

  if (error) return { success: false as const, error: error.message }

  await handleDonationAffiliationSync({
    organizationId: access.orgId,
    supabaseClient: access.supabase,
    donorId: resolved.donorId,
    contactId: resolved.contactId,
  })

  return { success: true as const }
}

export async function markPaymentUnresolvedAction(paymentId: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const { error } = await access.supabase
    .from("payments")
    .update({ status: "unresolved" })
    .eq("organization_id", access.orgId)
    .eq("id", paymentId)

  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

type SupabaseFromAccess = Awaited<
  ReturnType<typeof requireDonationStaffAccess>
> extends { ok: true; supabase: infer S }
  ? S
  : never

async function fetchAllOrgContacts(supabase: SupabaseFromAccess, orgId: string) {
  const contacts: ContactMatchInput[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true })
      .range(from, from + CONTACT_FETCH_PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    const rows = data || []
    for (const row of rows) {
      contacts.push({
        contactId: row.id as string,
        full_name: row.full_name as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
      })
    }

    if (rows.length < CONTACT_FETCH_PAGE_SIZE) break
    from += CONTACT_FETCH_PAGE_SIZE
  }

  return contacts
}

async function fetchDonorsByContactId(supabase: SupabaseFromAccess, orgId: string) {
  const donorsByContactId = new Map<string, string>()
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("donors")
      .select("id, contact_id")
      .eq("organization_id", orgId)
      .not("contact_id", "is", null)
      .range(from, from + CONTACT_FETCH_PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    const rows = data || []
    for (const row of rows) {
      const contactId = row.contact_id as string | null
      if (contactId) donorsByContactId.set(contactId, row.id as string)
    }

    if (rows.length < CONTACT_FETCH_PAGE_SIZE) break
    from += CONTACT_FETCH_PAGE_SIZE
  }

  return donorsByContactId
}

async function bulkEnsureDonorExtensions(
  supabase: SupabaseFromAccess,
  orgId: string,
  contactIds: string[],
  donorsByContactId: Map<string, string>
) {
  const missing = [...new Set(contactIds)].filter((contactId) => !donorsByContactId.has(contactId))
  if (missing.length === 0) return donorsByContactId

  for (let index = 0; index < missing.length; index += 200) {
    const chunk = missing.slice(index, index + 200)
    const { data: contacts, error: contactError } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone, contact_type")
      .eq("organization_id", orgId)
      .in("id", chunk)

    if (contactError) throw new Error(contactError.message)

    const payload = (contacts || []).map((contact) => ({
      organization_id: orgId,
      contact_id: contact.id as string,
      full_name: (contact.full_name as string | null) || "Unnamed",
      email: contact.email as string | null,
      phone: contact.phone as string | null,
      donor_type:
        (contact.contact_type as string | null) === "organization" ||
        (contact.contact_type as string | null) === "group"
          ? "organization"
          : "individual",
      status: "active",
    }))

    if (payload.length === 0) continue

    const { data: created, error: insertError } = await supabase
      .from("donors")
      .insert(payload)
      .select("id, contact_id")

    if (insertError) {
      for (const contactId of chunk) {
        const donorId = await ensureDonorExtensionForContact(orgId, contactId, supabase)
        if (donorId) donorsByContactId.set(contactId, donorId)
      }
      continue
    }

    for (const row of created || []) {
      const contactId = row.contact_id as string | null
      if (contactId) donorsByContactId.set(contactId, row.id as string)
    }
  }

  return donorsByContactId
}

export type BulkAutoMatchInput = {
  minScore?: number
  importBatchId?: string | null
  limit?: number
  autoAllocatePledge?: boolean
  autoCreateContacts?: boolean
}

export async function bulkAutoMatchImportPaymentsAction(input: BulkAutoMatchInput = {}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const minScore = input.minScore ?? 85
  const limit = Math.min(input.limit ?? BULK_AUTO_MATCH_PAYMENT_BATCH, BULK_AUTO_MATCH_PAYMENT_BATCH)
  const autoAllocatePledge = input.autoAllocatePledge !== false
  const autoCreateContacts = input.autoCreateContacts !== false

  try {
    let contactIndex: ContactLookupIndex | null = null
    let donorsByContactId: Map<string, string> | null = null

    const loadIndexes = async () => {
      if (!contactIndex || !donorsByContactId) {
        const [contacts, donors] = await Promise.all([
          fetchAllOrgContacts(access.supabase, access.orgId),
          fetchDonorsByContactId(access.supabase, access.orgId),
        ])
        contactIndex = buildContactLookupIndex(contacts)
        donorsByContactId = donors
      }
    }

    await loadIndexes()

    let paymentQuery = access.supabase
      .from("payments")
      .select("id, sender_name, import_email, import_phone")
      .eq("organization_id", access.orgId)
      .eq("status", "pending_review")
      .is("contact_id", null)
      .order("payment_date", { ascending: false })
      .limit(limit)

    if (input.importBatchId) {
      paymentQuery = paymentQuery.eq("import_batch_id", input.importBatchId)
    }

    const { data: pendingPayments, error: paymentError } = await paymentQuery
    if (paymentError) return { success: false as const, error: paymentError.message }

    const toMatch: Array<{ paymentId: string; contactId: string }> = []
    let skipped = 0
    let contactsCreated = 0
    const autoCreatedContactByName = new Map<string, string>()

    for (const payment of pendingPayments || []) {
      const hints = resolvePaymentMatchHints({
        senderName: (payment.sender_name as string | null) || "",
        importEmail: payment.import_email as string | null,
        importPhone: payment.import_phone as string | null,
      })

      const match = findAutoMatchForPayment(
        hints,
        contactIndex!,
        donorsByContactId!,
        minScore
      )

      let contactId = match?.contactId ?? null

      if (
        !contactId &&
        autoCreateContacts &&
        canAutoCreateContactFromPaymentHints(hints)
      ) {
        const nameKey = normalizeName(hints.senderName)
        const cachedContactId = autoCreatedContactByName.get(nameKey)

        if (cachedContactId) {
          contactId = cachedContactId
        } else {
          try {
            const created = await findOrCreateContact({
              organizationId: access.orgId,
              fullName: hints.senderName,
              contactType: guessImportContactType(hints.senderName),
            })

            contactId = created.contactId
            autoCreatedContactByName.set(nameKey, created.contactId)

            if (created.created) {
              contactsCreated += 1
            }
          } catch (error) {
            skipped += 1
            continue
          }
        }
      }

      if (!contactId) {
        skipped += 1
        continue
      }

      toMatch.push({ paymentId: payment.id as string, contactId })
    }

    if (toMatch.length === 0) {
      const remaining = await countRemainingPendingPayments(
        access.supabase,
        access.orgId,
        input.importBatchId
      )
      return {
        success: true as const,
        matched: 0,
        allocated: 0,
        matchedUnallocated: 0,
        skipped,
        contactsCreated,
        remaining,
        errors: [] as string[],
      }
    }

    const contactIds = toMatch.map((row) => row.contactId)
    donorsByContactId = await bulkEnsureDonorExtensions(
      access.supabase,
      access.orgId,
      [...new Set([...contactIds, ...autoCreatedContactByName.values()])],
      donorsByContactId!
    )

    const donorIds = [
      ...new Set(
        toMatch
          .map((row) => donorsByContactId!.get(row.contactId))
          .filter((donorId): donorId is string => Boolean(donorId))
      ),
    ]

    const [pledgesByDonor, recurringDonorIds] = await Promise.all([
      fetchOpenPledgesByDonorIds(access.supabase, access.orgId, donorIds),
      fetchDonorIdsWithActiveRecurringPlans(access.supabase, access.orgId, donorIds),
    ])

    const { fetchPledgeAttribution, toPaymentAttributionColumns } = await import(
      "@/lib/donations/payment-attribution"
    )
    const attributionByPledgeId = new Map<string, Record<string, unknown>>()

    const reconciledAt = new Date().toISOString()
    let allocated = 0
    let matchedUnallocated = 0

    for (let index = 0; index < toMatch.length; index += BULK_PAYMENT_UPDATE_PARALLEL) {
      const chunk = toMatch.slice(index, index + BULK_PAYMENT_UPDATE_PARALLEL)
      await Promise.all(
        chunk.map(async (row) => {
          const donorId = donorsByContactId!.get(row.contactId)
          if (!donorId) return

          let pledgeId: string | null = null
          let pledgeAttributionColumns: Record<string, unknown> = {}

          if (autoAllocatePledge) {
            const bestPledge = pickPledgeForImportAllocation(
              pledgesByDonor.get(donorId) || [],
              { donorHasActiveRecurringPlan: recurringDonorIds.has(donorId) }
            )

            if (bestPledge?.id) {
              pledgeId = bestPledge.id
              if (!attributionByPledgeId.has(pledgeId)) {
                const attribution = await fetchPledgeAttribution(access.supabase, pledgeId)
                attributionByPledgeId.set(pledgeId, toPaymentAttributionColumns(attribution))
              }
              pledgeAttributionColumns = attributionByPledgeId.get(pledgeId) || {}
            }
          }

          const result = await applyPaymentContactMatch(access.supabase, access.orgId, {
            paymentId: row.paymentId,
            donorId,
            contactId: row.contactId,
            pledgeId,
            pledgeAttributionColumns,
            reconciledAt,
          })

          if (!result.error) {
            if (result.allocated) allocated += 1
            else matchedUnallocated += 1
          }
        })
      )
    }

    const uniqueContactIds = [...new Set(contactIds)]
    for (let index = 0; index < uniqueContactIds.length; index += BULK_AFFILIATION_SYNC_PARALLEL) {
      const chunk = uniqueContactIds.slice(index, index + BULK_AFFILIATION_SYNC_PARALLEL)
      await Promise.all(
        chunk.map((contactId) =>
          handleDonationAffiliationSync({
            organizationId: access.orgId,
            supabaseClient: access.supabase,
            contactId,
            donorId: donorsByContactId!.get(contactId) ?? null,
          })
        )
      )
    }

    const remaining = await countRemainingPendingPayments(
      access.supabase,
      access.orgId,
      input.importBatchId
    )

    return {
      success: true as const,
      matched: toMatch.length,
      allocated,
      matchedUnallocated,
      skipped,
      contactsCreated,
      remaining,
      errors: [] as string[],
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Bulk auto-match failed",
    }
  }
}

async function countRemainingPendingPayments(
  supabase: SupabaseFromAccess,
  orgId: string,
  importBatchId?: string | null
) {
  let query = supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "pending_review")
    .is("contact_id", null)

  if (importBatchId) {
    query = query.eq("import_batch_id", importBatchId)
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function fetchPaymentImportHistoryAction() {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("payment_import_batches")
    .select("id, file_name, row_count, status, created_at")
    .eq("organization_id", access.orgId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return { success: false as const, error: error.message }

  const batches = data || []
  const batchIds = batches.map((batch) => batch.id as string)
  const importedCounts = new Map<string, number>()

  if (batchIds.length > 0) {
    const { data: paymentRows } = await access.supabase
      .from("payments")
      .select("import_batch_id")
      .eq("organization_id", access.orgId)
      .in("import_batch_id", batchIds)

    for (const row of paymentRows || []) {
      const batchId = row.import_batch_id as string | null
      if (!batchId) continue
      importedCounts.set(batchId, (importedCounts.get(batchId) || 0) + 1)
    }
  }

  return {
    success: true as const,
    batches: batches.map((batch) => ({
      id: batch.id as string,
      fileName: (batch.file_name as string | null) || "payment-import.csv",
      rowCount: Number(batch.row_count || 0),
      status: (batch.status as string | null) || "imported",
      createdAt: (batch.created_at as string | null) || "",
      importedPayments: importedCounts.get(batch.id as string) || 0,
    })),
  }
}

export async function fetchOpenPledgesForDonorAction(donorId: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("pledge_status_view")
    .select(
      "id, donor_id, donor_name, campaign_name, amount_pledged, amount_paid, balance_remaining, pledge_date"
    )
    .eq("organization_id", access.orgId)
    .eq("donor_id", donorId)
    .gt("balance_remaining", 0)
    .order("balance_remaining", { ascending: false })

  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    pledges: (data || []).map((row) => ({
      id: row.id as string,
      donorId: (row.donor_id as string | null) || null,
      donorName: (row.donor_name as string | null) || "Unknown",
      campaign: (row.campaign_name as string | null) || "No Campaign",
      totalAmount: Number(row.amount_pledged || 0),
      paidAmount: Number(row.amount_paid || 0),
      remainingAmount: Number(row.balance_remaining || 0),
      dueDate: (row.pledge_date as string | null) || null,
    })),
  }
}

export async function fetchAllOpenPledgesAction() {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("pledge_status_view")
    .select(
      "id, donor_id, donor_name, campaign_name, amount_pledged, amount_paid, balance_remaining, pledge_date"
    )
    .eq("organization_id", access.orgId)
    .gt("balance_remaining", 0)
    .order("donor_name", { ascending: true })

  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    pledges: (data || []).map((row) => ({
      id: row.id as string,
      donorId: (row.donor_id as string | null) || null,
      donorName: (row.donor_name as string | null) || "Unknown",
      campaign: (row.campaign_name as string | null) || "No Campaign",
      totalAmount: Number(row.amount_pledged || 0),
      paidAmount: Number(row.amount_paid || 0),
      remainingAmount: Number(row.balance_remaining || 0),
      dueDate: (row.pledge_date as string | null) || null,
    })),
  }
}
