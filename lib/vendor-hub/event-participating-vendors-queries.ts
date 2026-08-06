import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export type EventParticipatingVendorRow = {
  contactId: string
  businessName: string
  contactName: string
  email: string | null
  phone: string | null
  lifecycleStatus: string | null
  boothType: string | null
  boothId: string | null
  boothNumber: string | null
  assignmentId: string | null
  participantId: string | null
  vendorTypeId: string | null
  amountPaid: number
  paymentCount: number
  notes: string | null
  profileHref: string
}

function parseCategoryFromNotes(notes: string | null | undefined) {
  if (!notes) return null
  const match = String(notes).match(/(?:^|\n)category=([^\n]*)/i)
  const value = match?.[1]?.trim()
  return value || null
}

function stripCategoryFromNotes(notes: string | null | undefined) {
  if (!notes) return null
  const cleaned = String(notes)
    .split("\n")
    .filter((line) => !/^category=/i.test(line.trim()))
    .join("\n")
    .trim()
  return cleaned || null
}

function businessNameFromFormData(formData: unknown) {
  if (!formData || typeof formData !== "object") return null
  const value = (formData as Record<string, unknown>).business_name
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function vendorTypeIdFromFormData(formData: unknown) {
  if (!formData || typeof formData !== "object") return null
  const value = (formData as Record<string, unknown>).vendor_type_id
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

/**
 * Contact-centric list of vendors who participated in a bazaar event
 * (participant status, booth assignments, and/or payments).
 * Cancelled participants are excluded.
 */
export async function getEventParticipatingVendors(
  eventId: string
): Promise<EventParticipatingVendorRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()

  const [participantsResult, assignmentsResult, paymentsResult] = await Promise.all([
    supabase
      .from("vendor_hub_participant_status")
      .select("id, contact_id, lifecycle_status, notes, updated_at, created_at")
      .eq("organization_id", organizationId)
      .eq("vendor_hub_event_id", eventId),
    supabase
      .from("vendor_hub_booth_assignments")
      .select("id, contact_id, booth_id, fee_amount, status, created_at")
      .eq("event_id", eventId),
    supabase
      .from("vendor_hub_payments")
      .select("id, contact_id, amount, notes, payment_type, payment_date, created_at")
      .eq("event_id", eventId),
  ])

  if (participantsResult.error) {
    console.error("getEventParticipatingVendors participants:", participantsResult.error.message)
  }
  if (assignmentsResult.error) {
    console.error("getEventParticipatingVendors assignments:", assignmentsResult.error.message)
  }
  if (paymentsResult.error) {
    console.error("getEventParticipatingVendors payments:", paymentsResult.error.message)
  }

  const cancelledContactIds = new Set<string>()
  for (const row of participantsResult.data ?? []) {
    if ((row.lifecycle_status as string | null) === "cancelled" && row.contact_id) {
      cancelledContactIds.add(row.contact_id as string)
    }
  }

  const contactIds = new Set<string>()
  for (const row of participantsResult.data ?? []) {
    if (!row.contact_id) continue
    if ((row.lifecycle_status as string | null) === "cancelled") continue
    contactIds.add(row.contact_id as string)
  }
  for (const row of assignmentsResult.data ?? []) {
    if (!row.contact_id) continue
    const contactId = row.contact_id as string
    if (cancelledContactIds.has(contactId)) continue
    const status = (row.status as string | null) || ""
    if (status === "cancelled") continue
    contactIds.add(contactId)
  }
  for (const row of paymentsResult.data ?? []) {
    if (!row.contact_id) continue
    const contactId = row.contact_id as string
    if (cancelledContactIds.has(contactId)) continue
    contactIds.add(contactId)
  }

  if (contactIds.size === 0) return []

  const ids = [...contactIds]
  const boothIds = [
    ...new Set(
      (assignmentsResult.data ?? [])
        .map((row) => row.booth_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const [contactsResult, applicationsResult, boothsResult] = await Promise.all([
    supabase.from("contacts").select("id, full_name, email, phone").in("id", ids),
    supabase
      .from("applications")
      .select("contact_id, form_data, created_at, module_owner")
      .eq("organization_id", organizationId)
      .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
      .in("contact_id", ids)
      .order("created_at", { ascending: false }),
    boothIds.length > 0
      ? supabase.from("vendor_hub_booths").select("id, number").in("id", boothIds)
      : Promise.resolve({ data: [] as { id: string; number: string }[], error: null }),
  ])

  const contactById = new Map(
    (contactsResult.data ?? []).map((row) => [row.id as string, row])
  )
  const boothNumberById = new Map(
    (boothsResult.data ?? []).map((row) => [row.id as string, String(row.number)])
  )

  const businessByContact = new Map<string, string>()
  const vendorTypeIdByContact = new Map<string, string>()
  for (const app of applicationsResult.data ?? []) {
    const contactId = app.contact_id as string | null
    if (!contactId) continue
    const moduleOwner = (app.module_owner as string | null) || null
    if (
      moduleOwner &&
      moduleOwner !== VENDOR_ORG_APPLICATION_MODULE &&
      moduleOwner !== "bazaar"
    ) {
      continue
    }
    if (!businessByContact.has(contactId)) {
      const businessName = businessNameFromFormData(app.form_data)
      if (businessName) businessByContact.set(contactId, businessName)
    }
    if (!vendorTypeIdByContact.has(contactId)) {
      const typeId = vendorTypeIdFromFormData(app.form_data)
      if (typeId) vendorTypeIdByContact.set(contactId, typeId)
    }
  }

  const participantByContact = new Map<
    string,
    NonNullable<typeof participantsResult.data>[number]
  >()
  for (const row of participantsResult.data ?? []) {
    const contactId = row.contact_id as string
    if ((row.lifecycle_status as string | null) === "cancelled") continue
    if (!participantByContact.has(contactId)) {
      participantByContact.set(contactId, row)
    }
  }

  const assignmentByContact = new Map<
    string,
    NonNullable<typeof assignmentsResult.data>[number]
  >()
  for (const row of assignmentsResult.data ?? []) {
    const contactId = row.contact_id as string
    const status = (row.status as string | null) || ""
    if (status === "cancelled") continue
    if (!assignmentByContact.has(contactId)) {
      assignmentByContact.set(contactId, row)
    }
  }

  const paymentAggByContact = new Map<
    string,
    { total: number; count: number; boothType: string | null }
  >()
  for (const payment of paymentsResult.data ?? []) {
    const contactId = payment.contact_id as string | null
    if (!contactId) continue
    const amount = Number(payment.amount || 0)
    const isRefund = (payment.payment_type as string | null) === "refund"
    const existing = paymentAggByContact.get(contactId) ?? {
      total: 0,
      count: 0,
      boothType: null as string | null,
    }
    existing.count += 1
    if (Number.isFinite(amount)) {
      existing.total += isRefund ? -Math.abs(amount) : amount
    }
    if (!existing.boothType && !isRefund) {
      existing.boothType = parseCategoryFromNotes(payment.notes as string | null)
    }
    paymentAggByContact.set(contactId, existing)
  }

  // Drop payment-only contacts whose net is <= 0 and who have no active participation
  const activeIds = ids.filter((contactId) => {
    const participant = participantByContact.get(contactId)
    const assignment = assignmentByContact.get(contactId)
    if (participant || assignment) return true
    const payments = paymentAggByContact.get(contactId)
    return Boolean(payments && payments.total > 0)
  })

  const rows: EventParticipatingVendorRow[] = activeIds.map((contactId) => {
    const contact = contactById.get(contactId)
    const contactName = (contact?.full_name as string | null)?.trim() || "Unnamed contact"
    const businessName = businessByContact.get(contactId) || contactName
    const participant = participantByContact.get(contactId)
    const assignment = assignmentByContact.get(contactId)
    const payments = paymentAggByContact.get(contactId)
    const boothId = (assignment?.booth_id as string | null) ?? null
    const boothNumber = boothId ? boothNumberById.get(boothId) ?? null : null
    const categoryFromNotes =
      parseCategoryFromNotes(participant?.notes as string | null) || payments?.boothType || null

    return {
      contactId,
      businessName,
      contactName,
      email: (contact?.email as string | null) ?? null,
      phone: (contact?.phone as string | null) ?? null,
      lifecycleStatus:
        (participant?.lifecycle_status as string | null) ??
        (assignment?.status as string | null) ??
        (payments && payments.total > 0 ? "paid" : null),
      boothType: categoryFromNotes,
      boothId,
      boothNumber,
      assignmentId: (assignment?.id as string | null) ?? null,
      participantId: (participant?.id as string | null) ?? null,
      vendorTypeId: vendorTypeIdByContact.get(contactId) ?? null,
      amountPaid: Math.max(0, payments?.total ?? 0),
      paymentCount: payments?.count ?? 0,
      notes: stripCategoryFromNotes(participant?.notes as string | null),
      profileHref: VENDOR_HUB_ROUTES.network.vendor(contactId),
    }
  })

  rows.sort((a, b) => a.businessName.localeCompare(b.businessName))
  return rows
}

export { parseCategoryFromNotes, stripCategoryFromNotes }
