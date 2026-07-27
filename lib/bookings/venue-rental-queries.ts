import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import {
  reservationStatusBlocksBooking,
  type ConflictCheckReservation,
} from "@/lib/reservations/reservation-conflict-rules"
import { rangesOverlap } from "@/lib/reservations/reservation-time"

import {
  formatVenueRentalDateTime,
  formatVenueRentalSpaceLine,
  resolveVenueRentalEventTypeName,
  resolveVenueRentalSubmittedAt,
  shortVenueRentalId,
} from "./venue-rental-format"
import {
  getVenueRentalCalendarColor,
  getVenueRentalStatusLabel,
} from "./venue-rental-status"
import type {
  RentalAddonCatalogItem,
  RentalPaymentRecord,
  RentalReservationRecord,
  PublicAvailabilityBlock,
  VenueRentalDashboardStats,
  VenueRentalPaymentReportRow,
  VenueRentalQueueRow,
  VenueRentalRecord,
  VenueRentalStatus,
} from "./venue-rental-types"
import {
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
  VENUE_RENTAL_STATUSES,
} from "./venue-rental-types"

type CustomerContactSummary = {
  name: string
  email: string | null
  phone: string | null
}

function formatProfileDisplayName(input: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) {
  const name = [input.firstName, input.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")

  if (name) {
    return name
  }

  const email = input.email?.trim()
  if (email) {
    return email.split("@")[0] || "Customer"
  }

  return "Customer"
}

function formatContactDisplayName(contact: {
  full_name: string | null
  contact_type?: string | null
  primary_contact_name?: string | null
}) {
  const baseName = (contact.full_name || "").trim()
  if (baseName) {
    return baseName
  }

  const primaryName = contact.primary_contact_name?.trim()
  if (primaryName) {
    return primaryName
  }

  return "Contact"
}

function resolveCustomerSummary(input: {
  billingContact: CustomerContactSummary | null
  linkedContact: CustomerContactSummary | null
  profile: CustomerContactSummary | null
}): CustomerContactSummary {
  const source = input.billingContact || input.linkedContact || input.profile

  return {
    name: source?.name || "Customer",
    email: source?.email ?? null,
    phone: source?.phone ?? null,
  }
}

export async function getBlockingReservationsForVenue(
  organizationId: string,
  venueId: string,
  rangeStart: string,
  rangeEnd: string,
  excludeSourceId?: string
): Promise<ConflictCheckReservation[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("resource_reservations")
    .select("id, venue_id, start_at, end_at, status, source_id")
    .eq("organization_id", organizationId)
    .eq("venue_id", venueId)
    .lt("start_at", rangeEnd)
    .gt("end_at", rangeStart)

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load reservations for conflict check")
  }

  return (data || [])
    .filter((row) => {
      if (excludeSourceId && row.source_id === excludeSourceId) {
        return false
      }

      return reservationStatusBlocksBooking(row.status)
    })
    .map((row) => ({
      id: row.id as string,
      venueId: row.venue_id as string | null,
      startAt: row.start_at as string,
      endAt: row.end_at as string,
      status: row.status as string,
    }))
}

export async function getVenueRentalById(id: string): Promise<VenueRentalRecord | null> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from("venue_rentals")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01") {
      return null
    }
    console.error(error)
    return null
  }

  return data as VenueRentalRecord | null
}

export async function getRentalReservationsForRental(
  venueRentalId: string
): Promise<RentalReservationRecord[]> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("rental_reservations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("venue_rental_id", venueRentalId)
    .order("start_at", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load rental reservations")
  }

  return (data || []) as RentalReservationRecord[]
}

export async function getRentalPaymentsForRental(
  venueRentalId: string
): Promise<RentalPaymentRecord[]> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("rental_payments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("venue_rental_id", venueRentalId)
    .order("created_at", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load rental payments")
  }

  return (data || []) as RentalPaymentRecord[]
}

export type { PublicAvailabilityBlock } from "./venue-rental-types"

/** Availability blocks for public calendar — no titles, customer names, or notes. */
export async function getPublicAvailabilityBlocks(
  organizationId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<PublicAvailabilityBlock[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("resource_reservations")
    .select("venue_id, start_at, end_at, status")
    .eq("organization_id", organizationId)
    .not("venue_id", "is", null)
    .lt("start_at", rangeEnd)
    .gt("end_at", rangeStart)

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load public availability")
  }

  return (data || [])
    .filter((row) => reservationStatusBlocksBooking(row.status as string))
    .map((row) => ({
      venueId: row.venue_id as string,
      startAt: row.start_at as string,
      endAt: row.end_at as string,
    }))
}

export async function getActiveRentalAddons(
  organizationId: string
): Promise<RentalAddonCatalogItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rental_addons")
    .select("id, name, description, default_price")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load rental add-ons")
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    defaultPrice: Number(row.default_price || 0),
  }))
}

/**
 * One range query for the whole queue instead of N+1 per reservation.
 * (Sequential checks were taking minutes after bulk Google Form import.)
 */
async function loadRentalConflictFlags(
  organizationId: string,
  reservationsByRental: Map<string, RentalReservationRecord[]>
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>()
  for (const rentalId of reservationsByRental.keys()) {
    flags.set(rentalId, false)
  }

  const allReservations: RentalReservationRecord[] = []
  for (const reservations of reservationsByRental.values()) {
    allReservations.push(...reservations)
  }

  if (allReservations.length === 0) {
    return flags
  }

  let rangeStart = allReservations[0].start_at
  let rangeEnd = allReservations[0].end_at
  const venueIds = new Set<string>()

  for (const reservation of allReservations) {
    if (reservation.start_at < rangeStart) rangeStart = reservation.start_at
    if (reservation.end_at > rangeEnd) rangeEnd = reservation.end_at
    if (reservation.venue_id) venueIds.add(reservation.venue_id)
  }

  if (venueIds.size === 0) {
    return flags
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("resource_reservations")
    .select("id, venue_id, start_at, end_at, status, source_id")
    .eq("organization_id", organizationId)
    .in("venue_id", Array.from(venueIds))
    .lt("start_at", rangeEnd)
    .gt("end_at", rangeStart)

  if (error) {
    if (error.code === "42P01") {
      return flags
    }
    console.error(error)
    throw new Error("Failed to load reservations for conflict check")
  }

  const blockingRows = (data || []).filter((row) =>
    reservationStatusBlocksBooking(row.status as string | null)
  )

  for (const [rentalId, reservations] of reservationsByRental) {
    let hasConflict = false

    for (const reservation of reservations) {
      const overlaps = blockingRows.some((row) => {
        if (row.source_id === reservation.id) return false
        if (row.venue_id !== reservation.venue_id) return false
        return rangesOverlap(
          new Date(reservation.start_at),
          new Date(reservation.end_at),
          new Date(row.start_at as string),
          new Date(row.end_at as string)
        )
      })

      if (overlaps) {
        hasConflict = true
        break
      }
    }

    flags.set(rentalId, hasConflict)
  }

  return flags
}

type VenueRentalListRow = {
  id: string
  status: string
  notes: string | null
  expected_attendance: number | null
  customer_user_id: string | null
  billing_contact_id: string | null
  hold_expires_at: string | null
  created_at: string
  approved_at: string | null
  venue_rental_event_type_id: string | null
}

const VENUE_RENTAL_LIST_BASE_SELECT =
  "id, status, notes, expected_attendance, customer_user_id, hold_expires_at, created_at, approved_at, venue_rental_event_type_id"

function isMissingDbColumnError(
  error: { code?: string; message?: string } | null,
  column?: string
) {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  const message = error.message?.toLowerCase() || ""
  if (message.includes("does not exist")) return true
  if (column && message.includes(column.toLowerCase())) return true
  return false
}

async function loadVenueRentalListRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  options?: {
    statuses?: VenueRentalStatus[]
    customerUserId?: string
  }
): Promise<VenueRentalListRow[]> {
  const runQuery = (select: string) => {
    let query = supabase
      .from("venue_rentals")
      .select(select)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (options?.customerUserId) {
      query = query.eq("customer_user_id", options.customerUserId)
    }

    if (options?.statuses?.length) {
      query = query.in("status", options.statuses)
    }

    return query
  }

  const withBillingSelect = `${VENUE_RENTAL_LIST_BASE_SELECT}, billing_contact_id`
  const { data: withBillingData, error: withBillingError } = await runQuery(withBillingSelect)

  if (!withBillingError) {
    return (withBillingData || []) as VenueRentalListRow[]
  }

  if (withBillingError.code === "42P01") {
    return []
  }

  if (isMissingDbColumnError(withBillingError, "billing_contact_id")) {
    const { data: fallbackData, error: fallbackError } = await runQuery(
      VENUE_RENTAL_LIST_BASE_SELECT
    )

    if (fallbackError) {
      if (fallbackError.code === "42P01") {
        return []
      }
      console.error(fallbackError)
      throw new Error("Failed to load venue rentals")
    }

    return ((fallbackData || []) as Omit<VenueRentalListRow, "billing_contact_id">[]).map(
      (row) => ({
        ...row,
        billing_contact_id: null,
      })
    )
  }

  console.error(withBillingError)
  throw new Error("Failed to load venue rentals")
}

async function loadBillingContactsById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  billingContactIds: string[]
) {
  if (!billingContactIds.length) {
    return new Map<
      string,
      CustomerContactSummary & {
        contactType: "individual" | "organization" | null
        primaryContactName: string | null
      }
    >()
  }

  const withPrimarySelect =
    "id, full_name, email, phone, contact_type, primary_contact_name"
  const baseSelect = "id, full_name, email, phone, contact_type"

  let { data, error } = await supabase
    .from("contacts")
    .select(withPrimarySelect)
    .eq("organization_id", organizationId)
    .in("id", billingContactIds)

  if (error && isMissingDbColumnError(error, "primary_contact_name")) {
    const fallback = await supabase
      .from("contacts")
      .select(baseSelect)
      .eq("organization_id", organizationId)
      .in("id", billingContactIds)
    data = fallback.data
    error = fallback.error
  }

  if (error && isMissingDbColumnError(error, "phone")) {
    const fallback = await supabase
      .from("contacts")
      .select("id, full_name, email, contact_type, primary_contact_name")
      .eq("organization_id", organizationId)
      .in("id", billingContactIds)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    console.error(error)
    return new Map()
  }

  return new Map(
    (data || []).map((contact) => [
      contact.id as string,
      {
        name: formatContactDisplayName({
          full_name: contact.full_name as string | null,
          contact_type: contact.contact_type as string | null,
          primary_contact_name:
            "primary_contact_name" in contact
              ? ((contact.primary_contact_name as string | null) ?? null)
              : null,
        }),
        email: (contact.email as string | null) ?? null,
        phone: (contact.phone as string | null) ?? null,
        contactType: contact.contact_type as "individual" | "organization" | null,
        primaryContactName:
          "primary_contact_name" in contact
            ? ((contact.primary_contact_name as string | null) ?? null)
            : null,
      },
    ])
  )
}

async function loadLinkedCustomerContactsByAuthUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  customerUserIds: string[]
) {
  if (!customerUserIds.length) {
    return new Map<string, CustomerContactSummary>()
  }

  const withPrimarySelect =
    "auth_user_id, full_name, email, phone, contact_type, primary_contact_name"
  const baseSelect = "auth_user_id, full_name, email, phone, contact_type"

  let { data, error } = await supabase
    .from("contacts")
    .select(withPrimarySelect)
    .eq("organization_id", organizationId)
    .in("auth_user_id", customerUserIds)

  if (error && isMissingDbColumnError(error, "primary_contact_name")) {
    const fallback = await supabase
      .from("contacts")
      .select(baseSelect)
      .eq("organization_id", organizationId)
      .in("auth_user_id", customerUserIds)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    if (isMissingDbColumnError(error, "phone")) {
      const fallback = await supabase
        .from("contacts")
        .select("auth_user_id, full_name, email, contact_type, primary_contact_name")
        .eq("organization_id", organizationId)
        .in("auth_user_id", customerUserIds)
      data = fallback.data
      error = fallback.error
    }
  }

  if (error) {
    console.error(error)
    return new Map<string, CustomerContactSummary>()
  }

  return new Map(
    (data || []).map((contact) => [
      contact.auth_user_id as string,
      {
        name: formatContactDisplayName({
          full_name: contact.full_name as string | null,
          contact_type: contact.contact_type as string | null,
          primary_contact_name:
            "primary_contact_name" in contact
              ? ((contact.primary_contact_name as string | null) ?? null)
              : null,
        }),
        email: (contact.email as string | null) ?? null,
        phone: (contact.phone as string | null) ?? null,
      },
    ])
  )
}

export async function getVenueRentalQueueRows(options?: {
  statuses?: VenueRentalStatus[]
  customerUserId?: string
  organizationId?: string
  /** Skip per-row conflict checks (use for payment reports / bulk lists). */
  skipConflictCheck?: boolean
}): Promise<VenueRentalQueueRow[]> {
  const supabase = await createClient()
  const organizationId = options?.organizationId ?? (await resolveOrganizationId())

  if (!organizationId) {
    return []
  }

  const rentalRows = await loadVenueRentalListRows(supabase, organizationId, {
    customerUserId: options?.customerUserId,
    statuses: options?.statuses,
  })

  if (!rentalRows.length) {
    return []
  }

  const rentalIds = rentalRows.map((row) => row.id)
  const customerIds = Array.from(
    new Set(rentalRows.map((row) => row.customer_user_id).filter(Boolean))
  ) as string[]
  const eventTypeIds = Array.from(
    new Set(rentalRows.map((row) => row.venue_rental_event_type_id).filter(Boolean))
  ) as string[]
  const billingContactIds = Array.from(
    new Set(rentalRows.map((row) => row.billing_contact_id).filter(Boolean))
  ) as string[]

  const [reservationsResult, addonsResult, profilesResult, eventTypesResult, billingContactMap, linkedContactMap] =
    await Promise.all([
      supabase
        .from("rental_reservations")
        .select("id, venue_rental_id, venue_id, start_at, end_at, status")
        .eq("organization_id", organizationId)
        .in("venue_rental_id", rentalIds)
        .order("start_at", { ascending: true }),
      supabase
        .from("rental_selected_addons")
        .select(
          "venue_rental_id, quantity, unit_price, rental_addons:rental_addon_id ( id, name )"
        )
        .eq("organization_id", organizationId)
        .in("venue_rental_id", rentalIds),
      customerIds.length
        ? supabase
            .from("profiles")
            .select("id, first_name, last_name, email")
            .in("id", customerIds)
        : Promise.resolve({ data: [] }),
      eventTypeIds.length
        ? supabase
            .from("venue_rental_event_types")
            .select("id, name")
            .in("id", eventTypeIds)
        : Promise.resolve({ data: [] }),
      loadBillingContactsById(supabase, organizationId, billingContactIds),
      loadLinkedCustomerContactsByAuthUserId(supabase, organizationId, customerIds),
    ])

  const venueIds = Array.from(
    new Set((reservationsResult.data || []).map((row) => row.venue_id).filter(Boolean))
  ) as string[]

  const { data: venues } = venueIds.length
    ? await supabase.from("venues").select("id, name").in("id", venueIds)
    : { data: [] }

  const venueMap = new Map((venues || []).map((venue) => [venue.id as string, venue.name as string]))
  const profileMap = new Map(
    (profilesResult.data || []).map((profile) => [
      profile.id as string,
      {
        name: formatProfileDisplayName({
          firstName: profile.first_name as string | null,
          lastName: profile.last_name as string | null,
          email: profile.email as string | null,
        }),
        email: (profile.email as string | null) ?? null,
        phone: null,
      },
    ])
  )
  const eventTypeMap = new Map(
    (eventTypesResult.data || []).map((eventType) => [
      eventType.id as string,
      eventType.name as string,
    ])
  )

  const reservationsByRental = new Map<string, RentalReservationRecord[]>()
  for (const row of reservationsResult.data || []) {
    const rentalId = row.venue_rental_id as string
    const list = reservationsByRental.get(rentalId) || []
    list.push(row as RentalReservationRecord)
    reservationsByRental.set(rentalId, list)
  }

  const addonsByRental = new Map<string, VenueRentalQueueRow["addons"]>()
  for (const row of addonsResult.data || []) {
    const rentalId = row.venue_rental_id as string
    const list = addonsByRental.get(rentalId) || []
    const addonRelation = row.rental_addons as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
    const addon = Array.isArray(addonRelation) ? addonRelation[0] : addonRelation
    list.push({
      id: addon?.id || "",
      name: addon?.name || "Add-on",
      quantity: Number(row.quantity || 1),
      unitPrice: Number(row.unit_price || 0),
    })
    addonsByRental.set(rentalId, list)
  }

  const conflictFlags = options?.skipConflictCheck
    ? new Map<string, boolean>()
    : await loadRentalConflictFlags(organizationId, reservationsByRental)

  const rows: VenueRentalQueueRow[] = []

  for (const rental of rentalRows) {
    const status = rental.status as VenueRentalStatus
    const reservations = reservationsByRental.get(rental.id) || []
    const customer = rental.customer_user_id
      ? profileMap.get(rental.customer_user_id)
      : null
    const linkedContact = rental.customer_user_id
      ? linkedContactMap.get(rental.customer_user_id) ?? null
      : null
    const billingContact = rental.billing_contact_id
      ? billingContactMap.get(rental.billing_contact_id)
      : null
    const customerSummary = resolveCustomerSummary({
      billingContact: billingContact
        ? {
            name: billingContact.name,
            email: billingContact.email,
            phone: billingContact.phone,
          }
        : null,
      linkedContact,
      profile: customer,
    })

    const submittedAt = resolveVenueRentalSubmittedAt(
      rental.notes,
      rental.created_at
    )

    rows.push({
      id: rental.id,
      shortId: shortVenueRentalId(rental.id),
      status,
      statusLabel: getVenueRentalStatusLabel(status),
      calendarColor: getVenueRentalCalendarColor(status),
      customerName: customerSummary.name,
      customerEmail: customerSummary.email,
      customerPhone: customerSummary.phone,
      billingContactId: rental.billing_contact_id,
      billingContactName: billingContact?.name ?? null,
      billingContactType: billingContact?.contactType ?? null,
      eventTypeName: resolveVenueRentalEventTypeName(
        rental.notes,
        rental.venue_rental_event_type_id
          ? eventTypeMap.get(rental.venue_rental_event_type_id) || null
          : null
      ),
      spaces: reservations.map((reservation) => ({
        venueId: reservation.venue_id,
        venueName: venueMap.get(reservation.venue_id) || "Space",
        startAt: reservation.start_at,
        endAt: reservation.end_at,
      })),
      addons: addonsByRental.get(rental.id) || [],
      notes: rental.notes,
      guestCount: rental.expected_attendance,
      submittedAt,
      submittedAtLabel: formatVenueRentalDateTime(submittedAt),
      holdExpiresAt: rental.hold_expires_at,
      hasConflict: conflictFlags.get(rental.id) === true,
    })
  }

  rows.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )

  return rows
}

export async function getVenueRentalDetailRow(
  venueRentalId: string
): Promise<VenueRentalQueueRow | null> {
  const rows = await getVenueRentalQueueRows()
  return rows.find((row) => row.id === venueRentalId) ?? null
}

export function getVenueRentalDashboardStats(
  rows: VenueRentalQueueRow[]
): VenueRentalDashboardStats {
  return {
    awaitingApprovalCount: rows.filter(
      (row) =>
        row.status === VENUE_RENTAL_STATUSES.submitted ||
        row.status === VENUE_RENTAL_STATUSES.pending ||
        row.status === VENUE_RENTAL_STATUSES.awaitingSupervisorApproval
    ).length,
    awaitingPaymentCount: rows.filter(
      (row) => row.status === VENUE_RENTAL_STATUSES.approvedPendingPayment
    ).length,
    confirmedCount: rows.filter(
      (row) =>
        row.status === VENUE_RENTAL_STATUSES.confirmed ||
        row.status === VENUE_RENTAL_STATUSES.depositPaid ||
        row.status === VENUE_RENTAL_STATUSES.securityDepositPaid
    ).length,
    conflictCount: rows.filter((row) => row.hasConflict).length,
  }
}

function isPaidPaymentStatus(status: string) {
  return (
    status === RENTAL_PAYMENT_STATUSES.paidManually ||
    status === RENTAL_PAYMENT_STATUSES.paidStripeLater
  )
}

function summarizePaymentsForRental(payments: RentalPaymentRecord[]) {
  let depositAmount = 0
  let depositReceived = 0
  let securityAmount = 0
  let securityReceived = 0
  let remainingAmount = 0
  let remainingReceived = 0
  let unpaidDepositId: string | null = null
  let unpaidSecurityId: string | null = null
  let unpaidRemainingId: string | null = null

  for (const payment of payments) {
    if (payment.payment_type === RENTAL_PAYMENT_TYPES.refund) continue
    const amount = Number(payment.amount) || 0
    const paid = isPaidPaymentStatus(payment.status)

    if (payment.payment_type === RENTAL_PAYMENT_TYPES.deposit) {
      depositAmount += amount
      if (paid) depositReceived += amount
      else if (!unpaidDepositId) unpaidDepositId = payment.id
    } else if (payment.payment_type === RENTAL_PAYMENT_TYPES.securityDeposit) {
      securityAmount += amount
      if (paid) securityReceived += amount
      else if (!unpaidSecurityId) unpaidSecurityId = payment.id
    } else if (
      payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance ||
      payment.payment_type === RENTAL_PAYMENT_TYPES.addonFee
    ) {
      remainingAmount += amount
      if (paid) remainingReceived += amount
      else if (
        payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance &&
        !unpaidRemainingId
      ) {
        unpaidRemainingId = payment.id
      }
    }
  }

  const totalFee = depositAmount + securityAmount + remainingAmount
  const amountReceived = depositReceived + securityReceived + remainingReceived
  const remainingDue = Math.max(0, remainingAmount - remainingReceived)
  const balanceDue = Math.max(0, totalFee - amountReceived)

  let paymentBalance: VenueRentalPaymentReportRow["paymentBalance"] = "no_payments"
  if (payments.some((p) => p.payment_type !== RENTAL_PAYMENT_TYPES.refund)) {
    if (balanceDue <= 0 && amountReceived > 0) paymentBalance = "paid"
    else if (amountReceived > 0 && balanceDue > 0) paymentBalance = "partial"
    else paymentBalance = "unpaid"
  }

  return {
    totalFee,
    depositAmount,
    depositReceived,
    securityAmount,
    securityReceived,
    remainingAmount,
    remainingReceived,
    remainingDue,
    amountReceived,
    balanceDue,
    paymentBalance,
    unpaidPaymentIds: {
      depositId: unpaidDepositId,
      securityId: unpaidSecurityId,
      remainingId: unpaidRemainingId,
    },
  }
}

/** Staff payment report rows for Venue Rentals → Payments. */
export async function getVenueRentalPaymentReportRows(): Promise<
  VenueRentalPaymentReportRow[]
> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  const queueRows = await getVenueRentalQueueRows({ skipConflictCheck: true })
  if (!queueRows.length) {
    return []
  }

  const rentalIds = queueRows.map((row) => row.id)
  const { data: paymentRows, error } = await supabase
    .from("rental_payments")
    .select("*")
    .eq("organization_id", organizationId)
    .in("venue_rental_id", rentalIds)

  if (error && error.code !== "42P01") {
    console.error(error)
    throw new Error("Failed to load rental payments")
  }

  const paymentsByRental = new Map<string, RentalPaymentRecord[]>()
  for (const payment of (paymentRows || []) as RentalPaymentRecord[]) {
    const list = paymentsByRental.get(payment.venue_rental_id) || []
    list.push(payment)
    paymentsByRental.set(payment.venue_rental_id, list)
  }

  return queueRows.map((row) => {
    const payments = paymentsByRental.get(row.id) || []
    const summary = summarizePaymentsForRental(payments)
    const primary = row.spaces[0]
    const spaceLabel = primary
      ? formatVenueRentalSpaceLine(primary.venueName, primary.startAt, primary.endAt)
      : "—"

    return {
      id: row.id,
      shortId: row.shortId,
      status: row.status,
      statusLabel: row.statusLabel,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      eventTypeName: row.eventTypeName,
      spaceLabel,
      eventStartAt: primary?.startAt ?? null,
      ...summary,
      payments: payments
        .filter((payment) => payment.payment_type !== RENTAL_PAYMENT_TYPES.refund)
        .map((payment) => ({
          id: payment.id,
          paymentType: payment.payment_type,
          status: payment.status,
          amount: Number(payment.amount) || 0,
          notes: payment.notes,
          paidAt: payment.paid_at,
        })),
    }
  })
}

export async function getCustomerVenueRentals(
  customerUserId: string,
  organizationId: string
): Promise<VenueRentalQueueRow[]> {
  return getVenueRentalQueueRows({ customerUserId, organizationId })
}
