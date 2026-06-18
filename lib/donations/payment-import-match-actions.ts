"use server"

import { handleDonationAffiliationSync } from "@/lib/contacts/contact-affiliation-sync"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import {
  buildContactSearchFilter,
  buildManualSearchFilter,
  getNameParts,
  isAutoMatchEligible,
  rankContactMatches,
  type ContactMatchInput,
  type ContactMatchResult,
} from "@/lib/donations/payment-contact-matching"
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

  const matches = rankContactMatches(
    {
      senderName: input.senderName,
      email: input.importEmail,
      phone: input.importPhone,
    },
    contacts,
    5
  )

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
    const { data: pledges, error: pledgeError } = await access.supabase
      .from("pledge_status_view")
      .select("id, balance_remaining")
      .eq("organization_id", access.orgId)
      .eq("donor_id", resolved.donorId)
      .gt("balance_remaining", 0)
      .order("balance_remaining", { ascending: false })
      .limit(1)

    if (pledgeError) {
      return { success: false as const, error: pledgeError.message }
    }

    const bestPledge = pledges?.[0]
    if (bestPledge?.id) {
      const { fetchPledgeAttribution, toPaymentAttributionColumns } = await import(
        "@/lib/donations/payment-attribution"
      )
      const pledgeAttribution = await fetchPledgeAttribution(access.supabase, bestPledge.id as string)

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

export async function bulkAutoMatchImportPaymentsAction(minScore = 85) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const queueResult = await fetchPaymentMatchQueueAction()
  if (!queueResult.success) return queueResult

  const pending = queueResult.payments.filter((payment) => payment.status === "pending_review")

  let matched = 0
  let skipped = 0
  const errors: string[] = []

  for (const payment of pending) {
    const matchResult = await findContactMatchesForPaymentAction({
      senderName: payment.senderName,
      importEmail: payment.importEmail,
      importPhone: payment.importPhone,
    })

    if (!matchResult.success) {
      errors.push(`${payment.senderName}: ${matchResult.error}`)
      skipped += 1
      continue
    }

    if (!isAutoMatchEligible(matchResult.matches, minScore)) {
      skipped += 1
      continue
    }

    const topMatch = matchResult.matches[0]
    const result = await matchPaymentToContactAction({
      paymentId: payment.id,
      contactId: topMatch.contactId,
      mode: "match_only",
    })

    if (!result.success) {
      errors.push(`${payment.senderName}: ${result.error}`)
      skipped += 1
      continue
    }

    matched += 1
  }

  return {
    success: true as const,
    matched,
    skipped,
    errors,
  }
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
