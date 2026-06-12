import { createClient } from "@/lib/supabase/server"
import { countPendingEventEvaluations } from "@/lib/vendor-hub/vendor-evaluation-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type {
  VendorHubDashboardMetrics,
  VendorHubEventWithInternal,
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

async function enrichEventsWithInternal(
  events: VendorHubEventWithInternal[]
): Promise<VendorHubEventWithInternal[]> {
  const internalEventIds = events
    .map((event) => event.internal_event_id)
    .filter((id): id is string => Boolean(id))

  if (internalEventIds.length === 0) {
    return events
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
    return events
  }

  const internalById = new Map((data || []).map((row) => [row.id, row]))

  return events.map((event) => ({
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

  const assignmentsResult = await supabase
    .from("vendor_hub_booth_assignments")
    .select("id, fee_amount, status")
    .eq("event_id", eventId)

  const assignments = assignmentsResult.data || []
  const boothsAssigned = assignments.filter(
    (row) => row.status === "assigned" || row.status === "confirmed"
  ).length

  const paymentsResult = await supabase
    .from("vendor_hub_payments")
    .select("amount")
    .eq("event_id", eventId)

  const revenueCollected = (paymentsResult.data || []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  )

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

    const approvedResult = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("module_owner", "vendor_hub")
      .eq("application_type", "vendor")
      .eq("status", "approved")

    approvedVendors = approvedResult.count ?? 0
  }

  const vendorsParticipated = assignments.filter((row) =>
    ["reserved", "confirmed", "assigned", "checked_in"].includes(row.status as string)
  ).length

  let vendorsPendingEvaluation = 0
  if (organizationId) {
    vendorsPendingEvaluation = await countPendingEventEvaluations(eventId, organizationId)
  }

  return {
    applicationsPendingReview,
    approvedVendors,
    boothsTotal,
    boothsAssigned,
    revenueCollected,
    outstandingBalance: Math.max(0, outstandingBalance),
    vendorsMissingDocuments: 0,
    vendorsMissingPayment: 0,
    vendorsPendingEvaluation,
    vendorsParticipated,
  }
}
