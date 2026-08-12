import { createClient } from "@/lib/supabase/server"
import { countPendingEventEvaluations } from "@/lib/vendor-hub/vendor-evaluation-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  countActiveVendorNetworkContacts,
  countVendorNetworkContacts,
} from "@/lib/vendor-hub/vendor-network-sync-actions"

import type {
  VendorHubDashboardMetrics,
  VendorHubEventWithInternal,
  VendorHubOrgDashboardData,
  VendorHubOrganizerContact,
} from "./vendor-hub-types"

function logSupabaseError(
  context: string,
  error: { message?: string; code?: string; details?: string; hint?: string }
) {
  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  })
}

async function enrichEventsWithVenues(
  events: VendorHubEventWithInternal[]
): Promise<VendorHubEventWithInternal[]> {
  const venueIds = [
    ...new Set(
      events
        .map((event) => event.venue_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  if (venueIds.length === 0) {
    return events.map((event) => ({ ...event, venue_name: null }))
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  let query = supabase.from("venues").select("id, name").in("id", venueIds)
  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const { data, error } = await query
  if (error) {
    logSupabaseError("enrichEventsWithVenues error:", error)
    return events.map((event) => ({ ...event, venue_name: null }))
  }

  const nameById = new Map(
    (data || []).map((row) => [row.id as string, (row.name as string) || null])
  )

  return events.map((event) => ({
    ...event,
    venue_name: event.venue_id ? nameById.get(event.venue_id) ?? null : null,
  }))
}

async function enrichEventsWithOrganizerContacts(
  events: VendorHubEventWithInternal[]
): Promise<VendorHubEventWithInternal[]> {
  const contactIds = events
    .map((event) => event.organizer_contact_id)
    .filter((id): id is string => Boolean(id))

  if (contactIds.length === 0) {
    return events.map((event) => ({ ...event, organizer_contact: null }))
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  let query = supabase
    .from("contacts")
    .select("id, full_name, email, phone")
    .in("id", contactIds)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const { data, error } = await query

  if (error) {
    logSupabaseError("enrichEventsWithOrganizerContacts error:", error)
    return events.map((event) => ({ ...event, organizer_contact: null }))
  }

  const contactsById = new Map(
    (data || []).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        full_name: (row.full_name as string | null) ?? null,
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
      } satisfies VendorHubOrganizerContact,
    ])
  )

  return events.map((event) => ({
    ...event,
    organizer_contact: event.organizer_contact_id
      ? contactsById.get(event.organizer_contact_id) ?? null
      : null,
  }))
}

async function enrichEventsWithInternal(
  events: VendorHubEventWithInternal[]
): Promise<VendorHubEventWithInternal[]> {
  const withVenues = await enrichEventsWithVenues(events)
  const withContacts = await enrichEventsWithOrganizerContacts(withVenues)

  const internalEventIds = withContacts
    .map((event) => event.internal_event_id)
    .filter((id): id is string => Boolean(id))

  if (internalEventIds.length === 0) {
    return withContacts
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  let query = supabase
    .from("internal_events")
    .select("id, name, start_at, end_at, location_label, status")
    .in("id", internalEventIds)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const { data, error } = await query

  if (error) {
    logSupabaseError("enrichEventsWithInternal error:", error)
    return withContacts
  }

  const internalById = new Map((data || []).map((row) => [row.id, row]))

  return withContacts.map((event) => ({
    ...event,
    internal_event: event.internal_event_id
      ? internalById.get(event.internal_event_id) ?? null
      : null,
  }))
}

export async function getVendorHubEvents(): Promise<VendorHubEventWithInternal[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  const { data, error } = await supabase
    .from("vendor_hub_events")
    .select("*")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    logSupabaseError("getVendorHubEvents error:", error)
    return []
  }

  let events = (data || []) as VendorHubEventWithInternal[]

  if (organizationId && events.some((event) => "organization_id" in event && event.organization_id)) {
    events = events.filter(
      (event) => !event.organization_id || event.organization_id === organizationId
    )
  }

  return enrichEventsWithInternal(events)
}

export async function getVendorHubEventById(
  eventId: string
): Promise<VendorHubEventWithInternal | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  const { data, error } = await supabase
    .from("vendor_hub_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle()

  if (error) {
    logSupabaseError("getVendorHubEventById error:", error)
    return null
  }

  if (!data) {
    return null
  }

  if (
    organizationId &&
    data.organization_id &&
    data.organization_id !== organizationId
  ) {
    return null
  }

  const [enriched] = await enrichEventsWithInternal([data as VendorHubEventWithInternal])
  return enriched ?? null
}

export async function getVendorHubDashboardMetrics(
  eventId: string | null
): Promise<VendorHubDashboardMetrics> {
  const empty: VendorHubDashboardMetrics = {
    applicationsPendingReview: 0,
    approvedVendors: 0,
    boothsTotal: 0,
    boothsAssigned: 0,
    boothRegistrations: 0,
    revenueCollected: 0,
    outstandingBalance: 0,
    vendorsMissingDocuments: 0,
    vendorsMissingPayment: 0,
    vendorsPendingEvaluation: 0,
    vendorsParticipated: 0,
  }

  if (!eventId) {
    return empty
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  const eventResult = await supabase
    .from("vendor_hub_events")
    .select("total_booths")
    .eq("id", eventId)
    .maybeSingle()

  const boothsTotal = eventResult.data?.total_booths ?? 0

  const [assignmentsResult, participantsResult, paymentsResult] = await Promise.all([
    supabase
      .from("vendor_hub_booth_assignments")
      .select("id, contact_id, fee_amount, status")
      .eq("event_id", eventId),
    supabase
      .from("vendor_hub_participant_status")
      .select("contact_id, lifecycle_status")
      .eq("vendor_hub_event_id", eventId),
    supabase
      .from("vendor_hub_payments")
      .select("amount, payment_type, contact_id")
      .eq("event_id", eventId),
  ])

  const assignments = assignmentsResult.data || []
  const boothsAssigned = assignments.filter(
    (row) => row.status === "assigned" || row.status === "confirmed"
  ).length

  const registeredContactIds = new Set<string>()
  for (const row of participantsResult.data || []) {
    const contactId = row.contact_id as string | null
    const lifecycle = ((row.lifecycle_status as string | null) || "").toLowerCase()
    if (!contactId || lifecycle === "cancelled") continue
    registeredContactIds.add(contactId)
  }
  for (const row of assignments) {
    const contactId = row.contact_id as string | null
    const status = ((row.status as string | null) || "").toLowerCase()
    if (!contactId || status === "cancelled") continue
    registeredContactIds.add(contactId)
  }
  for (const row of paymentsResult.data || []) {
    const contactId = row.contact_id as string | null
    const paymentType = ((row.payment_type as string | null) || "").toLowerCase()
    if (!contactId || paymentType === "refund") continue
    registeredContactIds.add(contactId)
  }
  const boothRegistrations = registeredContactIds.size

  const revenueCollected = (paymentsResult.data || []).reduce((sum, row) => {
    const amount = Number(row.amount ?? 0)
    if (!Number.isFinite(amount)) return sum
    if (((row.payment_type as string | null) || "").toLowerCase() === "refund") {
      return sum - amount
    }
    return sum + amount
  }, 0)

  const outstandingBalance =
    assignments.reduce((sum, row) => sum + Number(row.fee_amount ?? 0), 0) -
    revenueCollected

  let applicationsPendingReview = 0
  let approvedVendors = 0

  if (organizationId) {
    const pendingResult = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("module_owner", "vendor_hub")
      .eq("application_type", "vendor")
      .in("status", ["submitted", "pending_review"])

    applicationsPendingReview = pendingResult.count ?? 0
    approvedVendors = await countVendorNetworkContacts(organizationId)
  }

  const vendorsParticipated = boothRegistrations

  let vendorsPendingEvaluation = 0
  if (organizationId) {
    vendorsPendingEvaluation = await countPendingEventEvaluations(eventId, organizationId)
  }

  return {
    applicationsPendingReview,
    approvedVendors,
    boothsTotal,
    boothsAssigned,
    boothRegistrations,
    revenueCollected: Math.max(0, revenueCollected),
    outstandingBalance: Math.max(0, outstandingBalance),
    vendorsMissingDocuments: 0,
    vendorsMissingPayment: 0,
    vendorsPendingEvaluation,
    vendorsParticipated,
  }
}

function todayIsoDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Org-level Vendor Hub dashboard: network KPIs + upcoming events. */
export async function getVendorHubOrgDashboard(): Promise<VendorHubOrgDashboardData> {
  const empty: VendorHubOrgDashboardData = {
    metrics: {
      onboardingPending: 0,
      activeVendors: 0,
      revenueCollected: 0,
      outstandingBalance: 0,
    },
    upcomingEvents: [],
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return empty

  const supabase = await createClient()
  const events = await getVendorHubEvents()
  const eventIds = events.map((event) => event.id)
  const today = todayIsoDate()

  const upcomingEvents = events
    .filter((event) => {
      const date = event.event_date
      if (!date) return false
      return date >= today
    })
    .sort((a, b) => {
      const aDate = a.event_date || ""
      const bDate = b.event_date || ""
      if (aDate !== bDate) return aDate.localeCompare(bDate)
      return (a.name || "").localeCompare(b.name || "")
    })

  const pendingResult = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("module_owner", "vendor_hub")
    .eq("application_type", "vendor")
    .in("status", ["submitted", "pending_review"])

  const activeVendors = await countActiveVendorNetworkContacts(organizationId)

  let revenueCollected = 0
  let feeTotal = 0

  if (eventIds.length > 0) {
    const [{ data: payments }, { data: assignments }] = await Promise.all([
      supabase
        .from("vendor_hub_payments")
        .select("amount, payment_type")
        .in("event_id", eventIds),
      supabase
        .from("vendor_hub_booth_assignments")
        .select("fee_amount")
        .in("event_id", eventIds),
    ])

    for (const payment of payments || []) {
      const amount = Number(payment.amount ?? 0)
      if (!Number.isFinite(amount)) continue
      if (((payment.payment_type as string | null) || "").toLowerCase() === "refund") {
        revenueCollected -= amount
      } else {
        revenueCollected += amount
      }
    }

    feeTotal = (assignments || []).reduce((sum, row) => {
      const fee = Number(row.fee_amount ?? 0)
      return sum + (Number.isFinite(fee) ? fee : 0)
    }, 0)
  }

  return {
    metrics: {
      onboardingPending: pendingResult.count ?? 0,
      activeVendors,
      revenueCollected: Math.max(0, revenueCollected),
      outstandingBalance: Math.max(0, feeTotal - revenueCollected),
    },
    upcomingEvents,
  }
}
