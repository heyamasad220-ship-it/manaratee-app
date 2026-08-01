import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import {
  reservationStatusBlocksBooking,
  type ConflictCheckReservation,
} from "@/lib/reservations/reservation-conflict-rules"
import { getProgramAvailabilityBlocksForOrg, getProgramBlockingReservationsForVenue } from "@/lib/reservations/reservation-queries"
import { rangesOverlap } from "@/lib/reservations/reservation-time"

import {
  buildVenueRateLookup,
  computeVenueRentalQuotedCharges,
} from "./venue-rental-quote"
import {
  applyVenueRentalDiscountPolicies,
  type VenueRentalDiscountPolicyRule,
} from "./venue-rental-discount-policies"
import {
  deriveVenueRentalPaymentLedgerStatus,
  deriveVenueRentalStaffNextAction,
  rentalHasFinancialActivity,
  summarizeVenueRentalPaymentLedger,
} from "./venue-rental-payment-ledger"
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
  isVenueRentalPaymentReceivedStatus,
} from "./venue-rental-status"
import type {
  RentalAddonCatalogItem,
  RentalAddonSettingsItem,
  VenueRentalDiscountPolicySettingsItem,
  VenueRentalDiscountType,
  VenueRentalOrgSettings,
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
  excludeSourceId?: string | string[]
): Promise<ConflictCheckReservation[]> {
  const supabase = await createClient()
  const excludeSourceIds = new Set(
    (Array.isArray(excludeSourceId)
      ? excludeSourceId
      : excludeSourceId
        ? [excludeSourceId]
        : []
    ).filter(Boolean)
  )

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

  const stored = (data || [])
    .filter((row) => {
      if (row.source_id && excludeSourceIds.has(row.source_id as string)) {
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

  const programBlocks = await getProgramBlockingReservationsForVenue(
    organizationId,
    venueId,
    rangeStart,
    rangeEnd
  )

  return [...stored, ...programBlocks]
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

  const stored = (data || [])
    .filter((row) => reservationStatusBlocksBooking(row.status as string))
    .map((row) => ({
      venueId: row.venue_id as string,
      startAt: row.start_at as string,
      endAt: row.end_at as string,
    }))

  const programBlocks = await getProgramAvailabilityBlocksForOrg(
    organizationId,
    rangeStart,
    rangeEnd
  )

  return [...stored, ...programBlocks]
}

export async function getActiveRentalAddons(
  organizationId?: string | null
): Promise<RentalAddonCatalogItem[]> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await resolveOrganizationId())

  if (!orgId) {
    return []
  }

  const { data, error } = await supabase
    .from("rental_addons")
    .select("id, name, slug, description, default_price")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    // Older DBs may not have slug selected yet; retry without crashing callers.
    if (error.message?.includes("slug")) {
      const fallback = await supabase
        .from("rental_addons")
        .select("id, name, description, default_price")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
      if (fallback.error) {
        console.error(fallback.error)
        throw new Error("Failed to load rental add-ons")
      }
      return (fallback.data || []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        slug: "",
        description: (row.description as string | null) ?? null,
        defaultPrice: Number(row.default_price || 0),
      }))
    }
    console.error(error)
    throw new Error("Failed to load rental add-ons")
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: (row.slug as string | null) || "",
    description: (row.description as string | null) ?? null,
    defaultPrice: Number(row.default_price || 0),
  }))
}

const DEFAULT_VENUE_RENTAL_ORG_SETTINGS: VenueRentalOrgSettings = {
  securityDepositEnabled: false,
  defaultSecurityDepositAmount: null,
  policiesDocumentUrl: null,
  policiesDocumentName: null,
  pricingGuideUrl: null,
  pricingGuideName: null,
  approvalMode: "manual",
}

/** Per-org Venue Rentals settings (Settings → General). Missing row = defaults. */
export async function getVenueRentalOrgSettings(
  organizationId?: string | null
): Promise<VenueRentalOrgSettings> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await resolveOrganizationId())

  if (!orgId) {
    return { ...DEFAULT_VENUE_RENTAL_ORG_SETTINGS }
  }

  const { data, error } = await supabase
    .from("venue_rental_settings")
    .select(
      "security_deposit_enabled, default_security_deposit_amount, policies_document_url, policies_document_name, pricing_guide_url, pricing_guide_name, approval_mode"
    )
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01") {
      return { ...DEFAULT_VENUE_RENTAL_ORG_SETTINGS }
    }
    // Pre-migration 221: fall back to security-deposit columns only.
    if (
      error.code === "42703" ||
      error.code === "PGRST204" ||
      error.message?.toLowerCase().includes("does not exist")
    ) {
      const legacy = await supabase
        .from("venue_rental_settings")
        .select("security_deposit_enabled, default_security_deposit_amount")
        .eq("organization_id", orgId)
        .maybeSingle()
      if (legacy.error || !legacy.data) {
        return { ...DEFAULT_VENUE_RENTAL_ORG_SETTINGS }
      }
      const defaultAmount = legacy.data.default_security_deposit_amount
      return {
        ...DEFAULT_VENUE_RENTAL_ORG_SETTINGS,
        securityDepositEnabled: Boolean(legacy.data.security_deposit_enabled),
        defaultSecurityDepositAmount:
          defaultAmount == null ? null : Number(defaultAmount) || 0,
      }
    }
    console.error(error)
    throw new Error("Failed to load venue rental settings")
  }

  if (!data) {
    return { ...DEFAULT_VENUE_RENTAL_ORG_SETTINGS }
  }

  const defaultAmount = data.default_security_deposit_amount
  const approvalMode =
    data.approval_mode === "auto_after_agreement"
      ? "auto_after_agreement"
      : "manual"

  return {
    securityDepositEnabled: Boolean(data.security_deposit_enabled),
    defaultSecurityDepositAmount:
      defaultAmount == null ? null : Number(defaultAmount) || 0,
    policiesDocumentUrl: (data.policies_document_url as string | null) || null,
    policiesDocumentName: (data.policies_document_name as string | null) || null,
    pricingGuideUrl: (data.pricing_guide_url as string | null) || null,
    pricingGuideName: (data.pricing_guide_name as string | null) || null,
    approvalMode,
  }
}

/** All rental add-ons for Venue Rentals → Settings → Add-ons (includes inactive). */
export async function getRentalAddonsForSettings(): Promise<
  RentalAddonSettingsItem[]
> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("rental_addons")
    .select("id, name, slug, description, default_price, is_active, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

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
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    defaultPrice: Number(row.default_price || 0),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
  }))
}

function mapVenueRentalDiscountPolicyRow(
  row: Record<string, unknown>
): VenueRentalDiscountPolicySettingsItem {
  const tagRel = row.discount_tags as
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null
  const tag = Array.isArray(tagRel) ? tagRel[0] : tagRel

  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: (row.description as string | null) ?? null,
    discountType: (row.discount_type as VenueRentalDiscountType) || "fixed",
    amount: Number(row.amount || 0),
    requiresMultiVenue: Boolean(row.requires_multi_venue),
    minVenues: Math.max(2, Number(row.min_venues || 2)),
    discountTagId: (row.discount_tag_id as string | null) ?? null,
    discountTagName: tag?.name ?? null,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
  }
}

/** All discount policies for Venue Rentals → Settings → Discounts. */
export async function getVenueRentalDiscountPoliciesForSettings(): Promise<
  VenueRentalDiscountPolicySettingsItem[]
> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("venue_rental_discount_policies")
    .select(
      "id, name, description, discount_type, amount, requires_multi_venue, min_venues, discount_tag_id, is_active, sort_order, discount_tags:discount_tag_id ( id, name )"
    )
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load rental discount policies")
  }

  return (data || []).map((row) =>
    mapVenueRentalDiscountPolicyRow(row as Record<string, unknown>)
  )
}

/** Active discount policies for quoting / Payments. */
export async function getActiveVenueRentalDiscountPolicies(
  organizationId?: string | null
): Promise<VenueRentalDiscountPolicyRule[]> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await resolveOrganizationId())
  if (!orgId) return []

  const { data, error } = await supabase
    .from("venue_rental_discount_policies")
    .select(
      "id, name, discount_type, amount, requires_multi_venue, min_venues, discount_tag_id, is_active"
    )
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    return []
  }

  return (data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name || ""),
    discountType: (row.discount_type as VenueRentalDiscountType) || "fixed",
    amount: Number(row.amount || 0),
    requiresMultiVenue: Boolean(row.requires_multi_venue),
    minVenues: Math.max(2, Number(row.min_venues || 2)),
    discountTagId: (row.discount_tag_id as string | null) ?? null,
    isActive: true,
  }))
}

async function loadDiscountTagIdsByContactId(
  organizationId: string,
  contactIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  if (!contactIds.length) return result

  const supabase = await createClient()
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, person_id")
    .eq("organization_id", organizationId)
    .in("id", contactIds)

  if (error || !contacts?.length) {
    return result
  }

  const personIds = Array.from(
    new Set(
      contacts
        .map((row) => row.person_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  )

  if (!personIds.length) return result

  const { data: tags } = await supabase
    .from("person_tags")
    .select("person_id, tag_id")
    .in("person_id", personIds)

  const tagsByPerson = new Map<string, string[]>()
  for (const row of tags || []) {
    const personId = row.person_id as string
    const list = tagsByPerson.get(personId) || []
    list.push(row.tag_id as string)
    tagsByPerson.set(personId, list)
  }

  for (const contact of contacts) {
    const personId = contact.person_id as string | null
    result.set(
      contact.id as string,
      personId ? tagsByPerson.get(personId) || [] : []
    )
  }

  return result
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

  const programBlocksByVenue = new Map<string, ConflictCheckReservation[]>()
  await Promise.all(
    Array.from(venueIds).map(async (venueId) => {
      const blocks = await getProgramBlockingReservationsForVenue(
        organizationId,
        venueId,
        rangeStart,
        rangeEnd
      )
      programBlocksByVenue.set(venueId, blocks)
    })
  )

  for (const [rentalId, reservations] of reservationsByRental) {
    let hasConflict = false

    for (const reservation of reservations) {
      const overlapsStored = blockingRows.some((row) => {
        if (row.source_id === reservation.id) return false
        if (row.venue_id !== reservation.venue_id) return false
        return rangesOverlap(
          new Date(reservation.start_at),
          new Date(reservation.end_at),
          new Date(row.start_at as string),
          new Date(row.end_at as string)
        )
      })

      if (overlapsStored) {
        hasConflict = true
        break
      }

      const programBlocks = programBlocksByVenue.get(reservation.venue_id) || []
      const overlapsProgram = programBlocks.some((block) =>
        rangesOverlap(
          new Date(reservation.start_at),
          new Date(reservation.end_at),
          new Date(block.startAt),
          new Date(block.endAt)
        )
      )

      if (overlapsProgram) {
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
  policies_sent_at: string | null
  policies_agreed_at: string | null
  policies_document_url_snapshot: string | null
  pricing_guide_url_snapshot: string | null
}

const VENUE_RENTAL_LIST_BASE_SELECT =
  "id, status, notes, expected_attendance, customer_user_id, hold_expires_at, created_at, approved_at, venue_rental_event_type_id"

const VENUE_RENTAL_LIST_POLICY_SELECT =
  `${VENUE_RENTAL_LIST_BASE_SELECT}, policies_sent_at, policies_agreed_at, policies_document_url_snapshot, pricing_guide_url_snapshot`

function withEmptyPolicyFields<T extends object>(
  row: T
): T & {
  policies_sent_at: null
  policies_agreed_at: null
  policies_document_url_snapshot: null
  pricing_guide_url_snapshot: null
} {
  return {
    ...row,
    policies_sent_at: null,
    policies_agreed_at: null,
    policies_document_url_snapshot: null,
    pricing_guide_url_snapshot: null,
  }
}

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

  const withPolicySelect = `${VENUE_RENTAL_LIST_POLICY_SELECT}, billing_contact_id`
  const { data: withPolicyData, error: withPolicyError } =
    await runQuery(withPolicySelect)

  if (!withPolicyError) {
    return (withPolicyData || []) as VenueRentalListRow[]
  }

  if (withPolicyError.code === "42P01") {
    return []
  }

  // Pre-migration 221: retry without policy columns.
  if (
    isMissingDbColumnError(withPolicyError, "policies_sent_at") ||
    isMissingDbColumnError(withPolicyError, "policies_agreed_at")
  ) {
    const withBillingSelect = `${VENUE_RENTAL_LIST_BASE_SELECT}, billing_contact_id`
    const { data: withBillingData, error: withBillingError } =
      await runQuery(withBillingSelect)

    if (!withBillingError) {
      return ((withBillingData || []) as Omit<
        VenueRentalListRow,
        | "policies_sent_at"
        | "policies_agreed_at"
        | "policies_document_url_snapshot"
        | "pricing_guide_url_snapshot"
      >[]).map((row) => withEmptyPolicyFields(row))
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

      return (
        (fallbackData || []) as Omit<
          VenueRentalListRow,
          | "billing_contact_id"
          | "policies_sent_at"
          | "policies_agreed_at"
          | "policies_document_url_snapshot"
          | "pricing_guide_url_snapshot"
        >[]
      ).map((row) =>
        withEmptyPolicyFields({
          ...row,
          billing_contact_id: null,
        })
      )
    }

    console.error(withBillingError)
    throw new Error("Failed to load venue rentals")
  }

  if (isMissingDbColumnError(withPolicyError, "billing_contact_id")) {
    const { data: fallbackData, error: fallbackError } = await runQuery(
      VENUE_RENTAL_LIST_POLICY_SELECT
    )

    if (fallbackError) {
      if (fallbackError.code === "42P01") {
        return []
      }
      console.error(fallbackError)
      throw new Error("Failed to load venue rentals")
    }

    return (
      (fallbackData || []) as Omit<VenueRentalListRow, "billing_contact_id">[]
    ).map((row) => ({
      ...row,
      billing_contact_id: null,
    }))
  }

  console.error(withPolicyError)
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

  const [reservationsResult, addonsResult, profilesResult, eventTypesResult, billingContactMap, linkedContactMap, paymentsResult] =
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
      supabase
        .from("rental_payments")
        .select("venue_rental_id, status")
        .eq("organization_id", organizationId)
        .in("venue_rental_id", rentalIds),
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

  const paidRentals = new Set<string>()
  for (const payment of paymentsResult.data || []) {
    if (isVenueRentalPaymentReceivedStatus(String(payment.status || ""))) {
      paidRentals.add(payment.venue_rental_id as string)
    }
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
      eventTypeId: rental.venue_rental_event_type_id,
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
      hasReceivedPayment: paidRentals.has(rental.id),
      policiesSentAt: rental.policies_sent_at ?? null,
      policiesAgreedAt: rental.policies_agreed_at ?? null,
      policiesDocumentUrlSnapshot: rental.policies_document_url_snapshot ?? null,
      pricingGuideUrlSnapshot: rental.pricing_guide_url_snapshot ?? null,
    })
  }

  rows.sort((a, b) => {
    const aStart = earliestQueueSpaceStart(a.spaces)
    const bStart = earliestQueueSpaceStart(b.spaces)
    return aStart - bStart
  })

  return rows
}

function earliestQueueSpaceStart(
  spaces: { startAt: string }[]
): number {
  if (spaces.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  return Math.min(...spaces.map((space) => new Date(space.startAt).getTime()))
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
    /** Newly received requests (not yet marked Pending / Approved). */
    awaitingApprovalCount: rows.filter(
      (row) => row.status === VENUE_RENTAL_STATUSES.submitted
    ).length,
    /** Approved — deposit still outstanding. */
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

function legacyPaymentBalanceFromStatus(
  status: VenueRentalPaymentReportRow["paymentStatus"]
): VenueRentalPaymentReportRow["paymentBalance"] {
  switch (status) {
    case "paid":
    case "complimentary":
    case "refunded":
      return "paid"
    case "partial":
    case "overdue":
    case "refund_due":
      return "partial"
    case "unpaid":
      return "unpaid"
    default:
      return "no_payments"
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
  const venueIds = Array.from(
    new Set(queueRows.flatMap((row) => row.spaces.map((space) => space.venueId)))
  )

  const [paymentsResult, venuesResult, dayPricingResult, discountPolicies, tagIdsByContact] =
    await Promise.all([
    supabase
      .from("rental_payments")
      .select("*")
      .eq("organization_id", organizationId)
      .in("venue_rental_id", rentalIds),
    venueIds.length
      ? supabase
          .from("venues")
          .select("id, hourly_rate, peak_hourly_rate, base_price, peak_flat_price")
          .eq("organization_id", organizationId)
          .in("id", venueIds)
      : Promise.resolve({ data: [], error: null }),
    venueIds.length
      ? supabase
          .from("rental_space_pricing")
          .select("venue_id, day_of_week, hourly_price, flat_price, is_active")
          .eq("organization_id", organizationId)
          .in("venue_id", venueIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    getActiveVenueRentalDiscountPolicies(organizationId),
    loadDiscountTagIdsByContactId(
      organizationId,
      Array.from(
        new Set(
          queueRows
            .map((row) => row.billingContactId)
            .filter((id): id is string => Boolean(id))
        )
      )
    ),
  ])

  if (paymentsResult.error && paymentsResult.error.code !== "42P01") {
    console.error(paymentsResult.error)
    throw new Error("Failed to load rental payments")
  }

  const rates = buildVenueRateLookup({
    venues: (venuesResult.data || []) as Array<{
      id: string
      hourly_rate?: number | null
      peak_hourly_rate?: number | null
      base_price?: number | null
      peak_flat_price?: number | null
    }>,
    dayPricing: (dayPricingResult.data || []) as Array<{
      venue_id: string
      day_of_week: number
      hourly_price?: number | null
      flat_price?: number | null
      is_active?: boolean | null
    }>,
  })

  const paymentsByRental = new Map<string, RentalPaymentRecord[]>()
  for (const payment of (paymentsResult.data || []) as RentalPaymentRecord[]) {
    const list = paymentsByRental.get(payment.venue_rental_id) || []
    list.push(payment)
    paymentsByRental.set(payment.venue_rental_id, list)
  }

  return queueRows.map((row) => {
    const payments = paymentsByRental.get(row.id) || []
    const summary = summarizeVenueRentalPaymentLedger(payments)
    // Space + date fee only for now; add-ons stay $0 until staff updates them.
    const quote = computeVenueRentalQuotedCharges(row.spaces, [], rates)
    const contactTagIds = row.billingContactId
      ? tagIdsByContact.get(row.billingContactId) || []
      : []
    const discounted = applyVenueRentalDiscountPolicies({
      spaceFee: quote.spaceFee,
      venueCount: row.spaces.length,
      contactTagIds,
      policies: discountPolicies,
    })
    const totalCharges = discounted.totalCharges
    const balanceDue = Math.max(
      0,
      totalCharges - summary.amountReceived - summary.appliedCredits
    )
    const unappliedCredit = Math.max(
      0,
      summary.amountReceived + summary.appliedCredits - totalCharges
    )
    const primary = row.spaces[0]
    const spaceName = primary?.venueName || "—"
    const spaceLabel = primary
      ? formatVenueRentalSpaceLine(primary.venueName, primary.startAt, primary.endAt)
      : "—"
    const paymentStatus = deriveVenueRentalPaymentLedgerStatus({
      rentalStatus: row.status,
      totalCharges,
      amountReceived: summary.amountReceived,
      balanceDue,
      unappliedCredit,
      refundableSecurity: summary.refundableSecurity,
      refundedAmount: summary.refundedAmount,
      paymentDueAt: summary.paymentDueAt,
    })
    const nextAction = deriveVenueRentalStaffNextAction({
      rentalId: row.id,
      paymentStatus,
      balanceDue,
    })
    const hasFinancialActivity = rentalHasFinancialActivity({
      rentalStatus: row.status,
      totalCharges,
      amountReceived: summary.amountReceived,
      refundedAmount: summary.refundedAmount,
      balanceDue,
      paymentStatus,
      paymentCount: payments.length,
    })

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
      spaceName,
      venueIds: row.spaces.map((space) => space.venueId),
      eventStartAt: primary?.startAt ?? null,
      eventEndAt: primary?.endAt ?? null,
      totalCharges,
      quotedSpaceFee: quote.spaceFee,
      quotedAddonFees: 0,
      totalFee: totalCharges,
      depositAmount: summary.depositAmount,
      depositReceived: summary.depositReceived,
      securityAmount: summary.securityAmount,
      securityReceived: summary.securityReceived,
      remainingAmount: summary.remainingAmount,
      remainingReceived: summary.remainingReceived,
      remainingDue: summary.remainingDue,
      amountReceived: summary.amountReceived,
      refundedAmount: summary.refundedAmount,
      appliedCredits: summary.appliedCredits,
      unappliedCredit,
      refundableSecurity: summary.refundableSecurity,
      balanceDue,
      paymentDueAt: summary.paymentDueAt,
      paymentStatus,
      nextActionLabel: nextAction.label,
      nextActionKey: nextAction.key,
      nextActionHref: nextAction.href,
      hasFinancialActivity,
      hasOnlinePayment: summary.hasOnlinePayment,
      hasManualPayment: summary.hasManualPayment,
      paymentBalance: legacyPaymentBalanceFromStatus(paymentStatus),
      unpaidPaymentIds: summary.unpaidPaymentIds,
      payments: payments
        .filter((payment) => payment.payment_type !== RENTAL_PAYMENT_TYPES.refund)
        .map((payment) => ({
          id: payment.id,
          paymentType: payment.payment_type,
          status: payment.status,
          amount: Number(payment.amount) || 0,
          notes: payment.notes,
          paidAt: payment.paid_at,
          dueAt: payment.due_at,
          paymentMethod: payment.payment_method ?? null,
          referenceNumber: payment.reference_number ?? null,
          recordedBy: payment.recorded_by ?? null,
          receiptUrl: payment.receipt_url ?? null,
          stripePaymentIntentId: payment.stripe_payment_intent_id,
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

/** Quoted space fee (− optional Settings discounts); add-ons $0 for now. */
export async function getVenueRentalQuotedCharges(
  rental: Pick<VenueRentalQueueRow, "spaces" | "addons" | "billingContactId">
): Promise<{
  spaceFee: number
  addonFees: number
  totalCharges: number
  hours: number
  discountAmount: number
}> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) {
    return {
      spaceFee: 0,
      addonFees: 0,
      totalCharges: 0,
      hours: 0,
      discountAmount: 0,
    }
  }

  const venueIds = Array.from(new Set(rental.spaces.map((space) => space.venueId)))
  if (!venueIds.length) {
    return {
      spaceFee: 0,
      addonFees: 0,
      totalCharges: 0,
      hours: 0,
      discountAmount: 0,
    }
  }

  const [venuesResult, dayPricingResult, discountPolicies, tagIdsByContact] =
    await Promise.all([
      supabase
        .from("venues")
        .select("id, hourly_rate, peak_hourly_rate, base_price, peak_flat_price")
        .eq("organization_id", organizationId)
        .in("id", venueIds),
      supabase
        .from("rental_space_pricing")
        .select("venue_id, day_of_week, hourly_price, flat_price, is_active")
        .eq("organization_id", organizationId)
        .in("venue_id", venueIds)
        .eq("is_active", true),
      getActiveVenueRentalDiscountPolicies(organizationId),
      loadDiscountTagIdsByContactId(
        organizationId,
        rental.billingContactId ? [rental.billingContactId] : []
      ),
    ])

  const rates = buildVenueRateLookup({
    venues: (venuesResult.data || []) as Array<{
      id: string
      hourly_rate?: number | null
      peak_hourly_rate?: number | null
      base_price?: number | null
      peak_flat_price?: number | null
    }>,
    dayPricing: (dayPricingResult.data || []) as Array<{
      venue_id: string
      day_of_week: number
      hourly_price?: number | null
      flat_price?: number | null
      is_active?: boolean | null
    }>,
  })

  const quote = computeVenueRentalQuotedCharges(rental.spaces, [], rates)
  const contactTagIds = rental.billingContactId
    ? tagIdsByContact.get(rental.billingContactId) || []
    : []
  const discounted = applyVenueRentalDiscountPolicies({
    spaceFee: quote.spaceFee,
    venueCount: rental.spaces.length,
    contactTagIds,
    policies: discountPolicies,
  })

  return {
    spaceFee: discounted.spaceFee,
    addonFees: 0,
    totalCharges: discounted.totalCharges,
    hours: quote.hours,
    discountAmount: discounted.discountAmount,
  }
}
