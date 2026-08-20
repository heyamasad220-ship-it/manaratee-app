import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type {
  ChildcareEventSummary,
  ChildcareRegistration,
  ChildcareRegistrationStats,
  ChildcareRegistrationStatus,
} from "@/lib/child-care/childcare-registration-types"

function mapRegistration(row: Record<string, unknown>): ChildcareRegistration {
  const event = row.childcare_event as Record<string, unknown> | null

  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    childcare_event_id: row.childcare_event_id as string,
    child_name: row.child_name as string,
    child_age: (row.child_age as number | null) ?? null,
    parent_name: (row.parent_name as string | null) ?? null,
    parent_email: (row.parent_email as string | null) ?? null,
    parent_phone: (row.parent_phone as string | null) ?? null,
    status: row.status as ChildcareRegistrationStatus,
    allergies: (row.allergies as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    checked_in_at: (row.checked_in_at as string | null) ?? null,
    checked_out_at: (row.checked_out_at as string | null) ?? null,
    pickup_authorization: (row.pickup_authorization as string | null) ?? null,
    waiverSignedAt: (row.waiver_signed_at as string | null) ?? null,
    waiverSignedBy: (row.waiver_signed_by as string | null) ?? null,
    photoConsent:
      typeof row.photo_consent === "boolean" ? (row.photo_consent as boolean) : null,
    event_name: (event?.name as string) || "Event",
    event_date: (event?.event_date as string) || "",
    start_time: (event?.start_time as string | null) ?? null,
    end_time: (event?.end_time as string | null) ?? null,
  }
}

const REGISTRATION_SELECT = `
  id,
  organization_id,
  childcare_event_id,
  child_name,
  child_age,
  parent_name,
  parent_email,
  parent_phone,
  status,
  allergies,
  notes,
  checked_in_at,
  checked_out_at,
  pickup_authorization,
  waiver_signed_at,
  waiver_signed_by,
  photo_consent,
  childcare_event:childcare_event_id (
    name,
    event_date,
    start_time,
    end_time
  )
`

const REGISTRATION_SELECT_FALLBACK = `
  id,
  organization_id,
  childcare_event_id,
  child_name,
  child_age,
  parent_name,
  parent_email,
  parent_phone,
  status,
  allergies,
  notes,
  checked_in_at,
  checked_out_at,
  pickup_authorization,
  childcare_event:childcare_event_id (
    name,
    event_date,
    start_time,
    end_time
  )
`

export async function getChildcareRegistrationsBundle(
  organizationId?: string
): Promise<{
  events: ChildcareEventSummary[]
  registrations: ChildcareRegistration[]
  stats: ChildcareRegistrationStats
}> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())

  if (!orgId) {
    return {
      events: [],
      registrations: [],
      stats: { total: 0, confirmed: 0, waitlisted: 0, pending: 0 },
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const [eventsResult, registrationsResult] = await Promise.all([
    supabase
      .from("childcare_events")
      .select(
        "id, organization_id, name, event_date, start_time, end_time, capacity, notes, is_active, assigned_provider_contact_id, source_type, source_id"
      )
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("childcare_registrations")
      .select(REGISTRATION_SELECT)
      .eq("organization_id", orgId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ])

  if (eventsResult.error) {
    console.error("getChildcareRegistrationsBundle events:", eventsResult.error.message)
    throw new Error("Failed to load childcare events")
  }

  let registrationRows: unknown[] | null = registrationsResult.data
  if (registrationsResult.error?.code === "42703") {
    const fallback = await supabase
      .from("childcare_registrations")
      .select(REGISTRATION_SELECT_FALLBACK)
      .eq("organization_id", orgId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
    if (fallback.error) {
      console.error(
        "getChildcareRegistrationsBundle registrations:",
        fallback.error.message
      )
      throw new Error("Failed to load childcare registrations")
    }
    registrationRows = fallback.data
  } else if (registrationsResult.error) {
    console.error(
      "getChildcareRegistrationsBundle registrations:",
      registrationsResult.error.message
    )
    throw new Error("Failed to load childcare registrations")
  }

  const registrations = (registrationRows || []).map((row) =>
    mapRegistration(row as Record<string, unknown>)
  )

  const countByEvent = registrations.reduce<Record<string, number>>((acc, reg) => {
    if (reg.status === "confirmed" || reg.status === "pending" || reg.status === "waitlisted") {
      acc[reg.childcare_event_id] = (acc[reg.childcare_event_id] || 0) + 1
    }
    return acc
  }, {})

  const providerContactIds = Array.from(
    new Set(
      (eventsResult.data || [])
        .map((row) => row.assigned_provider_contact_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  )

  const providerNameByContactId = new Map<string, string>()
  if (providerContactIds.length > 0) {
    const { data: providerContacts } = await supabase
      .from("contacts")
      .select("id, full_name")
      .eq("organization_id", orgId)
      .in("id", providerContactIds)

    for (const contact of providerContacts || []) {
      providerNameByContactId.set(
        contact.id as string,
        (contact.full_name as string) || "Unnamed provider"
      )
    }
  }

  const internalEventIds = Array.from(
    new Set(
      (eventsResult.data || [])
        .filter((row) => (row.source_type as string | null) === "internal_event")
        .map((row) => row.source_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  )

  const departmentByInternalEventId = new Map<
    string,
    { id: string; name: string }
  >()
  if (internalEventIds.length > 0) {
    const { data: internalEvents } = await supabase
      .from("internal_events")
      .select("id, department_id, departments:department_id ( id, name )")
      .eq("organization_id", orgId)
      .in("id", internalEventIds)

    for (const row of internalEvents || []) {
      const dept = row.departments as
        | { id?: string; name?: string | null }
        | { id?: string; name?: string | null }[]
        | null
      const deptRow = Array.isArray(dept) ? dept[0] : dept
      const departmentId =
        (deptRow?.id as string | undefined) ||
        (row.department_id as string | null) ||
        null
      if (!departmentId) continue
      departmentByInternalEventId.set(row.id as string, {
        id: departmentId,
        name: deptRow?.name?.trim() || "Department",
      })
    }
  }

  const events: ChildcareEventSummary[] = (eventsResult.data || []).map((row) => {
    const assignedProviderContactId =
      (row.assigned_provider_contact_id as string | null) ?? null
    const sourceType = (row.source_type as string | null) || "standalone"
    const sourceId = (row.source_id as string | null) || null
    const linked =
      sourceType === "internal_event" && sourceId
        ? departmentByInternalEventId.get(sourceId) || null
        : null

    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      name: row.name as string,
      event_date: row.event_date as string,
      start_time: (row.start_time as string | null) ?? null,
      end_time: (row.end_time as string | null) ?? null,
      capacity: Number(row.capacity) || 0,
      notes: (row.notes as string | null) ?? null,
      is_active: Boolean(row.is_active),
      assigned_provider_contact_id: assignedProviderContactId,
      source_type: sourceType,
      source_id: sourceId,
      registered_count: countByEvent[row.id as string] ?? 0,
      assigned_provider_name: assignedProviderContactId
        ? providerNameByContactId.get(assignedProviderContactId) ?? "Assigned provider"
        : null,
      linked_department_id: linked?.id ?? null,
      linked_department_name: linked?.name ?? null,
    }
  })

  const stats: ChildcareRegistrationStats = {
    total: registrations.length,
    confirmed: registrations.filter((r) => r.status === "confirmed").length,
    waitlisted: registrations.filter((r) => r.status === "waitlisted").length,
    pending: registrations.filter((r) => r.status === "pending").length,
  }

  return { events, registrations, stats }
}

export async function getChildcareForInternalEvent(internalEventId: string): Promise<{
  childcareEvent: ChildcareEventSummary | null
  registrations: ChildcareRegistration[]
}> {
  const supabase = await createClient()
  const orgId = await getSelectedOrganizationId()

  if (!orgId) {
    return { childcareEvent: null, registrations: [] }
  }

  const { data: childcareEventRow, error: eventError } = await supabase
    .from("childcare_events")
    .select(
      "id, organization_id, name, event_date, start_time, end_time, capacity, notes, is_active, assigned_provider_contact_id, source_type, source_id"
    )
    .eq("organization_id", orgId)
    .eq("source_type", "internal_event")
    .eq("source_id", internalEventId)
    .maybeSingle()

  if (eventError?.code === "42P01") {
    return { childcareEvent: null, registrations: [] }
  }

  if (eventError || !childcareEventRow) {
    return { childcareEvent: null, registrations: [] }
  }

  const childcareEventId = childcareEventRow.id as string

  const { data: registrationsResult, error: registrationsError } = await supabase
    .from("childcare_registrations")
    .select(REGISTRATION_SELECT)
    .eq("organization_id", orgId)
    .eq("childcare_event_id", childcareEventId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })

  let registrationRows: unknown[] | null = registrationsResult
  if (registrationsError?.code === "42703") {
    const fallback = await supabase
      .from("childcare_registrations")
      .select(REGISTRATION_SELECT_FALLBACK)
      .eq("organization_id", orgId)
      .eq("childcare_event_id", childcareEventId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
    if (fallback.error) {
      console.error("getChildcareForInternalEvent registrations:", fallback.error.message)
      return { childcareEvent: null, registrations: [] }
    }
    registrationRows = fallback.data
  } else if (registrationsError) {
    console.error("getChildcareForInternalEvent registrations:", registrationsError.message)
    return { childcareEvent: null, registrations: [] }
  }

  const registrations = (registrationRows || []).map((row) =>
    mapRegistration(row as Record<string, unknown>)
  )

  let assignedProviderName: string | null = null
  const assignedProviderContactId =
    (childcareEventRow.assigned_provider_contact_id as string | null) ?? null

  if (assignedProviderContactId) {
    const { data: providerContact } = await supabase
      .from("contacts")
      .select("full_name")
      .eq("organization_id", orgId)
      .eq("id", assignedProviderContactId)
      .maybeSingle()

    assignedProviderName = (providerContact?.full_name as string | null) ?? "Assigned provider"
  }

  const registeredCount = registrations.filter(
    (registration) =>
      registration.status === "confirmed" ||
      registration.status === "pending" ||
      registration.status === "waitlisted"
  ).length

  let linkedDepartmentId: string | null = null
  let linkedDepartmentName: string | null = null
  const { data: internalEvent } = await supabase
    .from("internal_events")
    .select("department_id, departments:department_id (id, name)")
    .eq("id", internalEventId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (internalEvent?.department_id) {
    linkedDepartmentId = internalEvent.department_id as string
    const dept = internalEvent.departments as
      | { id?: string; name?: string | null }
      | { id?: string; name?: string | null }[]
      | null
    const deptRow = Array.isArray(dept) ? dept[0] : dept
    linkedDepartmentName = deptRow?.name?.trim() || "Department"
  }

  const childcareEvent: ChildcareEventSummary = {
    id: childcareEventId,
    organization_id: childcareEventRow.organization_id as string,
    name: childcareEventRow.name as string,
    event_date: childcareEventRow.event_date as string,
    start_time: (childcareEventRow.start_time as string | null) ?? null,
    end_time: (childcareEventRow.end_time as string | null) ?? null,
    capacity: Number(childcareEventRow.capacity) || 0,
    notes: (childcareEventRow.notes as string | null) ?? null,
    is_active: Boolean(childcareEventRow.is_active),
    assigned_provider_contact_id: assignedProviderContactId,
    source_type: (childcareEventRow.source_type as string | null) || "internal_event",
    source_id: (childcareEventRow.source_id as string | null) || internalEventId,
    registered_count: registeredCount,
    assigned_provider_name: assignedProviderName,
    linked_department_id: linkedDepartmentId,
    linked_department_name: linkedDepartmentName,
  }

  return { childcareEvent, registrations }
}
