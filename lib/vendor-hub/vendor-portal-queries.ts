import { createClient } from "@/lib/supabase/server"
import { resolveCustomerPortalActor } from "@/lib/auth/customer-portal-session"
import { linkVendorContactsForCurrentUser } from "@/lib/vendor-hub/link-vendor-contact-auth"
import type {
  MyVendorBazaarSummary,
  VendorBazaarActivityRow,
} from "@/lib/vendor-hub/vendor-portal-types"

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  const message = (error?.message || "").toLowerCase()
  return error?.code === "42P01" || message.includes("does not exist")
}

export async function getMyVendorBazaarActivity(): Promise<MyVendorBazaarSummary> {
  const actor = await resolveCustomerPortalActor()

  const empty: MyVendorBazaarSummary = {
    linkedContactCount: 0,
    organizationCount: 0,
    upcomingEventCount: 0,
    rows: [],
    paymentDue: [],
    tablesAvailable: true,
  }

  if (!actor) {
    return empty
  }

  const { userId, supabase, session } = actor

  if (!session.isSupportSession) {
    await linkVendorContactsForCurrentUser(supabase)
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, organization_id, full_name, organization_name, company_name")
    .eq("auth_user_id", userId)

  if (contactsError) {
    console.error("getMyVendorBazaarActivity contacts:", contactsError)
    return empty
  }

  if (!contacts?.length) {
    return empty
  }

  const contactIds = contacts.map((row) => row.id as string)
  const organizationIds = [...new Set(contacts.map((row) => row.organization_id as string))]

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds)

  const orgNameById = new Map(
    (organizations ?? []).map((row) => [row.id as string, row.name as string])
  )

  const rows: VendorBazaarActivityRow[] = []

  const orgNameForContact = (contactId: string, organizationId: string) => {
    const contact = contacts.find((row) => row.id === contactId)
    return (
      orgNameById.get(organizationId) ??
      contact?.organization_name ??
      contact?.company_name ??
      "Community organization"
    )
  }

  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .select(
      "id, organization_id, contact_id, status, submitted_at, created_at, form_data"
    )
    .in("contact_id", contactIds)
    .eq("module_owner", "vendor_hub")
    .eq("application_type", "vendor")
    .order("created_at", { ascending: false })
    .limit(200)

  if (applicationsError && !isMissingRelationError(applicationsError)) {
    console.error("getMyVendorBazaarActivity applications:", applicationsError)
  }

  const eventIds = new Set<string>()

  for (const app of applications ?? []) {
    const formData = (app.form_data as Record<string, unknown>) ?? {}
    const eventId =
      (typeof formData.vendor_hub_event_id === "string" && formData.vendor_hub_event_id) ||
      (typeof formData.bazaar_event_id === "string" && formData.bazaar_event_id) ||
      null

    if (eventId) {
      eventIds.add(eventId)
    }

    rows.push({
      id: `app-${app.id}`,
      organizationId: app.organization_id as string,
      organizationName: orgNameForContact(app.contact_id as string, app.organization_id as string),
      contactId: app.contact_id as string,
      eventId,
      eventName: eventId ? "Bazaar event" : "Vendor onboarding",
      eventDate: null,
      activityType: "application",
      status: app.status as string,
      amount: null,
      boothNumber: null,
      occurredAt: (app.submitted_at as string | null) ?? (app.created_at as string),
    })
  }

  const participantResult = await supabase
    .from("vendor_hub_participant_status")
    .select(
      "id, organization_id, contact_id, vendor_hub_event_id, lifecycle_status, created_at, updated_at"
    )
    .in("contact_id", contactIds)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (participantResult.error && !isMissingRelationError(participantResult.error)) {
    console.error("getMyVendorBazaarActivity participant:", participantResult.error)
  } else {
    for (const row of participantResult.data ?? []) {
      const eventId = row.vendor_hub_event_id as string
      eventIds.add(eventId)
      rows.push({
        id: `part-${row.id}`,
        organizationId: row.organization_id as string,
        organizationName: orgNameForContact(row.contact_id as string, row.organization_id as string),
        contactId: row.contact_id as string,
        eventId,
        eventName: "Bazaar event",
        eventDate: null,
        activityType: "participation",
        status: row.lifecycle_status as string,
        amount: null,
        boothNumber: null,
        occurredAt: (row.updated_at as string | null) ?? (row.created_at as string),
      })
    }
  }

  const assignmentsResult = await supabase
    .from("vendor_hub_booth_assignments")
    .select("id, event_id, contact_id, booth_id, fee_amount, status, created_at")
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false })
    .limit(200)

  const boothIds = new Set<string>()
  if (!assignmentsResult.error) {
    for (const row of assignmentsResult.data ?? []) {
      if (row.event_id) eventIds.add(row.event_id as string)
      if (row.booth_id) boothIds.add(row.booth_id as string)
    }
  }

  const [eventsResult, boothsResult] = await Promise.all([
    eventIds.size > 0
      ? supabase
          .from("vendor_hub_events")
          .select("id, name, event_date, organization_id")
          .in("id", [...eventIds])
      : Promise.resolve({ data: [], error: null }),
    boothIds.size > 0
      ? supabase.from("vendor_hub_booths").select("id, number").in("id", [...boothIds])
      : Promise.resolve({ data: [], error: null }),
  ])

  const eventById = new Map(
    (eventsResult.data ?? []).map((event) => [event.id as string, event])
  )
  const boothNumberById = new Map(
    (boothsResult.data ?? []).map((booth) => [booth.id as string, booth.number as string])
  )

  for (const row of rows) {
    if (!row.eventId) continue
    const event = eventById.get(row.eventId)
    if (!event) continue
    row.eventName = (event.name as string) ?? row.eventName
    row.eventDate = (event.event_date as string | null) ?? null
    if (!row.organizationId && event.organization_id) {
      row.organizationId = event.organization_id as string
      row.organizationName = orgNameForContact(row.contactId, row.organizationId)
    }
  }

  if (!assignmentsResult.error) {
    for (const assignment of assignmentsResult.data ?? []) {
      const event = assignment.event_id ? eventById.get(assignment.event_id as string) : null
      const organizationId =
        (event?.organization_id as string | undefined) ??
        contacts.find((c) => c.id === assignment.contact_id)?.organization_id ??
        ""

      rows.push({
        id: `assign-${assignment.id}`,
        organizationId,
        organizationName: orgNameForContact(
          assignment.contact_id as string,
          organizationId as string
        ),
        contactId: assignment.contact_id as string,
        eventId: (assignment.event_id as string | null) ?? null,
        eventName: event?.name ? (event.name as string) : "Bazaar event",
        eventDate: (event?.event_date as string | null) ?? null,
        activityType: "booth_assignment",
        status: assignment.status as string | null,
        amount: assignment.fee_amount ? Number(assignment.fee_amount) : null,
        boothNumber: assignment.booth_id
          ? boothNumberById.get(assignment.booth_id as string) ?? null
          : null,
        occurredAt: assignment.created_at as string,
      })
    }
  }

  const paymentsResult = await supabase
    .from("vendor_hub_payments")
    .select("id, event_id, contact_id, amount, payment_type, payment_date, created_at")
    .in("contact_id", contactIds)
    .order("payment_date", { ascending: false })
    .limit(200)

  if (!paymentsResult.error) {
    for (const payment of paymentsResult.data ?? []) {
      const event = payment.event_id ? eventById.get(payment.event_id as string) : null
      const contact = contacts.find((row) => row.id === payment.contact_id)
      const organizationId = (contact?.organization_id as string | undefined) ?? ""

      rows.push({
        id: `pay-${payment.id}`,
        organizationId,
        organizationName: orgNameForContact(payment.contact_id as string, organizationId),
        contactId: payment.contact_id as string,
        eventId: (payment.event_id as string | null) ?? null,
        eventName: event?.name ? (event.name as string) : "Bazaar event",
        eventDate: (event?.event_date as string | null) ?? null,
        activityType: "payment",
        status: payment.payment_type as string | null,
        amount: Number(payment.amount ?? 0),
        boothNumber: null,
        occurredAt:
          (payment.payment_date as string | null) ?? (payment.created_at as string | null),
      })
    }
  }

  rows.sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0
    return bTime - aTime
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingEventCount = new Set(
    rows
      .filter((row) => row.eventDate && new Date(row.eventDate) >= today)
      .map((row) => row.eventId)
      .filter(Boolean)
  ).size

  const tablesAvailable = !(
    applicationsError &&
    participantResult.error &&
    assignmentsResult.error &&
    paymentsResult.error
  )

  return {
    linkedContactCount: contacts.length,
    organizationCount: organizationIds.length,
    upcomingEventCount,
    rows,
    paymentDue: [],
    tablesAvailable,
  }
}
