"use server"

/**
 * Venue Rentals workflow actions (new path).
 *
 * Customer and staff rental operations here write ONLY:
 *   venue_rentals → rental_reservations → resource_reservations (DB sync)
 *
 * Do NOT insert into legacy `venue_bookings` from this module.
 * Legacy pages continue using lib/bookings/venue-booking-* until Phase B cutover.
 * See lib/bookings/venue-rental-transition.ts for migration rules.
 */

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { resolveCustomerPortalSession } from "@/lib/auth/customer-portal-session"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { assertNoReservationConflicts } from "@/lib/reservations/reservation-conflict-rules"

import {
  computeHoldExpiresAt,
  canStaffCancelVenueRental,
  canStaffForceBookVenueRental,
  isVenueRentalReviewable,
  shouldCancelVenueRentalAfterPayment,
  summarizeOutstandingRentalPayments,
  VENUE_RENTAL_FORCE_BOOK_STATUSES,
} from "./venue-rental-status"
import { expireVenueRentalHoldsForScope } from "./venue-rental-hold-expiry"
import { getBlockingReservationsForVenue } from "./venue-rental-queries"
import {
  assertLegacyVenueBookingAvailableForMigration,
  legacyVenueBookingToSpaceSlot,
  VenueRentalTransitionError,
} from "./venue-rental-transition"
import { getDuplicateVenueRentalBlockReport } from "./venue-rental-transition-queries"
import { syncOperationalBriefForVenueRental } from "@/lib/operational-briefs/operational-brief-queries"
import { fireModuleNotifications } from "@/lib/notifications/dispatch-module-notification"
import { normalizeVenueUsageTag } from "@/lib/bookings/venue-usage"
import {
  RENTAL_CONTRACT_STATUSES,
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
  RENTAL_RESERVATION_STATUSES,
  VENUE_RENTAL_STATUSES,
  type RentalAddonSelectionInput,
  type RentalSpaceSlotInput,
  type SubmitVenueRentalInput,
  type VenueRentalStatus,
} from "./venue-rental-types"

const CALENDAR_PATHS = [
  "/facilities/availability",
  "/facilities/calendar",
  "/facilities/overview",
  "/facilities/reservation-center",
  "/bookings/calendar",
  "/bookings/overview",
  "/bookings/requests",
  "/bookings/payments",
  "/bookings/rentals",
  "/customer/rentals",
  "/customer/rentals/new",
]

function revalidateVenueRentalPaths() {
  for (const path of CALENDAR_PATHS) {
    revalidatePath(path)
  }
}

async function assertCanManageVenueRentals() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to manage venue rentals.")
  }
}

function validateSpaces(spaces: RentalSpaceSlotInput[]) {
  if (!spaces.length) {
    throw new Error("Select at least one space and time range.")
  }

  for (const space of spaces) {
    if (!space.venueId) {
      throw new Error("Each space selection must include a venue.")
    }

    const start = new Date(space.startAt)
    const end = new Date(space.endAt)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Invalid start or end time.")
    }

    if (end <= start) {
      throw new Error("End time must be after start time.")
    }
  }
}

async function assertVenuesInOrg(
  organizationId: string,
  venueIds: string[]
) {
  const supabase = await createClient()
  const uniqueIds = Array.from(new Set(venueIds))

  const { data, error } = await supabase
    .from("venues")
    .select("id, available_for_bookings, usage_tag")
    .eq("organization_id", organizationId)
    .in("id", uniqueIds)

  if (error) {
    if (error.message?.includes("available_for_bookings")) {
      const fallback = await supabase
        .from("venues")
        .select("id, usage_tag")
        .eq("organization_id", organizationId)
        .in("id", uniqueIds)

      if (fallback.error || (fallback.data || []).length !== uniqueIds.length) {
        throw new Error("One or more selected venues are invalid for this organization.")
      }

      const invalidLegacy = (fallback.data || []).find(
        (row) => normalizeVenueUsageTag(row.usage_tag as string | null) !== "external"
      )

      if (invalidLegacy) {
        throw new Error(
          "This space is not enabled for venue rentals. Turn on “Available for bookings” in Facilities settings."
        )
      }

      return
    }

    throw new Error("Failed to validate venues.")
  }

  if ((data || []).length !== uniqueIds.length) {
    throw new Error("One or more selected venues are invalid for this organization.")
  }

  const unavailable = (data || []).find((row) => {
    if (typeof row.available_for_bookings === "boolean") {
      return !row.available_for_bookings
    }

    return normalizeVenueUsageTag(row.usage_tag as string | null) !== "external"
  })

  if (unavailable) {
    throw new Error(
      "This space is not enabled for venue rentals. Turn on “Available for bookings” in Facilities settings."
    )
  }
}

async function checkSpaceConflicts(
  organizationId: string,
  spaces: RentalSpaceSlotInput[]
) {
  const existingByVenue = new Map<string, Awaited<ReturnType<typeof getBlockingReservationsForVenue>>>()

  for (const space of spaces) {
    if (!existingByVenue.has(space.venueId)) {
      const minStart = spaces
        .filter((item) => item.venueId === space.venueId)
        .reduce((min, item) => Math.min(min, new Date(item.startAt).getTime()), Infinity)
      const maxEnd = spaces
        .filter((item) => item.venueId === space.venueId)
        .reduce((max, item) => Math.max(max, new Date(item.endAt).getTime()), 0)

      existingByVenue.set(
        space.venueId,
        await getBlockingReservationsForVenue(
          organizationId,
          space.venueId,
          new Date(minStart).toISOString(),
          new Date(maxEnd).toISOString()
        )
      )
    }
  }

  const candidates = spaces.map((space, index) => ({
    id: `candidate-${index}`,
    venueId: space.venueId,
    startAt: space.startAt,
    endAt: space.endAt,
    status: RENTAL_RESERVATION_STATUSES.temporaryHold,
  }))

  const existing = Array.from(existingByVenue.values()).flat()
  assertNoReservationConflicts(candidates, existing)
}

async function insertSelectedAddons(
  organizationId: string,
  venueRentalId: string,
  addons: RentalAddonSelectionInput[] | undefined
) {
  if (!addons?.length) {
    return
  }

  const supabase = await createClient()

  for (const addon of addons) {
    const { data: catalogAddon, error: catalogError } = await supabase
      .from("rental_addons")
      .select("id, default_price, is_active")
      .eq("organization_id", organizationId)
      .eq("id", addon.rentalAddonId)
      .maybeSingle()

    if (catalogError || !catalogAddon || !catalogAddon.is_active) {
      throw new Error("One or more selected add-ons are invalid.")
    }

    const { error } = await supabase.from("rental_selected_addons").insert({
      organization_id: organizationId,
      venue_rental_id: venueRentalId,
      rental_addon_id: addon.rentalAddonId,
      quantity: Math.max(1, addon.quantity || 1),
      unit_price: addon.unitPrice ?? Number(catalogAddon.default_price || 0),
    })

    if (error) {
      throw new Error(error.message || "Failed to save selected add-ons.")
    }
  }
}

async function logOverride(input: {
  organizationId: string
  venueRentalId?: string
  rentalReservationId?: string
  resourceReservationId?: string
  action: string
  reason: string
  staffUserId: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await createClient()

  const { error } = await supabase.from("reservation_override_logs").insert({
    organization_id: input.organizationId,
    venue_rental_id: input.venueRentalId ?? null,
    rental_reservation_id: input.rentalReservationId ?? null,
    resource_reservation_id: input.resourceReservationId ?? null,
    action: input.action,
    reason: input.reason.trim(),
    staff_user_id: input.staffUserId,
    metadata: input.metadata ?? {},
  })

  if (error) {
    console.error(error)
    throw new Error(error.message || "Failed to write reservation override audit log.")
  }
}

async function resolveBillingContactId(
  organizationId: string,
  userId: string,
  explicitContactId?: string | null
) {
  const supabase = await createClient()

  if (explicitContactId) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", explicitContactId)
      .maybeSingle()

    if (error || !data) {
      throw new Error("The selected billing contact could not be found.")
    }

    return explicitContactId
  }

  const { data: linkedContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  return (linkedContact?.id as string | undefined) ?? null
}

export async function updateVenueRentalBillingContact(input: {
  venueRentalId: string
  billingContactId: string | null
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (input.billingContactId) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.billingContactId)
      .maybeSingle()

    if (contactError || !contact) {
      throw new Error("The selected billing contact could not be found.")
    }
  }

  const { error } = await supabase
    .from("venue_rentals")
    .update({ billing_contact_id: input.billingContactId })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to update billing contact.")
  }

  if (input.billingContactId) {
    await syncContactAffiliations(input.billingContactId, organizationId, supabase)
  }

  await syncOperationalBriefForVenueRental(input.venueRentalId, organizationId, user?.id ?? null)
  revalidateVenueRentalPaths()
  revalidatePath(`/bookings/rentals/${input.venueRentalId}`)
}

export async function submitVenueRentalRequest(input: SubmitVenueRentalInput) {
  // New customer flow writes venue_rentals + rental_reservations only — never legacy venue_bookings.
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in to submit a rental request.")
  }

  const portalSession = await resolveCustomerPortalSession()
  const customerUserId = portalSession?.effectiveUserId ?? user.id

  validateSpaces(input.spaces)
  await assertVenuesInOrg(
    organizationId,
    input.spaces.map((space) => space.venueId)
  )
  await checkSpaceConflicts(organizationId, input.spaces)

  const billingContactId = await resolveBillingContactId(
    organizationId,
    customerUserId,
    input.billingContactId
  )

  const rentalInsertBase = {
    organization_id: organizationId,
    customer_user_id: customerUserId,
    venue_rental_event_type_id: input.venueRentalEventTypeId || null,
    status: VENUE_RENTAL_STATUSES.submitted,
    notes: input.notes?.trim() || null,
    expected_attendance: input.operationalSetup?.expectedAttendance ?? null,
    created_by: customerUserId,
  }

  let rentalResult = await supabase
    .from("venue_rentals")
    .insert({
      ...rentalInsertBase,
      billing_contact_id: billingContactId,
    })
    .select("id")
    .single()

  if (
    rentalResult.error?.message?.includes("billing_contact_id") &&
    billingContactId
  ) {
    rentalResult = await supabase
      .from("venue_rentals")
      .insert(rentalInsertBase)
      .select("id")
      .single()
  }

  const { data: rental, error: rentalError } = rentalResult

  if (rentalError || !rental) {
    console.error(rentalError)
    throw new Error(rentalError?.message || "Failed to create rental request")
  }

  const reservationRows = input.spaces.map((space) => ({
    organization_id: organizationId,
    venue_rental_id: rental.id,
    venue_id: space.venueId,
    start_at: space.startAt,
    end_at: space.endAt,
    status: RENTAL_RESERVATION_STATUSES.temporaryHold,
    created_by: customerUserId,
  }))

  const { error: reservationError } = await supabase
    .from("rental_reservations")
    .insert(reservationRows)

  if (reservationError) {
    await supabase.from("venue_rentals").delete().eq("id", rental.id)
    throw new Error(reservationError.message || "Failed to create temporary hold")
  }

  await insertSelectedAddons(organizationId, rental.id as string, input.addons)

  await syncOperationalBriefForVenueRental(rental.id as string, organizationId, customerUserId, {
    operationalSetup: input.operationalSetup,
  })

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "request_submitted",
      subject: "New venue rental request",
      summary: "A customer submitted a new venue rental request.",
      metadata: { venueRentalId: rental.id, customerUserId },
    },
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "request_received",
      subject: "Venue rental request received",
      summary: "Your venue rental request was received and is awaiting review.",
      metadata: { venueRentalId: rental.id, customerUserId },
    },
  ])

  if (billingContactId) {
    await syncContactAffiliations(billingContactId, organizationId, supabase)
  }

  revalidateVenueRentalPaths()
  return rental.id as string
}

export async function approveVenueRentalRequest(input: {
  venueRentalId: string
  depositAmount: number
  /** @deprecated Optional; security deposit is not required for confirmation. */
  securityDepositAmount?: number
  remainingBalanceAmount?: number
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rental = await supabase
    .from("venue_rentals")
    .select("id, status")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rental.error || !rental.data) {
    throw new Error("Rental request not found.")
  }

  if (!isVenueRentalReviewable(rental.data.status as typeof VENUE_RENTAL_STATUSES.submitted)) {
    throw new Error("Only submitted or pending requests can be approved.")
  }

  const nowIso = new Date().toISOString()
  const holdExpiresAt = computeHoldExpiresAt(new Date(nowIso))

  const { error: updateError } = await supabase
    .from("venue_rentals")
    .update({
      status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      supervisor_user_id: user?.id ?? null,
      approved_at: nowIso,
      payment_notice_sent_at: nowIso,
      hold_expires_at: holdExpiresAt.toISOString(),
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (updateError) {
    throw new Error(updateError.message || "Failed to approve rental request")
  }

  await supabase
    .from("rental_reservations")
    .update({ hold_expires_at: holdExpiresAt.toISOString() })
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  type PaymentInsertRow = {
    organization_id: string
    venue_rental_id: string
    payment_type: string
    status: string
    amount: number
    due_at: string | null
  }

  const paymentRows: PaymentInsertRow[] = [
    {
      organization_id: organizationId,
      venue_rental_id: input.venueRentalId,
      payment_type: RENTAL_PAYMENT_TYPES.deposit,
      status: RENTAL_PAYMENT_STATUSES.paymentRequested,
      amount: Math.max(0, input.depositAmount),
      due_at: holdExpiresAt.toISOString(),
    },
  ]

  const securityAmount = Math.max(0, Number(input.securityDepositAmount) || 0)
  if (securityAmount > 0) {
    paymentRows.push({
      organization_id: organizationId,
      venue_rental_id: input.venueRentalId,
      payment_type: RENTAL_PAYMENT_TYPES.securityDeposit,
      status: RENTAL_PAYMENT_STATUSES.paymentRequested,
      amount: securityAmount,
      due_at: holdExpiresAt.toISOString(),
    })
  }

  if (input.remainingBalanceAmount && input.remainingBalanceAmount > 0) {
    paymentRows.push({
      organization_id: organizationId,
      venue_rental_id: input.venueRentalId,
      payment_type: RENTAL_PAYMENT_TYPES.remainingBalance,
      status: RENTAL_PAYMENT_STATUSES.unpaid,
      amount: input.remainingBalanceAmount,
      due_at: null,
    })
  }

  await supabase.from("rental_payments").insert(paymentRows)

  await supabase.from("rental_contracts").insert({
    organization_id: organizationId,
    venue_rental_id: input.venueRentalId,
    status: RENTAL_CONTRACT_STATUSES.generated,
  })

  await syncOperationalBriefForVenueRental(input.venueRentalId, organizationId, user?.id)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "request_approved",
      subject: "Venue rental approved",
      summary: "A venue rental was approved and deposit payment was requested.",
      metadata: { venueRentalId: input.venueRentalId },
    },
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "request_approved",
      subject: "Venue rental approved — pay deposit to confirm",
      summary:
        "Your venue rental was approved. Pay the deposit before the hold expires to confirm your booking.",
      metadata: {
        venueRentalId: input.venueRentalId,
        holdExpiresAt: holdExpiresAt.toISOString(),
      },
    },
  ])

  revalidateVenueRentalPaths()
}

export async function markVenueRentalPending(input: {
  venueRentalId: string
  note?: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const rental = await supabase
    .from("venue_rentals")
    .select("id, status, notes")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rental.error || !rental.data) {
    throw new Error("Rental request not found.")
  }

  if (!isVenueRentalReviewable(rental.data.status as typeof VENUE_RENTAL_STATUSES.submitted)) {
    throw new Error("Only submitted or pending requests can be marked pending.")
  }

  const note = input.note?.trim()
  const nextNotes =
    note && note.length > 0
      ? [rental.data.notes?.trim(), `Pending: ${note}`].filter(Boolean).join("\n\n")
      : rental.data.notes

  const { error } = await supabase
    .from("venue_rentals")
    .update({
      status: VENUE_RENTAL_STATUSES.pending,
      notes: nextNotes,
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to mark rental as pending")
  }

  revalidateVenueRentalPaths()
}

export async function declineVenueRentalRequest(input: {
  venueRentalId: string
  reason: string
}) {
  await assertCanManageVenueRentals()

  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("A decline reason is required.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const existing = await supabase
    .from("venue_rentals")
    .select("id, status")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existing.error || !existing.data) {
    throw new Error("Rental request not found.")
  }

  if (!isVenueRentalReviewable(existing.data.status as typeof VENUE_RENTAL_STATUSES.submitted)) {
    throw new Error("Only submitted or pending requests can be declined.")
  }

  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from("venue_rentals")
    .update({
      status: VENUE_RENTAL_STATUSES.declined,
      declined_at: nowIso,
      decline_reason: reason,
      hold_expires_at: null,
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to decline rental request")
  }

  await supabase
    .from("rental_reservations")
    .update({ status: RENTAL_RESERVATION_STATUSES.cancelled, hold_expires_at: null })
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "rental_cancelled",
      subject: "Venue rental declined",
      summary: "A venue rental request was declined.",
      metadata: { venueRentalId: input.venueRentalId, reason },
    },
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "request_declined",
      subject: "Venue rental request update",
      summary: "Your venue rental request was declined.",
      metadata: { venueRentalId: input.venueRentalId, reason },
    },
  ])

  revalidateVenueRentalPaths()
}

export async function extendVenueRentalHold(input: {
  venueRentalId: string
  additionalHours?: number
  reason: string
}) {
  await assertCanManageVenueRentals()

  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("A reason is required to extend the hold.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Staff user is required.")
  }

  const hours = input.additionalHours && input.additionalHours > 0 ? input.additionalHours : 72
  const nowIso = new Date().toISOString()
  const holdExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

  const { error } = await supabase
    .from("venue_rentals")
    .update({
      hold_expires_at: holdExpiresAt.toISOString(),
      payment_notice_sent_at: nowIso,
      status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to extend hold")
  }

  await supabase
    .from("rental_reservations")
    .update({
      hold_expires_at: holdExpiresAt.toISOString(),
      status: RENTAL_RESERVATION_STATUSES.temporaryHold,
    })
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  await logOverride({
    organizationId,
    venueRentalId: input.venueRentalId,
    action: "extend_hold",
    reason,
    staffUserId: user.id,
    metadata: { additional_hours: hours },
  })

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "hold_extended",
      subject: "Venue rental hold extended",
      summary: "Your venue rental hold was extended.",
      metadata: { venueRentalId: input.venueRentalId, reason, additionalHours: hours },
    },
  ])

  revalidateVenueRentalPaths()
}

export async function markRentalPaymentPaid(input: {
  paymentId: string
  status?: "paid_manually" | "paid_stripe_later"
  notes?: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: payment, error: paymentError } = await supabase
    .from("rental_payments")
    .select("id, venue_rental_id, payment_type, status")
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (paymentError || !payment) {
    throw new Error("Payment record not found.")
  }

  if (payment.status === RENTAL_PAYMENT_STATUSES.refunded) {
    throw new Error("This payment has already been refunded.")
  }

  const paidStatus =
    input.status === "paid_stripe_later"
      ? RENTAL_PAYMENT_STATUSES.paidStripeLater
      : RENTAL_PAYMENT_STATUSES.paidManually

  const { error } = await supabase
    .from("rental_payments")
    .update({
      status: paidStatus,
      paid_at: new Date().toISOString(),
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to update payment")
  }

  await syncVenueRentalStatusAfterPayment(payment.venue_rental_id as string, organizationId)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "payment_received",
      subject: "Venue rental payment received",
      summary: "A venue rental payment was recorded.",
      metadata: {
        venueRentalId: payment.venue_rental_id,
        paymentId: input.paymentId,
        paymentType: payment.payment_type,
      },
    },
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "payment_received",
      subject: "Venue rental payment received",
      summary: "Your venue rental payment was received.",
      metadata: {
        venueRentalId: payment.venue_rental_id,
        paymentId: input.paymentId,
        paymentType: payment.payment_type,
      },
    },
  ])

  revalidateVenueRentalPaths()
}

/** Record a payment received (create ledger row if needed, then mark paid). */
export async function recordVenueRentalPaymentReceived(input: {
  venueRentalId: string
  paymentType:
    | "deposit"
    | "security_deposit"
    | "remaining_balance"
  amount: number
  notes?: string
}) {
  await assertCanManageVenueRentals()

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a payment amount greater than zero.")
  }

  const paymentType =
    input.paymentType === "deposit"
      ? RENTAL_PAYMENT_TYPES.deposit
      : input.paymentType === "security_deposit"
        ? RENTAL_PAYMENT_TYPES.securityDeposit
        : RENTAL_PAYMENT_TYPES.remainingBalance

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("id")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!rental) {
    throw new Error("Venue rental not found.")
  }

  const { data: existingPayments, error: listError } = await supabase
    .from("rental_payments")
    .select("id, status, amount")
    .eq("organization_id", organizationId)
    .eq("venue_rental_id", input.venueRentalId)
    .eq("payment_type", paymentType)
    .order("created_at", { ascending: true })

  if (listError) {
    throw new Error(listError.message || "Failed to load payment records.")
  }

  const unpaid = (existingPayments || []).find(
    (payment) =>
      payment.status !== RENTAL_PAYMENT_STATUSES.paidManually &&
      payment.status !== RENTAL_PAYMENT_STATUSES.paidStripeLater &&
      payment.status !== RENTAL_PAYMENT_STATUSES.refunded
  )

  let paymentId = unpaid?.id as string | undefined
  const noteText = input.notes?.trim() || null

  if (paymentId) {
    const { error } = await supabase
      .from("rental_payments")
      .update({
        amount,
        status: RENTAL_PAYMENT_STATUSES.paidManually,
        paid_at: new Date().toISOString(),
        notes: noteText,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId)

    if (error) {
      throw new Error(error.message || "Failed to update payment.")
    }
  } else {
    const { data: created, error } = await supabase
      .from("rental_payments")
      .insert({
        organization_id: organizationId,
        venue_rental_id: input.venueRentalId,
        payment_type: paymentType,
        status: RENTAL_PAYMENT_STATUSES.paidManually,
        amount,
        paid_at: new Date().toISOString(),
        notes: noteText,
      })
      .select("id")
      .single()

    if (error || !created) {
      throw new Error(error?.message || "Failed to create payment.")
    }
    paymentId = created.id
  }

  await syncVenueRentalStatusAfterPayment(input.venueRentalId, organizationId)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "payment_received",
      subject: "Venue rental payment received",
      summary: "A venue rental payment was recorded.",
      metadata: {
        venueRentalId: input.venueRentalId,
        paymentId,
        paymentType,
        amount,
      },
    },
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "payment_received",
      subject: "Venue rental payment received",
      summary: "Your venue rental payment was received.",
      metadata: {
        venueRentalId: input.venueRentalId,
        paymentId,
        paymentType,
        amount,
      },
    },
  ])

  revalidateVenueRentalPaths()
}

export async function updateVenueRentalPaymentRecord(input: {
  paymentId: string
  paymentType:
    | "deposit"
    | "security_deposit"
    | "remaining_balance"
  amount: number
  notes?: string
}) {
  await assertCanManageVenueRentals()

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a payment amount greater than zero.")
  }

  const paymentType =
    input.paymentType === "deposit"
      ? RENTAL_PAYMENT_TYPES.deposit
      : input.paymentType === "security_deposit"
        ? RENTAL_PAYMENT_TYPES.securityDeposit
        : RENTAL_PAYMENT_TYPES.remainingBalance

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: payment, error: paymentError } = await supabase
    .from("rental_payments")
    .select("id, venue_rental_id, payment_type, status")
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (paymentError || !payment) {
    throw new Error("Payment record not found.")
  }

  if (payment.payment_type === RENTAL_PAYMENT_TYPES.refund) {
    throw new Error("Refund rows cannot be edited here.")
  }

  if (payment.status === RENTAL_PAYMENT_STATUSES.refunded) {
    throw new Error("This payment has already been refunded.")
  }

  const { error } = await supabase
    .from("rental_payments")
    .update({
      payment_type: paymentType,
      amount,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to update payment.")
  }

  await syncVenueRentalStatusAfterPayment(
    payment.venue_rental_id as string,
    organizationId
  )
  revalidateVenueRentalPaths()
}

export async function deleteVenueRentalPaymentRecord(input: {
  paymentId: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: payment, error: paymentError } = await supabase
    .from("rental_payments")
    .select("id, venue_rental_id, payment_type")
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (paymentError || !payment) {
    throw new Error("Payment record not found.")
  }

  if (payment.payment_type === RENTAL_PAYMENT_TYPES.refund) {
    throw new Error("Refund rows cannot be deleted here.")
  }

  const { error } = await supabase
    .from("rental_payments")
    .delete()
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to delete payment.")
  }

  await syncVenueRentalStatusAfterPayment(
    payment.venue_rental_id as string,
    organizationId
  )
  revalidateVenueRentalPaths()
}

async function syncVenueRentalStatusAfterPayment(
  venueRentalId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("status")
    .eq("id", venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const previousStatus = rental?.status as VenueRentalStatus | undefined

  const { data: payments } = await supabase
    .from("rental_payments")
    .select("payment_type, status")
    .eq("venue_rental_id", venueRentalId)
    .eq("organization_id", organizationId)

  const paidStatuses = new Set<string>([
    RENTAL_PAYMENT_STATUSES.paidManually,
    RENTAL_PAYMENT_STATUSES.paidStripeLater,
  ])

  const paidTypes = new Set(
    (payments || [])
      .filter((payment) => paidStatuses.has(payment.status as string))
      .map((payment) => payment.payment_type)
  )

  const depositPaid = paidTypes.has(RENTAL_PAYMENT_TYPES.deposit)

  // Intended process: deposit paid confirms the booking (security deposit not required).
  // Do not regress confirmed / completed / cancelled statuses when editing remaining balance.
  const terminalOrConfirmed = new Set<string>([
    VENUE_RENTAL_STATUSES.confirmed,
    VENUE_RENTAL_STATUSES.completed,
    VENUE_RENTAL_STATUSES.closed,
    VENUE_RENTAL_STATUSES.cancelledAfterPayment,
    VENUE_RENTAL_STATUSES.cancelledBeforePayment,
    VENUE_RENTAL_STATUSES.declined,
    VENUE_RENTAL_STATUSES.holdExpired,
    VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval,
    VENUE_RENTAL_STATUSES.securityDepositRefunded,
  ])

  let nextStatus: VenueRentalStatus = VENUE_RENTAL_STATUSES.approvedPendingPayment

  if (previousStatus && terminalOrConfirmed.has(previousStatus)) {
    nextStatus = previousStatus
  } else if (depositPaid) {
    nextStatus = VENUE_RENTAL_STATUSES.confirmed
  }

  const statusUpdate: Record<string, unknown> = { status: nextStatus }
  if (nextStatus === VENUE_RENTAL_STATUSES.confirmed) {
    statusUpdate.hold_expires_at = null
  }

  await supabase
    .from("venue_rentals")
    .update(statusUpdate)
    .eq("id", venueRentalId)
    .eq("organization_id", organizationId)

  if (nextStatus === VENUE_RENTAL_STATUSES.confirmed) {
    await supabase
      .from("rental_reservations")
      .update({
        status: RENTAL_RESERVATION_STATUSES.confirmed,
        hold_expires_at: null,
      })
      .eq("venue_rental_id", venueRentalId)
      .eq("organization_id", organizationId)

    if (previousStatus !== VENUE_RENTAL_STATUSES.confirmed) {
      fireModuleNotifications([
        {
          organizationId,
          moduleKey: "venue_rentals",
          audience: "customer",
          eventKey: "rental_confirmed",
          subject: "Venue rental confirmed",
          summary: "Your venue rental is fully confirmed.",
          metadata: { venueRentalId },
        },
      ])
    }
  }
}

export async function expireVenueRentalHolds(now = new Date()) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const result = await expireVenueRentalHoldsForScope({
    supabase,
    organizationId,
    now,
  })

  if (result.expiredCount > 0) {
    revalidateVenueRentalPaths()
  }

  return result.expiredCount
}

export async function markVenueRentalCompletedAndAwaitingRefund(input: {
  venueRentalId: string
  inspectionNotes?: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .select("id, status")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rentalError || !rental) {
    throw new Error("Rental not found.")
  }

  if (rental.status !== VENUE_RENTAL_STATUSES.confirmed && rental.status !== VENUE_RENTAL_STATUSES.completed) {
    throw new Error("Only confirmed or completed rentals can enter refund review.")
  }

  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from("venue_rentals")
    .update({
      status: VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval,
      inspection_completed_at: nowIso,
      notes: input.inspectionNotes?.trim() || null,
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to mark rental for refund review")
  }

  revalidateVenueRentalPaths()
}

export async function approveSecurityDepositRefund(input: {
  venueRentalId: string
  reason: string
  refundAmount: number
}) {
  await assertCanManageVenueRentals()

  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("Refund approval reason is required.")
  }

  if (input.refundAmount <= 0) {
    throw new Error("Refund amount must be greater than zero.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Staff user is required.")
  }

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .select("id, status, inspection_completed_at")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rentalError || !rental) {
    throw new Error("Rental not found.")
  }

  if (rental.status !== VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval) {
    throw new Error("Security deposit refunds require post-event inspection approval first.")
  }

  if (!rental.inspection_completed_at) {
    throw new Error("Post-event inspection must be completed before refunding the security deposit.")
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("rental_payments")
    .select("payment_type, status, amount")
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (paymentsError) {
    throw new Error("Failed to load rental payments.")
  }

  const paidStatuses = new Set<string>([
    RENTAL_PAYMENT_STATUSES.paidManually,
    RENTAL_PAYMENT_STATUSES.paidStripeLater,
  ])

  const securityDepositPaid = (payments || [])
    .filter(
      (payment) =>
        payment.payment_type === RENTAL_PAYMENT_TYPES.securityDeposit &&
        paidStatuses.has(payment.status as string)
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  if (securityDepositPaid <= 0) {
    throw new Error("No paid security deposit is available to refund.")
  }

  if (input.refundAmount > securityDepositPaid) {
    throw new Error("Refund amount cannot exceed the paid security deposit.")
  }

  await supabase.from("rental_payments").insert({
    organization_id: organizationId,
    venue_rental_id: input.venueRentalId,
    payment_type: RENTAL_PAYMENT_TYPES.refund,
    status: RENTAL_PAYMENT_STATUSES.refunded,
    amount: input.refundAmount,
    paid_at: new Date().toISOString(),
    notes: reason,
  })

  await supabase
    .from("venue_rentals")
    .update({ status: VENUE_RENTAL_STATUSES.securityDepositRefunded })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  await logOverride({
    organizationId,
    venueRentalId: input.venueRentalId,
    action: "approve_security_deposit_refund",
    reason,
    staffUserId: user.id,
    metadata: { refund_amount: input.refundAmount },
  })

  revalidateVenueRentalPaths()
}

export async function forceBookVenueRentalWithOverride(input: {
  venueRentalId: string
  reason: string
  acknowledgeConflict?: boolean
  acknowledgeOutstandingPayments?: boolean
}) {
  await assertCanManageVenueRentals()

  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("Override reason is required.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Staff user is required.")
  }

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .select("id, status")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rentalError || !rental) {
    throw new Error("Rental not found.")
  }

  const previousStatus = rental.status as VenueRentalStatus

  if (!canStaffForceBookVenueRental(previousStatus)) {
    throw new Error("This rental cannot be force-booked in its current status.")
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from("rental_reservations")
    .select("id, venue_id, start_at, end_at")
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (reservationsError) {
    throw new Error("Failed to load rental reservations.")
  }

  let hasConflict = false
  for (const reservation of reservations || []) {
    const blocking = await getBlockingReservationsForVenue(
      organizationId,
      reservation.venue_id as string,
      reservation.start_at as string,
      reservation.end_at as string,
      reservation.id as string
    )

    if (blocking.length > 0) {
      hasConflict = true
      break
    }
  }

  if (hasConflict && !input.acknowledgeConflict) {
    throw new Error(
      "Calendar conflicts exist. Acknowledge the conflict override before force-booking."
    )
  }

  const { data: paymentRows, error: paymentsError } = await supabase
    .from("rental_payments")
    .select("payment_type, status")
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (paymentsError) {
    throw new Error("Failed to load rental payments.")
  }

  const paidStatuses = new Set<string>([
    RENTAL_PAYMENT_STATUSES.paidManually,
    RENTAL_PAYMENT_STATUSES.paidStripeLater,
  ])

  const depositPaid = (paymentRows || []).some(
    (payment) =>
      payment.payment_type === RENTAL_PAYMENT_TYPES.deposit &&
      paidStatuses.has(payment.status as string)
  )
  const securityDepositPaid = (paymentRows || []).some(
    (payment) =>
      payment.payment_type === RENTAL_PAYMENT_TYPES.securityDeposit &&
      paidStatuses.has(payment.status as string)
  )
  const remainingPaid = (paymentRows || []).some(
    (payment) =>
      payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance &&
      paidStatuses.has(payment.status as string)
  )
  const remainingBalanceDue = (paymentRows || []).some(
    (payment) => payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance
  )

  const outstandingPayments = summarizeOutstandingRentalPayments({
    depositPaid,
    securityDepositPaid,
    remainingBalanceDue,
    remainingPaid,
  })

  if (
    outstandingPayments.requiresPaymentAcknowledgement &&
    !input.acknowledgeOutstandingPayments
  ) {
    throw new Error(
      "Outstanding payments remain. Acknowledge the payment bypass before force-booking."
    )
  }

  const { error: rentalUpdateError } = await supabase
    .from("venue_rentals")
    .update({
      status: VENUE_RENTAL_STATUSES.confirmed,
      hold_expires_at: null,
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .in("status", VENUE_RENTAL_FORCE_BOOK_STATUSES)

  if (rentalUpdateError) {
    throw new Error(rentalUpdateError.message || "Failed to force-book rental.")
  }

  const { error: reservationUpdateError } = await supabase
    .from("rental_reservations")
    .update({
      status: RENTAL_RESERVATION_STATUSES.confirmed,
      hold_expires_at: null,
    })
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (reservationUpdateError) {
    throw new Error(
      reservationUpdateError.message || "Failed to confirm rental reservations."
    )
  }

  await logOverride({
    organizationId,
    venueRentalId: input.venueRentalId,
    action: "force_book",
    reason,
    staffUserId: user.id,
    metadata: {
      previous_status: previousStatus,
      next_status: VENUE_RENTAL_STATUSES.confirmed,
      has_conflict: hasConflict,
      acknowledge_conflict: Boolean(input.acknowledgeConflict),
      outstanding_payments: outstandingPayments.outstandingLabels,
      acknowledge_outstanding_payments: Boolean(input.acknowledgeOutstandingPayments),
    },
  })

  revalidateVenueRentalPaths()
}

export async function cancelVenueRental(input: {
  venueRentalId: string
  reason: string
  afterPayment?: boolean
}) {
  await assertCanManageVenueRentals()

  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("Cancellation reason is required.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Staff user is required.")
  }

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .select("id, status, notes")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rentalError || !rental) {
    throw new Error("Rental not found.")
  }

  const currentStatus = rental.status as VenueRentalStatus

  if (!canStaffCancelVenueRental(currentStatus)) {
    throw new Error("This rental cannot be cancelled in its current status.")
  }

  const { data: paymentRows, error: paymentsError } = await supabase
    .from("rental_payments")
    .select("payment_type, status")
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (paymentsError) {
    throw new Error("Failed to load rental payments.")
  }

  const paidStatuses = new Set<string>([
    RENTAL_PAYMENT_STATUSES.paidManually,
    RENTAL_PAYMENT_STATUSES.paidStripeLater,
  ])

  const depositPaid = (paymentRows || []).some(
    (payment) =>
      payment.payment_type === RENTAL_PAYMENT_TYPES.deposit &&
      paidStatuses.has(payment.status as string)
  )
  const securityDepositPaid = (paymentRows || []).some(
    (payment) =>
      payment.payment_type === RENTAL_PAYMENT_TYPES.securityDeposit &&
      paidStatuses.has(payment.status as string)
  )

  const inferredAfterPayment = shouldCancelVenueRentalAfterPayment({
    status: currentStatus,
    depositPaid,
    securityDepositPaid,
  })

  if (
    input.afterPayment !== undefined &&
    input.afterPayment !== inferredAfterPayment
  ) {
    throw new Error("Cancellation type does not match recorded payments.")
  }

  const afterPayment = input.afterPayment ?? inferredAfterPayment
  const nextStatus = afterPayment
    ? VENUE_RENTAL_STATUSES.cancelledAfterPayment
    : VENUE_RENTAL_STATUSES.cancelledBeforePayment

  const cancellationNote = `[Cancelled ${new Date().toISOString()}] ${reason}`
  const nextNotes = [rental.notes as string | null, cancellationNote]
    .filter(Boolean)
    .join("\n\n")

  const { error: updateError } = await supabase
    .from("venue_rentals")
    .update({
      status: nextStatus,
      hold_expires_at: null,
      notes: nextNotes,
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (updateError) {
    throw new Error(updateError.message || "Failed to cancel rental.")
  }

  const { error: reservationError } = await supabase
    .from("rental_reservations")
    .update({ status: RENTAL_RESERVATION_STATUSES.cancelled, hold_expires_at: null })
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (reservationError) {
    throw new Error(reservationError.message || "Failed to release rental reservations.")
  }

  await logOverride({
    organizationId,
    venueRentalId: input.venueRentalId,
    action: "cancel_rental",
    reason,
    staffUserId: user.id,
    metadata: {
      after_payment: afterPayment,
      previous_status: currentStatus,
      next_status: nextStatus,
    },
  })

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "rental_cancelled",
      subject: "Venue rental cancelled",
      summary: "A venue rental was cancelled.",
      metadata: { venueRentalId: input.venueRentalId, reason },
    },
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "rental_cancelled",
      subject: "Venue rental cancelled",
      summary: "Your venue rental was cancelled.",
      metadata: { venueRentalId: input.venueRentalId, reason },
    },
  ])

  revalidateVenueRentalPaths()
}

/**
 * Staff-only: migrate a legacy venue_bookings row into the new venue_rentals workflow.
 * Cancels the legacy booking first (removes its resource_reservations block), then creates
 * a linked venue_rentals + rental_reservations row.
 */
export async function importLegacyVenueBookingAsVenueRental(input: {
  legacyVenueBookingId: string
  notes?: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Staff user is required.")
  }

  await assertLegacyVenueBookingAvailableForMigration(
    supabase,
    organizationId,
    input.legacyVenueBookingId
  )

  const { data: legacyBooking, error: legacyError } = await supabase
    .from("venue_bookings")
    .select(
      "id, organization_id, venue_id, user_id, event_type, event_date, start_time, end_time, guest_count, notes, status"
    )
    .eq("id", input.legacyVenueBookingId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (legacyError || !legacyBooking) {
    throw new VenueRentalTransitionError("Legacy venue booking not found.")
  }

  if (!legacyBooking.venue_id || !legacyBooking.event_date) {
    throw new VenueRentalTransitionError(
      "Legacy venue booking is missing venue or event date and cannot be migrated."
    )
  }

  const migrationNote = `Migrated to venue_rentals workflow (legacy booking ${legacyBooking.id}).`

  const { error: cancelLegacyError } = await supabase
    .from("venue_bookings")
    .update({
      status: "cancelled",
      notes: [legacyBooking.notes, migrationNote].filter(Boolean).join("\n\n"),
    })
    .eq("id", input.legacyVenueBookingId)
    .eq("organization_id", organizationId)

  if (cancelLegacyError) {
    throw new VenueRentalTransitionError(
      cancelLegacyError.message || "Failed to cancel legacy venue booking before migration."
    )
  }

  const space = legacyVenueBookingToSpaceSlot({
    venueId: legacyBooking.venue_id as string,
    eventDate: legacyBooking.event_date as string,
    startTime: legacyBooking.start_time as string | null,
    endTime: legacyBooking.end_time as string | null,
  })

  await checkSpaceConflicts(organizationId, [space])

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .insert({
      organization_id: organizationId,
      customer_user_id: legacyBooking.user_id,
      status: VENUE_RENTAL_STATUSES.submitted,
      notes: input.notes?.trim() || (legacyBooking.notes as string | null) || null,
      legacy_venue_booking_id: input.legacyVenueBookingId,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (rentalError || !rental) {
    throw new VenueRentalTransitionError(
      rentalError?.message || "Failed to create venue rental from legacy booking."
    )
  }

  const { error: reservationError } = await supabase.from("rental_reservations").insert({
    organization_id: organizationId,
    venue_rental_id: rental.id,
    venue_id: space.venueId,
    start_at: space.startAt,
    end_at: space.endAt,
    status: RENTAL_RESERVATION_STATUSES.temporaryHold,
    created_by: user.id,
  })

  if (reservationError) {
    await supabase.from("venue_rentals").delete().eq("id", rental.id)
    throw new VenueRentalTransitionError(
      reservationError.message || "Failed to create rental reservation during migration."
    )
  }

  revalidateVenueRentalPaths()
  return rental.id as string
}

/** Staff report: overlapping venue_rental resource_reservations (legacy + new double-blocks). */
export async function getDuplicateVenueRentalBlockReportAction() {
  await assertCanManageVenueRentals()
  return getDuplicateVenueRentalBlockReport()
}
