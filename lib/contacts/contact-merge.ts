import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getContactRecordTypeLabel,
  isEntityContactType,
  normalizeContactRecordType,
} from "@/lib/contacts/contact-constants"
import {
  resolveCanonicalDonorSenderName,
  syncPaymentSenderNamesForDonor,
} from "@/lib/donations/payment-donor-display"

export type ContactMergeRow = {
  id: string
  organization_id: string
  full_name: string | null
  email: string | null
  phone: string | null
  contact_type?: string | null
  primary_contact_name?: string | null
  status?: string | null
  notes?: string | null
}

export type ContactMergeStep =
  | { table: string; column?: string; rows?: number; deleted?: number; relinked?: number; patched?: Record<string, string>; note?: string; deletedSource?: string; contactId?: string }

export type ContactMergePreview = {
  target: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    donor_id: string | null
  }
  source: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    donor_id: string | null
  }
  contactInventory: Record<string, number>
  donorInventory: Record<string, number>
  contactPatch: Record<string, string>
  steps: ContactMergeStep[]
}

const CONTACT_ID_COLUMNS: Array<[string, string]> = [
  ["payments", "contact_id"],
  ["pledges", "contact_id"],
  ["recurring_donation_plans", "contact_id"],
  ["donation_checkout_sessions", "contact_id"],
  ["donation_receipts", "contact_id"],
  ["pledge_reminders", "contact_id"],
  ["contact_notes", "contact_id"],
  ["contact_roles", "contact_id"],
  ["volunteers", "contact_id"],
  ["staff", "contact_id"],
  ["applications", "contact_id"],
  ["ticket_orders", "contact_id"],
  ["memberships", "contact_id"],
  ["program_enrollments", "participant_contact_id"],
  ["program_enrollments", "registrant_contact_id"],
  ["program_enrollments", "payer_contact_id"],
]

const DONOR_ID_COLUMNS: Array<[string, string]> = [
  ["payments", "donor_id"],
  ["pledges", "donor_id"],
  ["recurring_donation_plans", "donor_id"],
  ["donation_checkout_sessions", "donor_id"],
  ["donation_receipts", "donor_id"],
  ["pledge_reminders", "donor_id"],
]

async function countRows(
  supabase: SupabaseClient,
  table: string,
  orgId: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq(column, value)

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return 0
    console.error(`contact merge count failed for ${table}.${column}:`, error)
    return 0
  }
  return count ?? 0
}

function mergeEligibilityError(contact: ContactMergeRow, label: string): string | null {
  const type = normalizeContactRecordType(contact.contact_type)
  if (isEntityContactType(type)) {
    return `Cannot merge ${label}: ${getContactRecordTypeLabel(type)} records cannot be merged.`
  }
  return null
}

export async function loadContactForMerge(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string
): Promise<ContactMergeRow | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, organization_id, full_name, email, phone, contact_type, primary_contact_name, status, notes"
    )
    .eq("organization_id", orgId)
    .eq("id", contactId)
    .maybeSingle()

  if (error) throw error
  return (data as ContactMergeRow | null) ?? null
}

async function findDonorForContact(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string
) {
  const { data, error } = await supabase
    .from("donors")
    .select("id, full_name, email, phone, donor_type, contact_id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (error && error.code !== "42P01") throw error
  return data ?? null
}

async function inventoryContact(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const [table, column] of CONTACT_ID_COLUMNS) {
    counts[`${table}.${column}`] = await countRows(supabase, table, orgId, column, contactId)
  }
  return counts
}

async function inventoryDonor(
  supabase: SupabaseClient,
  orgId: string,
  donorId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const [table, column] of DONOR_ID_COLUMNS) {
    counts[`${table}.${column}`] = await countRows(supabase, table, orgId, column, donorId)
  }
  return counts
}

function pickContactPatch(target: ContactMergeRow, source: ContactMergeRow): Record<string, string> {
  const patch: Record<string, string> = {}
  if (!target.email && source.email) patch.email = source.email
  if (!target.phone && source.phone) patch.phone = source.phone
  if (!target.primary_contact_name && source.primary_contact_name) {
    patch.primary_contact_name = source.primary_contact_name
  }
  if (!target.notes && source.notes) patch.notes = source.notes
  return patch
}

async function reassignContactColumn(
  supabase: SupabaseClient,
  orgId: string,
  table: string,
  column: string,
  sourceContactId: string,
  targetContactId: string,
  execute: boolean
): Promise<number> {
  const rowCount = await countRows(supabase, table, orgId, column, sourceContactId)
  if (rowCount === 0) return 0
  if (!execute) return rowCount

  const { error } = await supabase
    .from(table)
    .update({ [column]: targetContactId })
    .eq("organization_id", orgId)
    .eq(column, sourceContactId)

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return 0
    throw new Error(`${table}.${column}: ${error.message}`)
  }
  return rowCount
}

async function mergeContactRoles(
  supabase: SupabaseClient,
  orgId: string,
  sourceContactId: string,
  targetContactId: string,
  execute: boolean
): Promise<number> {
  const [{ data: targetRoles }, { data: sourceRoles }] = await Promise.all([
    supabase
      .from("contact_roles")
      .select("id, role")
      .eq("organization_id", orgId)
      .eq("contact_id", targetContactId),
    supabase
      .from("contact_roles")
      .select("id, role")
      .eq("organization_id", orgId)
      .eq("contact_id", sourceContactId),
  ])

  const targetRoleSet = new Set((targetRoles || []).map((row) => row.role as string))
  let moved = 0

  for (const row of sourceRoles || []) {
    if (targetRoleSet.has(row.role as string)) {
      if (execute) {
        await supabase.from("contact_roles").delete().eq("id", row.id)
      }
      moved += 1
      continue
    }

    if (execute) {
      const { error } = await supabase
        .from("contact_roles")
        .update({ contact_id: targetContactId })
        .eq("id", row.id)
      if (error) throw new Error(`contact_roles: ${error.message}`)
    }
    targetRoleSet.add(row.role as string)
    moved += 1
  }

  return moved
}

async function mergeDonorIntoTarget(
  supabase: SupabaseClient,
  orgId: string,
  sourceDonorId: string,
  targetDonorId: string,
  targetContactId: string,
  execute: boolean,
  canonicalSenderName?: string | null
): Promise<ContactMergeStep[]> {
  const paymentPatch = {
    donor_id: targetDonorId,
    contact_id: targetContactId,
    ...(canonicalSenderName ? { sender_name: canonicalSenderName } : {}),
  }
  const donorPatch = { donor_id: targetDonorId, contact_id: targetContactId }
  const pledgePatch = { donor_id: targetDonorId }

  const tables = [
    { table: "payments", patch: paymentPatch },
    { table: "pledges", patch: pledgePatch },
    { table: "recurring_donation_plans", patch: donorPatch },
    { table: "donation_checkout_sessions", patch: donorPatch },
    { table: "donation_receipts", patch: donorPatch },
    { table: "pledge_reminders", patch: donorPatch },
  ]

  const steps: ContactMergeStep[] = []
  for (const { table, patch } of tables) {
    const rowCount = await countRows(supabase, table, orgId, "donor_id", sourceDonorId)
    if (rowCount === 0) continue

    if (execute) {
      const { error } = await supabase
        .from(table)
        .update(patch)
        .eq("organization_id", orgId)
        .eq("donor_id", sourceDonorId)
      if (error && error.code !== "42P01") {
        throw new Error(`${table} donor merge: ${error.message}`)
      }
    }
    steps.push({ table, rows: rowCount })
  }

  if (execute) {
    const { error } = await supabase.from("donors").delete().eq("id", sourceDonorId)
    if (error) throw new Error(`donor delete (${sourceDonorId}): ${error.message}`)
  }

  steps.push({ table: "donors", deleted: 1 })
  return steps
}

async function relinkDonorToTarget(
  supabase: SupabaseClient,
  orgId: string,
  donorId: string,
  targetContactId: string,
  execute: boolean
): Promise<ContactMergeStep> {
  if (execute) {
    const { error: donorError } = await supabase
      .from("donors")
      .update({ contact_id: targetContactId })
      .eq("organization_id", orgId)
      .eq("id", donorId)

    if (donorError) throw new Error(`donor relink: ${donorError.message}`)

    const { error: paymentError } = await supabase
      .from("payments")
      .update({ contact_id: targetContactId })
      .eq("organization_id", orgId)
      .eq("donor_id", donorId)

    if (paymentError && paymentError.code !== "42P01") {
      throw new Error(`payments contact relink: ${paymentError.message}`)
    }
  }

  return { table: "donors", relinked: 1 }
}

export async function previewContactMerge(
  supabase: SupabaseClient,
  orgId: string,
  targetContactId: string,
  sourceContactId: string
): Promise<ContactMergePreview | { error: string }> {
  if (targetContactId === sourceContactId) {
    return { error: "Choose a different contact to merge." }
  }

  const [target, source] = await Promise.all([
    loadContactForMerge(supabase, orgId, targetContactId),
    loadContactForMerge(supabase, orgId, sourceContactId),
  ])

  if (!target) return { error: "Target contact not found." }
  if (!source) return { error: "Source contact not found." }

  const targetEligibilityError = mergeEligibilityError(target, "into this contact")
  if (targetEligibilityError) return { error: targetEligibilityError }

  const sourceEligibilityError = mergeEligibilityError(source, "this duplicate")
  if (sourceEligibilityError) return { error: sourceEligibilityError }

  const [targetDonor, sourceDonor] = await Promise.all([
    findDonorForContact(supabase, orgId, target.id),
    findDonorForContact(supabase, orgId, source.id),
  ])

  const steps: ContactMergeStep[] = []

  if (targetDonor && sourceDonor) {
    if (targetDonor.id === sourceDonor.id) {
      steps.push({ table: "donors", note: "same donor row already linked" })
    } else {
      steps.push(
        ...(await mergeDonorIntoTarget(
          supabase,
          orgId,
          sourceDonor.id,
          targetDonor.id,
          target.id,
          false
        ))
      )
    }
  } else if (sourceDonor) {
    steps.push(await relinkDonorToTarget(supabase, orgId, sourceDonor.id, target.id, false))
  }

  for (const [table, column] of CONTACT_ID_COLUMNS) {
    if (table === "contact_roles") continue
    const rows = await reassignContactColumn(
      supabase,
      orgId,
      table,
      column,
      source.id,
      target.id,
      false
    )
    if (rows > 0) steps.push({ table, column, rows })
  }

  const roleRows = await mergeContactRoles(supabase, orgId, source.id, target.id, false)
  if (roleRows > 0) steps.push({ table: "contact_roles", rows: roleRows })

  const contactPatch = pickContactPatch(target, source)
  if (Object.keys(contactPatch).length > 0) {
    steps.push({ table: "contacts", patched: contactPatch })
  }

  steps.push({ table: "contacts", deletedSource: source.id })
  steps.push({ table: "sync_contact_affiliations", contactId: target.id })

  return {
    target: {
      id: target.id,
      full_name: target.full_name,
      email: target.email,
      phone: target.phone,
      donor_id: targetDonor?.id ?? null,
    },
    source: {
      id: source.id,
      full_name: source.full_name,
      email: source.email,
      phone: source.phone,
      donor_id: sourceDonor?.id ?? null,
    },
    contactInventory: await inventoryContact(supabase, orgId, source.id),
    donorInventory: sourceDonor ? await inventoryDonor(supabase, orgId, sourceDonor.id) : {},
    contactPatch,
    steps,
  }
}

export async function executeContactMerge(
  supabase: SupabaseClient,
  orgId: string,
  targetContactId: string,
  sourceContactId: string
): Promise<ContactMergePreview | { error: string }> {
  const preview = await previewContactMerge(supabase, orgId, targetContactId, sourceContactId)
  if ("error" in preview) return preview

  const target = await loadContactForMerge(supabase, orgId, targetContactId)
  const source = await loadContactForMerge(supabase, orgId, sourceContactId)
  if (!target || !source) return { error: "Contact not found." }

  const [targetDonor, sourceDonor] = await Promise.all([
    findDonorForContact(supabase, orgId, target.id),
    findDonorForContact(supabase, orgId, source.id),
  ])

  const canonicalSenderName = await resolveCanonicalDonorSenderName(
    supabase,
    orgId,
    target.id,
    targetDonor?.id ?? sourceDonor?.id ?? null
  )

  if (targetDonor && sourceDonor) {
    if (targetDonor.id !== sourceDonor.id) {
      await mergeDonorIntoTarget(
        supabase,
        orgId,
        sourceDonor.id,
        targetDonor.id,
        target.id,
        true,
        canonicalSenderName
      )
    }
  } else if (sourceDonor) {
    await relinkDonorToTarget(supabase, orgId, sourceDonor.id, target.id, true)
  }

  for (const [table, column] of CONTACT_ID_COLUMNS) {
    if (table === "contact_roles") continue
    await reassignContactColumn(supabase, orgId, table, column, source.id, target.id, true)
  }

  await mergeContactRoles(supabase, orgId, source.id, target.id, true)

  if (Object.keys(preview.contactPatch).length > 0) {
    const { error } = await supabase
      .from("contacts")
      .update(preview.contactPatch)
      .eq("organization_id", orgId)
      .eq("id", target.id)
    if (error) throw new Error(`target contact patch: ${error.message}`)
  }

  const { error: deleteError } = await supabase
    .from("contacts")
    .delete()
    .eq("organization_id", orgId)
    .eq("id", source.id)

  if (deleteError) throw new Error(`source contact delete: ${deleteError.message}`)

  const survivingDonorId =
    targetDonor?.id ??
    sourceDonor?.id ??
    (await findDonorForContact(supabase, orgId, target.id))?.id ??
    null

  if (survivingDonorId && canonicalSenderName) {
    await syncPaymentSenderNamesForDonor(
      supabase,
      orgId,
      survivingDonorId,
      canonicalSenderName
    )

    const { error: donorNameError } = await supabase
      .from("donors")
      .update({
        full_name: canonicalSenderName,
        email: target.email,
        phone: target.phone,
        contact_id: target.id,
      })
      .eq("organization_id", orgId)
      .eq("id", survivingDonorId)

    if (donorNameError && donorNameError.code !== "42P01") {
      throw new Error(`donor name sync: ${donorNameError.message}`)
    }
  }

  return preview
}
