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
  computeRemainingBalanceDueAt,
  canStaffCancelVenueRental,
  canStaffDeleteVenueRental,
  canStaffForceBookVenueRental,
  isVenueRentalPaymentReceivedStatus,
  isVenueRentalReviewable,
  resolveVenueRentalStatusAfterPayments,
  shouldCancelVenueRentalAfterPayment,
  summarizeOutstandingRentalPayments,
  VENUE_RENTAL_BOOKING_PAYMENT_TYPES,
  VENUE_RENTAL_FORCE_BOOK_STATUSES,
} from "./venue-rental-status"
import { expireVenueRentalHoldsForScope } from "./venue-rental-hold-expiry"
import { completePastConfirmedVenueRentalsForScope } from "./venue-rental-auto-complete"
import {
  getBlockingReservationsForVenue,
  getVenueRentalOrgSettings,
} from "./venue-rental-queries"
import {
  clampBufferMinutes,
  shiftIsoByMinutes,
} from "./venue-rental-buffers"
import { resolveVenueRentalBuffersForVenues } from "./venue-rental-buffers-server"
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
  RENTAL_PAYMENT_METHODS,
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
  RENTAL_RESERVATION_STATUSES,
  VENUE_RENTAL_STATUSES,
  type CreateStaffVenueRentalInput,
  type RentalAddonSelectionInput,
  type RentalPaymentMethod,
  type RentalPaymentType,
  type RentalSpaceSlotInput,
  type SubmitVenueRentalInput,
  type UpdateVenueRentalRequestDetailsInput,
  type VenueRentalStatus,
} from "./venue-rental-types"
import {
  mergeVenueRentalCustomerNotes,
  mergeVenueRentalEventTypeInNotes,
} from "./venue-rental-format"
import { resolveVenueRentalAddonQuantity } from "./venue-rental-addon-quantity"
import {
  canEditPendingCharge,
  isCompletedPaymentStatus,
  isPendingPaymentStatus,
  isVenueRentalPostEventStaffAddon,
  resolveVenueRentalDiscountDollarAmount,
  venueRentalChargePaymentTypeForAddon,
} from "./venue-rental-payment-ledger"
import { venueRentalOrgRequiresPolicyAgreement } from "./venue-rental-policy-documents"

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

async function stampPolicyDocumentsOnRental(input: {
  organizationId: string
  venueRentalId: string
  customerUserId?: string | null
  notifyCustomer?: boolean
  /** Customer already checked acknowledgment on the booking form. */
  alreadyAgreed?: boolean
}) {
  const settings = await getVenueRentalOrgSettings(input.organizationId)
  if (!venueRentalOrgRequiresPolicyAgreement(settings)) {
    return { stamped: false as const, settings, agreed: false as const }
  }

  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from("venue_rentals")
    .update({
      policies_sent_at: nowIso,
      policies_document_url_snapshot: settings.policiesDocumentUrl,
      pricing_guide_url_snapshot: settings.pricingGuideUrl,
      ...(input.alreadyAgreed ? { policies_agreed_at: nowIso } : {}),
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", input.organizationId)

  if (error) {
    if (
      error.code === "42703" ||
      error.message?.toLowerCase().includes("policies_sent_at")
    ) {
      console.error(
        "Policy document columns missing. Run scripts/221_venue_rental_customer_documents.sql"
      )
      return { stamped: false as const, settings, agreed: false as const }
    }
    throw new Error(error.message || "Failed to record policy documents on rental.")
  }

  if (input.notifyCustomer !== false && !input.alreadyAgreed) {
    fireModuleNotifications([
      {
        organizationId: input.organizationId,
        moduleKey: "venue_rentals",
        audience: "customer",
        eventKey: "policies_documents_sent",
        subject: "Review venue rental policies",
        summary:
          "Please review our policies and pricing guide, then agree in your rental portal to continue.",
        metadata: {
          venueRentalId: input.venueRentalId,
          customerUserId: input.customerUserId ?? null,
          policiesDocumentUrl: settings.policiesDocumentUrl,
          pricingGuideUrl: settings.pricingGuideUrl,
        },
      },
    ])
  }

  if (input.alreadyAgreed) {
    fireModuleNotifications([
      {
        organizationId: input.organizationId,
        moduleKey: "venue_rentals",
        audience: "staff",
        eventKey: "policies_agreed",
        subject: "Customer agreed to rental policies",
        summary:
          "A customer agreed to venue rental policies when submitting their request.",
        metadata: {
          venueRentalId: input.venueRentalId,
          customerUserId: input.customerUserId ?? null,
        },
      },
    ])
  }

  return {
    stamped: true as const,
    settings,
    agreed: Boolean(input.alreadyAgreed),
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
  spaces: RentalSpaceSlotInput[],
  excludeSourceIds: string[] = []
) {
  const buffersByVenue = await resolveVenueRentalBuffersForVenues(
    organizationId,
    spaces.map((space) => space.venueId)
  )

  const existingByVenue = new Map<
    string,
    Awaited<ReturnType<typeof getBlockingReservationsForVenue>>
  >()

  for (const space of spaces) {
    if (!existingByVenue.has(space.venueId)) {
      const venueSpaces = spaces.filter((item) => item.venueId === space.venueId)
      let minStart = Infinity
      let maxEnd = 0

      for (const item of venueSpaces) {
        const buffers = buffersByVenue.get(item.venueId) || {
          setupMinutes: 0,
          cleanupMinutes: 0,
        }
        const occupiedStart = new Date(
          shiftIsoByMinutes(item.startAt, -buffers.setupMinutes)
        ).getTime()
        const occupiedEnd = new Date(
          shiftIsoByMinutes(item.endAt, buffers.cleanupMinutes)
        ).getTime()
        minStart = Math.min(minStart, occupiedStart)
        maxEnd = Math.max(maxEnd, occupiedEnd)
      }

      existingByVenue.set(
        space.venueId,
        await getBlockingReservationsForVenue(
          organizationId,
          space.venueId,
          new Date(minStart).toISOString(),
          new Date(maxEnd).toISOString(),
          excludeSourceIds
        )
      )
    }
  }

  const candidates = spaces.map((space, index) => {
    const buffers = buffersByVenue.get(space.venueId) || {
      setupMinutes: 0,
      cleanupMinutes: 0,
    }
    return {
      id: `candidate-${index}`,
      venueId: space.venueId,
      startAt: shiftIsoByMinutes(space.startAt, -buffers.setupMinutes),
      endAt: shiftIsoByMinutes(space.endAt, buffers.cleanupMinutes),
      status: RENTAL_RESERVATION_STATUSES.temporaryHold,
    }
  })

  const existing = Array.from(existingByVenue.values()).flat()
  assertNoReservationConflicts(candidates, existing)
}

async function buildReservationRowsWithBuffers(input: {
  organizationId: string
  venueRentalId: string
  spaces: RentalSpaceSlotInput[]
  status: string
  createdBy: string
  holdExpiresAt?: string | null
}) {
  const buffersByVenue = await resolveVenueRentalBuffersForVenues(
    input.organizationId,
    input.spaces.map((space) => space.venueId)
  )

  return input.spaces.map((space) => {
    const buffers = buffersByVenue.get(space.venueId) || {
      setupMinutes: 0,
      cleanupMinutes: 0,
    }
    return {
      organization_id: input.organizationId,
      venue_rental_id: input.venueRentalId,
      venue_id: space.venueId,
      start_at: space.startAt,
      end_at: space.endAt,
      setup_minutes: buffers.setupMinutes,
      cleanup_minutes: buffers.cleanupMinutes,
      status: input.status,
      hold_expires_at: input.holdExpiresAt ?? null,
      created_by: input.createdBy,
    }
  })
}

async function insertSelectedAddons(
  organizationId: string,
  venueRentalId: string,
  addons: RentalAddonSelectionInput[] | undefined,
  options?: {
    rejectPostEventFees?: boolean
    expectedAttendance?: number | null
    chairsPerTable?: number | null
  }
) {
  if (!addons?.length) {
    return
  }

  const supabase = await createClient()
  const attendance = options?.expectedAttendance ?? null
  const chairsPerTable = options?.chairsPerTable ?? null

  for (const addon of addons) {
    const { data: catalogAddon, error: catalogError } = await supabase
      .from("rental_addons")
      .select("id, name, slug, default_price, is_active")
      .eq("organization_id", organizationId)
      .eq("id", addon.rentalAddonId)
      .maybeSingle()

    if (catalogError || !catalogAddon || !catalogAddon.is_active) {
      throw new Error("One or more selected add-ons are invalid.")
    }

    if (
      options?.rejectPostEventFees !== false &&
      isVenueRentalPostEventStaffAddon({
        slug: catalogAddon.slug as string | null,
        name: catalogAddon.name as string | null,
      })
    ) {
      throw new Error(
        "Extra cleaning and damage charges are added by staff after the event, not during booking."
      )
    }

    const unitPrice = addon.unitPrice ?? Number(catalogAddon.default_price || 0)
    let quantity = Math.max(1, addon.quantity || 1)

    if (
      attendance != null &&
      attendance > 0 &&
      chairsPerTable != null &&
      chairsPerTable > 0
    ) {
      quantity = resolveVenueRentalAddonQuantity({
        slug: catalogAddon.slug as string | null,
        name: catalogAddon.name as string | null,
        expectedAttendance: attendance,
        chairsPerTable,
      })
    }

    const { error } = await supabase.from("rental_selected_addons").insert({
      organization_id: organizationId,
      venue_rental_id: venueRentalId,
      rental_addon_id: addon.rentalAddonId,
      quantity,
      unit_price: unitPrice,
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

async function resolveContactPhoneForCustomer(
  organizationId: string,
  userId: string,
  billingContactId?: string | null
): Promise<string | null> {
  const supabase = await createClient()

  if (billingContactId) {
    const { data } = await supabase
      .from("contacts")
      .select("phone")
      .eq("organization_id", organizationId)
      .eq("id", billingContactId)
      .maybeSingle()
    const phone = (data?.phone as string | null)?.trim()
    if (phone) return phone
  }

  const { data: linkedContact } = await supabase
    .from("contacts")
    .select("phone")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  return (linkedContact?.phone as string | null)?.trim() || null
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

  const expectedAttendance =
    typeof input.operationalSetup?.expectedAttendance === "number" &&
    Number.isFinite(input.operationalSetup.expectedAttendance) &&
    input.operationalSetup.expectedAttendance > 0
      ? Math.floor(input.operationalSetup.expectedAttendance)
      : null
  const chairsPerTable =
    typeof input.operationalSetup?.chairsPerTable === "number" &&
    Number.isFinite(input.operationalSetup.chairsPerTable) &&
    input.operationalSetup.chairsPerTable >= 1
      ? Math.floor(input.operationalSetup.chairsPerTable)
      : null
  const setupStyle = input.operationalSetup?.setupStyle?.trim() || null

  if (!expectedAttendance) {
    throw new Error("Expected attendance is required.")
  }
  if (!chairsPerTable) {
    throw new Error("Enter how many chairs per table.")
  }
  if (!setupStyle) {
    throw new Error("Please select a facility setup style.")
  }

  const eventTypeId = input.venueRentalEventTypeId?.trim() || null
  if (!eventTypeId) {
    throw new Error("Please select an event type.")
  }

  const orgSettings = await getVenueRentalOrgSettings(organizationId)
  if (
    venueRentalOrgRequiresPolicyAgreement(orgSettings) &&
    !input.policiesAcknowledged
  ) {
    throw new Error(
      "Please confirm you have read the policies and procedures and pricing guide before submitting."
    )
  }

  const billingContactId = await resolveBillingContactId(
    organizationId,
    customerUserId,
    input.billingContactId
  )

  const rentalInsertBase = {
    organization_id: organizationId,
    customer_user_id: customerUserId,
    venue_rental_event_type_id: eventTypeId,
    status: VENUE_RENTAL_STATUSES.submitted,
    notes: input.notes?.trim() || null,
    expected_attendance: expectedAttendance,
    hold_expires_at: computeHoldExpiresAt().toISOString(),
    created_by: customerUserId,
  }

  let rentalResult = await supabase
    .from("venue_rentals")
    .insert({
      ...rentalInsertBase,
      billing_contact_id: billingContactId,
    })
    .select("id, hold_expires_at")
    .single()

  if (
    rentalResult.error?.message?.includes("billing_contact_id") &&
    billingContactId
  ) {
    rentalResult = await supabase
      .from("venue_rentals")
      .insert(rentalInsertBase)
      .select("id, hold_expires_at")
      .single()
  }

  const { data: rental, error: rentalError } = rentalResult

  if (rentalError || !rental) {
    console.error(rentalError)
    throw new Error(rentalError?.message || "Failed to create rental request")
  }

  const holdExpiresAt =
    (rental.hold_expires_at as string | null) ||
    computeHoldExpiresAt().toISOString()

  const reservationRows = await buildReservationRowsWithBuffers({
    organizationId,
    venueRentalId: rental.id as string,
    spaces: input.spaces,
    status: RENTAL_RESERVATION_STATUSES.temporaryHold,
    holdExpiresAt,
    createdBy: customerUserId,
  })

  const { error: reservationError } = await supabase
    .from("rental_reservations")
    .insert(reservationRows)

  if (reservationError) {
    await supabase.from("venue_rentals").delete().eq("id", rental.id)
    throw new Error(reservationError.message || "Failed to create temporary hold")
  }

  await insertSelectedAddons(organizationId, rental.id as string, input.addons, {
    expectedAttendance,
    chairsPerTable,
  })

  const primaryContactPhone =
    input.operationalSetup?.primaryContactPhone?.trim() ||
    (await resolveContactPhoneForCustomer(
      organizationId,
      customerUserId,
      billingContactId
    ))

  await syncOperationalBriefForVenueRental(rental.id as string, organizationId, customerUserId, {
    operationalSetup: {
      expectedAttendance,
      chairsPerTable,
      setupStyle,
      primaryContactPhone,
    },
  })

  const policyStamp = await stampPolicyDocumentsOnRental({
    organizationId,
    venueRentalId: rental.id as string,
    customerUserId,
    notifyCustomer: true,
    alreadyAgreed: Boolean(input.policiesAcknowledged),
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
      summary: policyStamp.stamped
        ? policyStamp.agreed
          ? "Your venue rental request was received. Thank you for reviewing our policies."
          : "Your venue rental request was received. Please review and agree to our policies in your portal."
        : "Your venue rental request was received and is awaiting review.",
      metadata: {
        venueRentalId: rental.id,
        customerUserId,
        policiesDocumentUrl: policyStamp.settings.policiesDocumentUrl,
        pricingGuideUrl: policyStamp.settings.pricingGuideUrl,
      },
    },
  ])

  if (billingContactId) {
    await syncContactAffiliations(billingContactId, organizationId, supabase)
  }

  revalidateVenueRentalPaths()
  return rental.id as string
}

/**
 * Staff create a venue rental for any contact (individuals, orgs, groups).
 * Sets billing_contact_id; customer_user_id comes from the contact's linked auth user when present.
 */
export async function createStaffVenueRentalRequest(input: CreateStaffVenueRentalInput) {
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
    throw new Error("You must be signed in to create a rental request.")
  }

  const billingContactId = input.billingContactId?.trim()
  if (!billingContactId) {
    throw new Error("Select a contact for this booking.")
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, auth_user_id")
    .eq("organization_id", organizationId)
    .eq("id", billingContactId)
    .maybeSingle()

  if (contactError || !contact) {
    throw new Error("The selected contact could not be found.")
  }

  validateSpaces(input.spaces)
  await assertVenuesInOrg(
    organizationId,
    input.spaces.map((space) => space.venueId)
  )
  await checkSpaceConflicts(organizationId, input.spaces)

  const customerUserId = (contact.auth_user_id as string | null) || null
  const expectedAttendance =
    typeof input.expectedAttendance === "number" &&
    Number.isFinite(input.expectedAttendance) &&
    input.expectedAttendance > 0
      ? Math.floor(input.expectedAttendance)
      : null

  const rentalInsertBase = {
    organization_id: organizationId,
    customer_user_id: customerUserId,
    venue_rental_event_type_id: input.venueRentalEventTypeId || null,
    status: VENUE_RENTAL_STATUSES.submitted,
    notes: input.notes?.trim() || null,
    expected_attendance: expectedAttendance,
    hold_expires_at: computeHoldExpiresAt().toISOString(),
    created_by: user.id,
  }

  let rentalResult = await supabase
    .from("venue_rentals")
    .insert({
      ...rentalInsertBase,
      billing_contact_id: billingContactId,
    })
    .select("id, hold_expires_at")
    .single()

  if (
    rentalResult.error?.message?.includes("billing_contact_id") &&
    billingContactId
  ) {
    rentalResult = await supabase
      .from("venue_rentals")
      .insert(rentalInsertBase)
      .select("id, hold_expires_at")
      .single()
  }

  const { data: rental, error: rentalError } = rentalResult

  if (rentalError || !rental) {
    console.error(rentalError)
    throw new Error(rentalError?.message || "Failed to create rental request")
  }

  const holdExpiresAt =
    (rental.hold_expires_at as string | null) ||
    computeHoldExpiresAt().toISOString()

  const reservationRows = await buildReservationRowsWithBuffers({
    organizationId,
    venueRentalId: rental.id as string,
    spaces: input.spaces,
    status: RENTAL_RESERVATION_STATUSES.temporaryHold,
    holdExpiresAt,
    createdBy: user.id,
  })

  const { error: reservationError } = await supabase
    .from("rental_reservations")
    .insert(reservationRows)

  if (reservationError) {
    await supabase.from("venue_rentals").delete().eq("id", rental.id)
    throw new Error(reservationError.message || "Failed to create temporary hold")
  }

  await syncOperationalBriefForVenueRental(rental.id as string, organizationId, user.id, {
    operationalSetup: {
      expectedAttendance,
      setupStyle: input.setupStyle?.trim() || null,
    },
  })

  try {
    await insertSelectedAddons(organizationId, rental.id as string, input.addons)
  } catch (addonError) {
    await supabase.from("rental_selected_addons").delete().eq("venue_rental_id", rental.id)
    await supabase.from("rental_reservations").delete().eq("venue_rental_id", rental.id)
    await supabase.from("venue_rentals").delete().eq("id", rental.id)
    throw addonError
  }

  const policyStamp = await stampPolicyDocumentsOnRental({
    organizationId,
    venueRentalId: rental.id as string,
    customerUserId,
    notifyCustomer: Boolean(customerUserId),
  })

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "request_submitted",
      subject: "New venue rental request",
      summary: "Staff created a new venue rental request.",
      metadata: {
        venueRentalId: rental.id,
        billingContactId,
        createdByStaff: true,
      },
    },
    ...(customerUserId
      ? [
          {
            organizationId,
            moduleKey: "venue_rentals" as const,
            audience: "customer" as const,
            eventKey: "request_received",
            subject: "Venue rental request received",
            summary: policyStamp.stamped
              ? "A venue rental request was created for you. Please review and agree to our policies in your portal."
              : "A venue rental request was created for you and is awaiting review.",
            metadata: {
              venueRentalId: rental.id,
              customerUserId,
              policiesDocumentUrl: policyStamp.settings.policiesDocumentUrl,
              pricingGuideUrl: policyStamp.settings.pricingGuideUrl,
            },
          },
        ]
      : []),
  ])

  await syncContactAffiliations(billingContactId, organizationId, supabase)

  revalidateVenueRentalPaths()
  revalidatePath(`/bookings/rentals/${rental.id}`)
  return rental.id as string
}

function reservationStatusForRentalStatus(
  status: VenueRentalStatus
): (typeof RENTAL_RESERVATION_STATUSES)[keyof typeof RENTAL_RESERVATION_STATUSES] {
  if (
    status === VENUE_RENTAL_STATUSES.confirmed ||
    status === VENUE_RENTAL_STATUSES.depositPaid ||
    status === VENUE_RENTAL_STATUSES.securityDepositPaid ||
    status === VENUE_RENTAL_STATUSES.completed ||
    status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval ||
    status === VENUE_RENTAL_STATUSES.securityDepositRefunded ||
    status === VENUE_RENTAL_STATUSES.closed
  ) {
    return RENTAL_RESERVATION_STATUSES.confirmed
  }

  if (
    status === VENUE_RENTAL_STATUSES.cancelledBeforePayment ||
    status === VENUE_RENTAL_STATUSES.cancelledAfterPayment ||
    status === VENUE_RENTAL_STATUSES.declined ||
    status === VENUE_RENTAL_STATUSES.holdExpired
  ) {
    return RENTAL_RESERVATION_STATUSES.cancelled
  }

  return RENTAL_RESERVATION_STATUSES.temporaryHold
}

/** Staff in-place edit of spaces, notes, and event type on an existing rental. */
export async function updateVenueRentalRequestDetails(
  input: UpdateVenueRentalRequestDetailsInput
) {
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
    throw new Error("You must be signed in to update a rental request.")
  }

  const venueRentalId = input.venueRentalId?.trim()
  if (!venueRentalId) {
    throw new Error("Rental id is required.")
  }

  validateSpaces(input.spaces)
  await assertVenuesInOrg(
    organizationId,
    input.spaces.map((space) => space.venueId)
  )

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .select("id, status, notes, venue_rental_event_type_id, hold_expires_at")
    .eq("id", venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rentalError || !rental) {
    throw new Error("Rental request not found.")
  }

  const { data: existingReservations, error: existingReservationsError } =
    await supabase
      .from("rental_reservations")
      .select("id")
      .eq("venue_rental_id", venueRentalId)
      .eq("organization_id", organizationId)

  if (existingReservationsError) {
    throw new Error("Failed to load current reservations.")
  }

  const excludeSourceIds = (existingReservations || []).map((row) => row.id as string)
  await checkSpaceConflicts(organizationId, input.spaces, excludeSourceIds)

  const eventTypeId = input.venueRentalEventTypeId?.trim() || null
  let eventTypeName: string | null = null

  if (eventTypeId) {
    const { data: eventType, error: eventTypeError } = await supabase
      .from("venue_rental_event_types")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("id", eventTypeId)
      .maybeSingle()

    if (eventTypeError || !eventType) {
      throw new Error("The selected event type could not be found.")
    }

    eventTypeName = (eventType.name as string) || null
  }

  let nextNotes = mergeVenueRentalCustomerNotes(rental.notes, input.notes)
  nextNotes = mergeVenueRentalEventTypeInNotes(nextNotes, eventTypeName)

  const { error: updateError } = await supabase
    .from("venue_rentals")
    .update({
      venue_rental_event_type_id: eventTypeId,
      notes: nextNotes,
    })
    .eq("id", venueRentalId)
    .eq("organization_id", organizationId)

  if (updateError) {
    throw new Error(updateError.message || "Failed to update rental request.")
  }

  const reservationStatus = reservationStatusForRentalStatus(
    rental.status as VenueRentalStatus
  )

  if (excludeSourceIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("rental_reservations")
      .delete()
      .eq("venue_rental_id", venueRentalId)
      .eq("organization_id", organizationId)

    if (deleteError) {
      throw new Error(deleteError.message || "Failed to replace reservations.")
    }
  }

  const reservationRows = await buildReservationRowsWithBuffers({
    organizationId,
    venueRentalId,
    spaces: input.spaces,
    status: reservationStatus,
    holdExpiresAt: (rental.hold_expires_at as string | null) ?? null,
    createdBy: user.id,
  })

  const { error: insertError } = await supabase
    .from("rental_reservations")
    .insert(reservationRows)

  if (insertError) {
    throw new Error(insertError.message || "Failed to save updated spaces.")
  }

  await syncOperationalBriefForVenueRental(venueRentalId, organizationId, user.id)

  revalidateVenueRentalPaths()
  revalidatePath(`/bookings/rentals/${venueRentalId}`)
}

export async function approveVenueRentalRequest(input: {
  venueRentalId: string
  depositAmount: number
  /** @deprecated Optional; security deposit is not required for confirmation. */
  securityDepositAmount?: number
  remainingBalanceAmount?: number
  /** Staff override when customer has not agreed yet (walk-ins / exceptions). */
  bypassPolicyAgreement?: boolean
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
    .select("id, status, policies_agreed_at")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rental.error || !rental.data) {
    throw new Error("Rental request not found.")
  }

  if (!isVenueRentalReviewable(rental.data.status as typeof VENUE_RENTAL_STATUSES.submitted)) {
    throw new Error("Only submitted or pending requests can be approved.")
  }

  const settings = await getVenueRentalOrgSettings(organizationId)
  if (
    venueRentalOrgRequiresPolicyAgreement(settings) &&
    !rental.data.policies_agreed_at &&
    !input.bypassPolicyAgreement
  ) {
    throw new Error(
      "Customer must agree to policies and pricing before approval. Ask them to agree in the portal, or use bypass for an exception."
    )
  }

  await approveVenueRentalRequestCore({
    venueRentalId: input.venueRentalId,
    organizationId,
    approvedByUserId: user?.id ?? null,
    depositAmount: input.depositAmount,
    securityDepositAmount: input.securityDepositAmount,
    remainingBalanceAmount: input.remainingBalanceAmount,
  })
}

async function approveVenueRentalRequestCore(input: {
  venueRentalId: string
  organizationId: string
  approvedByUserId: string | null
  depositAmount: number
  securityDepositAmount?: number
  remainingBalanceAmount?: number
}) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const holdExpiresAt = computeHoldExpiresAt(new Date(nowIso))

  const { error: updateError } = await supabase
    .from("venue_rentals")
    .update({
      status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      supervisor_user_id: input.approvedByUserId,
      approved_at: nowIso,
      payment_notice_sent_at: nowIso,
      hold_expires_at: holdExpiresAt.toISOString(),
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", input.organizationId)

  if (updateError) {
    throw new Error(updateError.message || "Failed to approve rental request")
  }

  await supabase
    .from("rental_reservations")
    .update({ hold_expires_at: holdExpiresAt.toISOString() })
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", input.organizationId)

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
      organization_id: input.organizationId,
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
      organization_id: input.organizationId,
      venue_rental_id: input.venueRentalId,
      payment_type: RENTAL_PAYMENT_TYPES.securityDeposit,
      status: RENTAL_PAYMENT_STATUSES.paymentRequested,
      amount: securityAmount,
      due_at: holdExpiresAt.toISOString(),
    })
  }

  if (input.remainingBalanceAmount && input.remainingBalanceAmount > 0) {
    const { data: reservationStarts } = await supabase
      .from("rental_reservations")
      .select("start_at")
      .eq("venue_rental_id", input.venueRentalId)
      .eq("organization_id", input.organizationId)
      .order("start_at", { ascending: true })
      .limit(1)

    const earliestStart = reservationStarts?.[0]?.start_at as string | undefined
    const remainingDueAt = earliestStart
      ? computeRemainingBalanceDueAt(earliestStart).toISOString()
      : null

    paymentRows.push({
      organization_id: input.organizationId,
      venue_rental_id: input.venueRentalId,
      payment_type: RENTAL_PAYMENT_TYPES.remainingBalance,
      status: RENTAL_PAYMENT_STATUSES.unpaid,
      amount: input.remainingBalanceAmount,
      due_at: remainingDueAt,
    })
  }

  await supabase.from("rental_payments").insert(paymentRows)

  await supabase.from("rental_contracts").insert({
    organization_id: input.organizationId,
    venue_rental_id: input.venueRentalId,
    status: RENTAL_CONTRACT_STATUSES.generated,
  })

  await syncOperationalBriefForVenueRental(
    input.venueRentalId,
    input.organizationId,
    input.approvedByUserId
  )

  fireModuleNotifications([
    {
      organizationId: input.organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "request_approved",
      subject: "Venue rental approved",
      summary: "A venue rental was approved and deposit payment was requested.",
      metadata: { venueRentalId: input.venueRentalId },
    },
    {
      organizationId: input.organizationId,
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
  revalidatePath(`/bookings/rentals/${input.venueRentalId}`)
  revalidatePath(`/customer/rentals/${input.venueRentalId}`)
}

/** Customer agrees to org policies/pricing documents stamped on the rental. */
export async function agreeVenueRentalPolicies(input: { venueRentalId: string }) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in to agree to policies.")
  }

  const portalSession = await resolveCustomerPortalSession()
  const customerUserId = portalSession?.effectiveUserId ?? user.id

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .select(
      "id, status, customer_user_id, policies_sent_at, policies_agreed_at, policies_document_url_snapshot, pricing_guide_url_snapshot"
    )
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (rentalError || !rental) {
    throw new Error("Rental request not found.")
  }

  if (rental.customer_user_id !== customerUserId) {
    throw new Error("You can only agree to policies for your own rental request.")
  }

  if (!isVenueRentalReviewable(rental.status as typeof VENUE_RENTAL_STATUSES.submitted)) {
    throw new Error("This rental is no longer awaiting policy agreement.")
  }

  const hasDocs = Boolean(
    rental.policies_document_url_snapshot || rental.pricing_guide_url_snapshot
  )
  if (!hasDocs && !rental.policies_sent_at) {
    throw new Error("No policy documents are attached to this request.")
  }

  if (rental.policies_agreed_at) {
    return { agreed: true, autoApproved: false }
  }

  const nowIso = new Date().toISOString()
  const { error: agreeError } = await supabase
    .from("venue_rentals")
    .update({ policies_agreed_at: nowIso })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (agreeError) {
    throw new Error(agreeError.message || "Failed to record policy agreement.")
  }

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "policies_agreed",
      subject: "Customer agreed to rental policies",
      summary: "A customer agreed to venue rental policies and is ready for review.",
      metadata: { venueRentalId: input.venueRentalId, customerUserId },
    },
  ])

  const settings = await getVenueRentalOrgSettings(organizationId)
  let autoApproved = false

  if (settings.approvalMode === "auto_after_agreement") {
    const { getVenueRentalDetailRow, getVenueRentalQuotedCharges } = await import(
      "./venue-rental-queries"
    )
    const detail = await getVenueRentalDetailRow(input.venueRentalId)
    const quoted = detail
      ? await getVenueRentalQuotedCharges(detail)
      : { totalCharges: 0 }
    const depositAmount = Math.max(0, Number(quoted.totalCharges) || 0)
    const securityDepositAmount =
      settings.securityDepositEnabled && settings.defaultSecurityDepositAmount != null
        ? settings.defaultSecurityDepositAmount
        : 0

    await approveVenueRentalRequestCore({
      venueRentalId: input.venueRentalId,
      organizationId,
      approvedByUserId: null,
      depositAmount,
      securityDepositAmount: securityDepositAmount > 0 ? securityDepositAmount : undefined,
    })
    autoApproved = true
  }

  revalidateVenueRentalPaths()
  revalidatePath(`/bookings/rentals/${input.venueRentalId}`)
  revalidatePath(`/customer/rentals/${input.venueRentalId}`)
  return { agreed: true, autoApproved }
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
    | "installment"
    | "addon_fee"
    | "cleaning_fee"
  amount: number
  notes?: string
  paymentMethod?: RentalPaymentMethod
  paymentDate?: string
  referenceNumber?: string
  receiptUrl?: string
}) {
  await assertCanManageVenueRentals()

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a payment amount greater than zero.")
  }

  const paymentType = input.paymentType as RentalPaymentType
  const paymentMethod = input.paymentMethod || RENTAL_PAYMENT_METHODS.other
  const paidAt = input.paymentDate
    ? new Date(input.paymentDate).toISOString()
    : new Date().toISOString()

  if (Number.isNaN(new Date(paidAt).getTime())) {
    throw new Error("Enter a valid payment date.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("id, status")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!rental) {
    throw new Error("Venue rental not found.")
  }

  // While Approved (deposit due), apply money to the deposit hold — even if the
  // staff picker said Final Payment / Installment (common when no pending
  // deposit row exists, e.g. imported requests).
  let effectivePaymentType = paymentType
  const awaitingDeposit =
    rental.status === VENUE_RENTAL_STATUSES.approvedPendingPayment

  if (
    awaitingDeposit &&
    VENUE_RENTAL_BOOKING_PAYMENT_TYPES.has(paymentType)
  ) {
    const { data: depositRows } = await supabase
      .from("rental_payments")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("venue_rental_id", input.venueRentalId)
      .eq("payment_type", RENTAL_PAYMENT_TYPES.deposit)
      .order("created_at", { ascending: true })

    const unpaidDeposit = (depositRows || []).find((payment) =>
      isPendingPaymentStatus(String(payment.status || ""))
    )
    const hasAnyDeposit = (depositRows || []).length > 0

    if (unpaidDeposit || !hasAnyDeposit) {
      effectivePaymentType = RENTAL_PAYMENT_TYPES.deposit
    }
  }

  const { data: existingPayments, error: listError } = await supabase
    .from("rental_payments")
    .select("id, status, amount")
    .eq("organization_id", organizationId)
    .eq("venue_rental_id", input.venueRentalId)
    .eq("payment_type", effectivePaymentType)
    .order("created_at", { ascending: true })

  if (listError) {
    throw new Error(listError.message || "Failed to load payment records.")
  }

  const unpaid = (existingPayments || []).find((payment) =>
    isPendingPaymentStatus(String(payment.status || ""))
  )

  let paymentId = unpaid?.id as string | undefined
  const noteText = input.notes?.trim() || null
  const referenceNumber = input.referenceNumber?.trim() || null
  const receiptUrl = input.receiptUrl?.trim() || null

  const paidFields = {
    amount,
    status: RENTAL_PAYMENT_STATUSES.paidManually,
    paid_at: paidAt,
    notes: noteText,
    payment_method: paymentMethod,
    reference_number: referenceNumber,
    recorded_by: user?.id ?? null,
    receipt_url: receiptUrl,
  }

  if (paymentId) {
    const { error } = await supabase
      .from("rental_payments")
      .update(paidFields)
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
        payment_type: effectivePaymentType,
        ...paidFields,
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
        paymentType: effectivePaymentType,
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
        paymentType: effectivePaymentType,
        amount,
      },
    },
  ])

  revalidateVenueRentalPaths()
}

/** Add a pending charge line (does not mark received). */
export async function addVenueRentalCharge(input: {
  venueRentalId: string
  paymentType?:
    | "deposit"
    | "security_deposit"
    | "remaining_balance"
    | "addon_fee"
    | "cleaning_fee"
    | "adjustment"
    | "installment"
  /** Catalog add-on — preferred for Financial → Add charge. */
  rentalAddonId?: string | null
  quantity?: number
  unitPrice?: number | null
  amount?: number
  dueAt?: string | null
  notes?: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("id")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!rental) throw new Error("Venue rental not found.")

  const quantityRaw = Number(input.quantity)
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1

  let paymentType = input.paymentType || RENTAL_PAYMENT_TYPES.addonFee
  let amount = Number(input.amount)
  let autoNote: string | null = null

  const rentalAddonId = input.rentalAddonId?.trim() || null
  if (rentalAddonId) {
    const { data: catalogAddon, error: catalogError } = await supabase
      .from("rental_addons")
      .select("id, name, slug, default_price, is_active")
      .eq("organization_id", organizationId)
      .eq("id", rentalAddonId)
      .maybeSingle()

    if (catalogError || !catalogAddon || !catalogAddon.is_active) {
      throw new Error("The selected add-on is invalid or inactive.")
    }

    paymentType = venueRentalChargePaymentTypeForAddon({
      slug: catalogAddon.slug as string | null,
      name: catalogAddon.name as string,
    })

    const unitPrice =
      input.unitPrice != null && Number.isFinite(Number(input.unitPrice))
        ? Number(input.unitPrice)
        : Number(catalogAddon.default_price || 0)

    if (!Number.isFinite(amount) || amount <= 0) {
      amount = Math.round(unitPrice * quantity * 100) / 100
    }

    autoNote =
      quantity > 1
        ? `${catalogAddon.name} × ${quantity}`
        : (catalogAddon.name as string)
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a charge amount greater than zero.")
  }

  const staffNotes = input.notes?.trim()
  const notes = [autoNote, staffNotes].filter(Boolean).join("\n") || null

  const { error } = await supabase.from("rental_payments").insert({
    organization_id: organizationId,
    venue_rental_id: input.venueRentalId,
    payment_type: paymentType,
    status: RENTAL_PAYMENT_STATUSES.paymentRequested,
    amount,
    due_at: input.dueAt || null,
    notes,
    recorded_by: user?.id ?? null,
  })

  if (error) {
    throw new Error(error.message || "Failed to add charge.")
  }

  revalidateVenueRentalPaths()
}

/** Apply a completed credit (reduces balance due without rewriting payments). */
export async function applyVenueRentalCredit(input: {
  venueRentalId: string
  amount: number
  notes?: string
  referenceNumber?: string
}) {
  await assertCanManageVenueRentals()

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a credit amount greater than zero.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("rental_payments").insert({
    organization_id: organizationId,
    venue_rental_id: input.venueRentalId,
    payment_type: RENTAL_PAYMENT_TYPES.credit,
    status: RENTAL_PAYMENT_STATUSES.completed,
    amount,
    paid_at: new Date().toISOString(),
    notes: input.notes?.trim() || null,
    reference_number: input.referenceNumber?.trim() || null,
    recorded_by: user?.id ?? null,
    payment_method: RENTAL_PAYMENT_METHODS.other,
  })

  if (error) {
    throw new Error(error.message || "Failed to apply credit.")
  }

  revalidateVenueRentalPaths()
}

/**
 * Apply a completed discount (fixed $ or % of basis / total charges).
 * Reduces balance due; shown separately from credits on the Financial panel.
 */
export async function applyVenueRentalDiscount(input: {
  venueRentalId: string
  discountType: "fixed" | "percent"
  amount: number
  /** Total charges basis from the UI when applying a percent discount. */
  basisAmount?: number
  notes?: string
  referenceNumber?: string
}) {
  await assertCanManageVenueRentals()

  const discountType = input.discountType
  if (discountType !== "fixed" && discountType !== "percent") {
    throw new Error("Choose a fixed amount or percentage discount.")
  }

  const dollarAmount = resolveVenueRentalDiscountDollarAmount({
    discountType,
    amount: input.amount,
    basisAmount: input.basisAmount,
  })

  if (dollarAmount <= 0) {
    throw new Error("Discount must resolve to more than $0.00.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("id")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!rental) throw new Error("Venue rental not found.")

  const formatUsd = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value)

  const calcNote =
    discountType === "percent"
      ? `Discount: ${Number(input.amount)}% of ${formatUsd(
          Number(input.basisAmount) || 0
        )} (${formatUsd(dollarAmount)})`
      : null

  const staffNotes = input.notes?.trim()
  const notes = staffNotes || calcNote

  const { error } = await supabase.from("rental_payments").insert({
    organization_id: organizationId,
    venue_rental_id: input.venueRentalId,
    payment_type: RENTAL_PAYMENT_TYPES.discount,
    status: RENTAL_PAYMENT_STATUSES.completed,
    amount: dollarAmount,
    paid_at: new Date().toISOString(),
    notes,
    reference_number: input.referenceNumber?.trim() || null,
    recorded_by: user?.id ?? null,
    payment_method: RENTAL_PAYMENT_METHODS.other,
  })

  if (error) {
    throw new Error(error.message || "Failed to apply discount.")
  }

  await syncVenueRentalStatusAfterPayment(input.venueRentalId, organizationId)
  revalidateVenueRentalPaths()
}

/**
 * Confirm an online/Stripe settlement server-side.
 * Idempotent on stripe_payment_intent_id (unique index from script 215).
 */
export async function recordVenueRentalOnlinePaymentConfirmed(input: {
  venueRentalId: string
  amount: number
  stripePaymentIntentId: string
  paymentType?:
    | "deposit"
    | "security_deposit"
    | "remaining_balance"
    | "installment"
  notes?: string
}) {
  await assertCanManageVenueRentals()

  const amount = Number(input.amount)
  const intentId = input.stripePaymentIntentId.trim()
  if (!intentId) throw new Error("Provider payment id is required.")
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a payment amount greater than zero.")
  }

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: existing } = await supabase
    .from("rental_payments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle()

  if (existing) {
    return { paymentId: existing.id as string, created: false }
  }

  const paymentType = (input.paymentType ||
    RENTAL_PAYMENT_TYPES.deposit) as RentalPaymentType

  const { data: created, error } = await supabase
    .from("rental_payments")
    .insert({
      organization_id: organizationId,
      venue_rental_id: input.venueRentalId,
      payment_type: paymentType,
      status: RENTAL_PAYMENT_STATUSES.paidStripeLater,
      amount,
      paid_at: new Date().toISOString(),
      notes: input.notes?.trim() || null,
      payment_method: RENTAL_PAYMENT_METHODS.online,
      stripe_payment_intent_id: intentId,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("rental_payments")
        .select("id")
        .eq("stripe_payment_intent_id", intentId)
        .maybeSingle()
      if (raced) return { paymentId: raced.id as string, created: false }
    }
    throw new Error(error.message || "Failed to record online payment.")
  }

  await syncVenueRentalStatusAfterPayment(input.venueRentalId, organizationId)
  revalidateVenueRentalPaths()
  return { paymentId: created.id as string, created: true }
}

/** Void a completed payment — keeps audit trail (does not delete). */
export async function voidVenueRentalPaymentRecord(input: {
  paymentId: string
  reason?: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: payment, error: paymentError } = await supabase
    .from("rental_payments")
    .select("id, venue_rental_id, status, notes")
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (paymentError || !payment) {
    throw new Error("Payment record not found.")
  }

  if (!isCompletedPaymentStatus(String(payment.status || ""))) {
    throw new Error("Only completed payments can be voided. Delete pending charges instead.")
  }

  const reason = input.reason?.trim()
  const notes = [payment.notes, reason ? `Voided: ${reason}` : "Voided"]
    .filter(Boolean)
    .join(" · ")

  const { error } = await supabase
    .from("rental_payments")
    .update({
      status: RENTAL_PAYMENT_STATUSES.voided,
      notes,
    })
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to void payment.")
  }

  await syncVenueRentalStatusAfterPayment(
    payment.venue_rental_id as string,
    organizationId
  )
  revalidateVenueRentalPaths()
}

/** Staff-triggered payment reminder notification. */
export async function sendVenueRentalPaymentReminder(input: {
  venueRentalId: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("id")
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!rental) throw new Error("Venue rental not found.")

  await supabase
    .from("venue_rentals")
    .update({ event_reminder_sent_at: new Date().toISOString() })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "customer",
      eventKey: "balance_reminder",
      subject: "Venue rental payment reminder",
      summary: "A payment reminder was sent for your venue rental.",
      metadata: { venueRentalId: input.venueRentalId },
    },
    {
      organizationId,
      moduleKey: "venue_rentals",
      audience: "staff",
      eventKey: "balance_reminder",
      subject: "Venue rental payment reminder sent",
      summary: "A payment reminder was sent to the customer.",
      metadata: { venueRentalId: input.venueRentalId },
    },
  ])

  revalidateVenueRentalPaths()
}

/**
 * Edit transaction details (method, reference, notes, date).
 * Completed payments: metadata only (amount stays — void to correct amount).
 * Pending charges: amount and due date may also be updated.
 */
export async function updateVenueRentalTransactionDetails(input: {
  paymentId: string
  paymentMethod?: RentalPaymentMethod | null
  referenceNumber?: string | null
  notes?: string | null
  paymentDate?: string | null
  receiptUrl?: string | null
  amount?: number | null
  dueAt?: string | null
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { data: payment, error: paymentError } = await supabase
    .from("rental_payments")
    .select(
      "id, venue_rental_id, payment_type, status, payment_method, reference_number, notes, paid_at, due_at, receipt_url, amount"
    )
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (paymentError || !payment) {
    throw new Error("Transaction not found.")
  }

  if (payment.payment_type === RENTAL_PAYMENT_TYPES.refund) {
    throw new Error("Refund rows cannot be edited here.")
  }

  if (
    payment.status === RENTAL_PAYMENT_STATUSES.voided ||
    payment.status === RENTAL_PAYMENT_STATUSES.failed ||
    payment.status === RENTAL_PAYMENT_STATUSES.refunded
  ) {
    throw new Error("Voided, failed, or refunded transactions cannot be edited.")
  }

  const isPending = canEditPendingCharge(String(payment.status || ""))
  const isCompleted = isCompletedPaymentStatus(String(payment.status || ""))

  if (!isPending && !isCompleted) {
    throw new Error("This transaction cannot be edited in its current status.")
  }

  const updates: Record<string, unknown> = {}

  if (input.paymentMethod !== undefined) {
    const method = input.paymentMethod?.trim() || null
    if (
      method &&
      !Object.values(RENTAL_PAYMENT_METHODS).includes(method as RentalPaymentMethod)
    ) {
      throw new Error("Choose a valid payment method.")
    }
    updates.payment_method = method
  }

  if (input.referenceNumber !== undefined) {
    updates.reference_number = input.referenceNumber?.trim() || null
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes?.trim() || null
  }

  if (input.receiptUrl !== undefined) {
    updates.receipt_url = input.receiptUrl?.trim() || null
  }

  if (input.paymentDate !== undefined) {
    const dateValue = input.paymentDate?.trim()
    if (dateValue) {
      const paidAt = new Date(`${dateValue}T12:00:00`)
      if (Number.isNaN(paidAt.getTime())) {
        throw new Error("Enter a valid payment date.")
      }
      updates.paid_at = paidAt.toISOString()
    } else if (isCompleted) {
      throw new Error("Completed transactions need a payment date.")
    } else {
      updates.paid_at = null
    }
  }

  if (input.amount !== undefined && input.amount !== null) {
    if (!isPending) {
      throw new Error(
        "Completed payment amounts cannot be edited. Void and record a correction instead."
      )
    }
    const amount = Number(input.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter an amount greater than zero.")
    }
    updates.amount = amount
  }

  if (input.dueAt !== undefined) {
    if (!isPending) {
      throw new Error("Due date can only be edited on pending charges.")
    }
    const dueValue = input.dueAt?.trim()
    updates.due_at = dueValue
      ? new Date(`${dueValue}T12:00:00`).toISOString()
      : null
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No changes to save.")
  }

  const { error } = await supabase
    .from("rental_payments")
    .update(updates)
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to update transaction.")
  }

  await syncVenueRentalStatusAfterPayment(
    payment.venue_rental_id as string,
    organizationId
  )
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

  if (!canEditPendingCharge(String(payment.status || ""))) {
    throw new Error(
      "Completed payments cannot be edited. Void and record a correction instead."
    )
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
    .select("id, venue_rental_id, payment_type, status")
    .eq("id", input.paymentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (paymentError || !payment) {
    throw new Error("Payment record not found.")
  }

  if (payment.payment_type === RENTAL_PAYMENT_TYPES.refund) {
    throw new Error("Refund rows cannot be deleted here.")
  }

  if (!canEditPendingCharge(String(payment.status || ""))) {
    throw new Error(
      "Completed payments cannot be deleted. Void the payment to preserve the audit trail."
    )
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
    RENTAL_PAYMENT_STATUSES.completed,
  ])

  const paidTypes = (payments || [])
    .filter((payment) => paidStatuses.has(payment.status as string))
    .map((payment) => String(payment.payment_type || ""))

  // Intended process: collecting a booking payment (deposit / final / installment)
  // confirms the hold. Security deposit / cleaning / add-ons do not. Do not regress
  // confirmed / completed / cancelled when editing later balance lines.
  const nextStatus = resolveVenueRentalStatusAfterPayments({
    previousStatus,
    paidPaymentTypes: paidTypes,
  })

  if (nextStatus === previousStatus) {
    if (nextStatus === VENUE_RENTAL_STATUSES.confirmed) {
      // Still clear hold if somehow still set on an already-confirmed rental.
      await supabase
        .from("venue_rentals")
        .update({ hold_expires_at: null })
        .eq("id", venueRentalId)
        .eq("organization_id", organizationId)
        .not("hold_expires_at", "is", null)
    }
    return
  }

  const statusUpdate: Record<string, unknown> = { status: nextStatus }
  if (nextStatus === VENUE_RENTAL_STATUSES.confirmed) {
    statusUpdate.hold_expires_at = null
  }

  const { data: updatedRental, error: statusError } = await supabase
    .from("venue_rentals")
    .update(statusUpdate)
    .eq("id", venueRentalId)
    .eq("organization_id", organizationId)
    .select("status")
    .maybeSingle()

  if (statusError) {
    throw new Error(statusError.message || "Failed to update rental status.")
  }

  if (!updatedRental || updatedRental.status !== nextStatus) {
    throw new Error(
      "Failed to update rental status (no row updated). Check organization access."
    )
  }

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

/**
 * Repair Approved rentals that already have a booking payment recorded but were
 * never moved to Confirmed (e.g. payment typed as Final Payment before the fix).
 */
export async function reconcileVenueRentalStatusFromPayments(
  venueRentalId: string
) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) return { updated: false }

  const { data: rental } = await supabase
    .from("venue_rentals")
    .select("status")
    .eq("id", venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!rental) return { updated: false }

  const previousStatus = rental.status as VenueRentalStatus
  if (previousStatus !== VENUE_RENTAL_STATUSES.approvedPendingPayment) {
    return { updated: false }
  }

  await syncVenueRentalStatusAfterPayment(venueRentalId, organizationId)

  const { data: refreshed } = await supabase
    .from("venue_rentals")
    .select("status")
    .eq("id", venueRentalId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const nextStatus = refreshed?.status as VenueRentalStatus | undefined
  if (nextStatus && nextStatus !== previousStatus) {
    revalidateVenueRentalPaths()
    revalidatePath(`/bookings/rentals/${venueRentalId}`)
    return { updated: true, status: nextStatus }
  }

  return { updated: false, status: previousStatus }
}

/**
 * Batch-repair all Approved rentals in the org that already have confirming
 * payments on the ledger. Called when staff open Requests (same pattern as
 * auto-complete) so the queue updates without opening each detail page.
 */
export async function reconcileApprovedVenueRentalsWithPayments() {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) return 0

  const { data: rentals, error } = await supabase
    .from("venue_rentals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", VENUE_RENTAL_STATUSES.approvedPendingPayment)

  if (error) {
    console.error("Failed to load Approved rentals for payment reconcile:", error)
    return 0
  }

  if (!rentals?.length) return 0

  let updatedCount = 0
  for (const rental of rentals) {
    try {
      const before = VENUE_RENTAL_STATUSES.approvedPendingPayment
      await syncVenueRentalStatusAfterPayment(rental.id as string, organizationId)

      const { data: refreshed } = await supabase
        .from("venue_rentals")
        .select("status")
        .eq("id", rental.id)
        .eq("organization_id", organizationId)
        .maybeSingle()

      if (
        refreshed?.status &&
        refreshed.status !== before &&
        refreshed.status === VENUE_RENTAL_STATUSES.confirmed
      ) {
        updatedCount += 1
      }
    } catch (error) {
      console.error(
        `Failed to reconcile venue rental ${rental.id} after payment:`,
        error
      )
    }
  }

  if (updatedCount > 0) {
    revalidateVenueRentalPaths()
  }

  return updatedCount
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

/** Mark confirmed rentals Completed when their last reserved slot has ended. */
export async function completePastConfirmedVenueRentals(now = new Date()) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return 0
  }

  const result = await completePastConfirmedVenueRentalsForScope({
    supabase,
    organizationId,
    now,
  })

  if (result.completedCount > 0) {
    revalidateVenueRentalPaths()
  }

  return result.completedCount
}

/** Mark a confirmed rental completed without the security-deposit refund workflow. */
export async function markVenueRentalCompleted(input: {
  venueRentalId: string
  notes?: string
}) {
  await assertCanManageVenueRentals()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
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

  if (
    rental.status !== VENUE_RENTAL_STATUSES.confirmed &&
    rental.status !== VENUE_RENTAL_STATUSES.depositPaid &&
    rental.status !== VENUE_RENTAL_STATUSES.securityDepositPaid
  ) {
    throw new Error("Only confirmed rentals can be marked completed.")
  }

  const note = input.notes?.trim()
  const nextNotes =
    note && note.length > 0
      ? [rental.notes?.trim(), note].filter(Boolean).join("\n\n")
      : rental.notes

  const { error } = await supabase
    .from("venue_rentals")
    .update({
      status: VENUE_RENTAL_STATUSES.completed,
      notes: nextNotes,
    })
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to mark rental completed.")
  }

  revalidateVenueRentalPaths()
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

  const settings = await getVenueRentalOrgSettings(organizationId)
  if (!settings.securityDepositEnabled) {
    throw new Error(
      "Security deposit refunds are turned off for this organization. Enable them under Venue Rentals → Settings → General, or mark the rental completed instead."
    )
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
    RENTAL_PAYMENT_STATUSES.completed,
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
    .select("id, venue_id, start_at, end_at, setup_minutes, cleanup_minutes")
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (reservationsError) {
    throw new Error("Failed to load rental reservations.")
  }

  let hasConflict = false
  for (const reservation of reservations || []) {
    const setupMinutes = clampBufferMinutes(reservation.setup_minutes)
    const cleanupMinutes = clampBufferMinutes(reservation.cleanup_minutes)
    const blocking = await getBlockingReservationsForVenue(
      organizationId,
      reservation.venue_id as string,
      shiftIsoByMinutes(reservation.start_at as string, -setupMinutes),
      shiftIsoByMinutes(reservation.end_at as string, cleanupMinutes),
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
    RENTAL_PAYMENT_STATUSES.completed,
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
    RENTAL_PAYMENT_STATUSES.completed,
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
 * Hard-delete a mistaken rental request when no payment has been received.
 * Cascades to rental_reservations (and removes resource_reservations via DB sync).
 */
export async function deleteVenueRentalRequest(input: {
  venueRentalId: string
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
    throw new Error("Rental request not found.")
  }

  const { data: paymentRows, error: paymentsError } = await supabase
    .from("rental_payments")
    .select("status")
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (paymentsError) {
    throw new Error("Failed to load rental payments.")
  }

  const hasReceivedPayment = (paymentRows || []).some((payment) =>
    isVenueRentalPaymentReceivedStatus(String(payment.status || ""))
  )

  if (!canStaffDeleteVenueRental(hasReceivedPayment)) {
    throw new Error(
      "This rental has received payment and cannot be deleted. Cancel it instead."
    )
  }

  // Ensure calendar blocks are released even if cascade/trigger order differs.
  const { data: reservationRows } = await supabase
    .from("rental_reservations")
    .select("id")
    .eq("venue_rental_id", input.venueRentalId)
    .eq("organization_id", organizationId)

  const reservationIds = (reservationRows || []).map((row) => row.id as string)
  if (reservationIds.length > 0) {
    await supabase
      .from("resource_reservations")
      .delete()
      .eq("organization_id", organizationId)
      .eq("source_type", "venue_rental")
      .in("source_id", reservationIds)
  }

  const { error: deleteError } = await supabase
    .from("venue_rentals")
    .delete()
    .eq("id", input.venueRentalId)
    .eq("organization_id", organizationId)

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete rental request.")
  }

  revalidateVenueRentalPaths()
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/overview")
  revalidatePath("/facilities/reservation-center")
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

  const holdExpiresAt = computeHoldExpiresAt().toISOString()

  const { data: rental, error: rentalError } = await supabase
    .from("venue_rentals")
    .insert({
      organization_id: organizationId,
      customer_user_id: legacyBooking.user_id,
      status: VENUE_RENTAL_STATUSES.submitted,
      notes: input.notes?.trim() || (legacyBooking.notes as string | null) || null,
      legacy_venue_booking_id: input.legacyVenueBookingId,
      hold_expires_at: holdExpiresAt,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (rentalError || !rental) {
    throw new VenueRentalTransitionError(
      rentalError?.message || "Failed to create venue rental from legacy booking."
    )
  }

  const reservationRows = await buildReservationRowsWithBuffers({
    organizationId,
    venueRentalId: rental.id as string,
    spaces: [space],
    status: RENTAL_RESERVATION_STATUSES.temporaryHold,
    holdExpiresAt,
    createdBy: user.id,
  })

  const { error: reservationError } = await supabase
    .from("rental_reservations")
    .insert(reservationRows[0])

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
