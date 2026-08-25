"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasEventCheckInPermission } from "@/lib/events/event-access"
import { EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH } from "@/lib/events/event-management-reports-path"
import { parseServiceRequirements } from "@/lib/events/event-service-requirements"
import { hasMissingYouthForms } from "@/lib/child-care/youth-forms"
import { getChildcareRegistrationsBundle } from "@/lib/child-care/childcare-registration-queries"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import type {
  ChildcareEventInput,
  ChildcareRegistrationInput,
  ChildcareRegistrationStatus,
} from "@/lib/child-care/childcare-registration-types"

function revalidateChildcarePaths() {
  revalidatePath("/customer/opportunities")
  revalidatePath("/event-management")
  revalidatePath(EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH)
  revalidatePath("/workforce/childcare/registrations")
  revalidatePath("/workforce/childcare")
  revalidatePath("/child-care/registrations")
  revalidatePath("/child-care/providers")
}

async function loadYouthChildcareConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  childcareEventId: string
) {
  const { data: childcareEvent } = await supabase
    .from("childcare_events")
    .select("source_type, source_id")
    .eq("organization_id", organizationId)
    .eq("id", childcareEventId)
    .maybeSingle()

  if (
    (childcareEvent?.source_type as string) !== "internal_event" ||
    !childcareEvent?.source_id
  ) {
    return null
  }

  const { data: event } = await supabase
    .from("internal_events")
    .select("service_requirements")
    .eq("organization_id", organizationId)
    .eq("id", childcareEvent.source_id as string)
    .maybeSingle()

  return parseServiceRequirements(event?.service_requirements).childcare || null
}

function youthFormInsertFields(input: ChildcareRegistrationInput) {
  const now = new Date().toISOString()
  return {
    photo_consent: input.photoConsent === true ? true : input.photoConsent === false ? false : null,
    waiver_signed_at: input.waiverSigned ? now : null,
    waiver_signed_by: input.waiverSigned
      ? input.waiverSignedBy?.trim() || input.parent_name?.trim() || null
      : null,
  }
}

async function resolveRegistrationStatus(input: {
  organizationId: string
  eventId: string
  requestedStatus: ChildcareRegistrationStatus
}) {
  if (input.requestedStatus !== "confirmed") {
    return input.requestedStatus
  }

  const supabase = await createClient()

  const { data: event, error: eventError } = await supabase
    .from("childcare_events")
    .select("capacity")
    .eq("organization_id", input.organizationId)
    .eq("id", input.eventId)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Childcare event not found.")
  }

  const { count, error: countError } = await supabase
    .from("childcare_registrations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("childcare_event_id", input.eventId)
    .eq("status", "confirmed")

  if (countError) {
    throw new Error(countError.message)
  }

  const capacity = Number(event.capacity) || 0
  if (capacity > 0 && (count ?? 0) >= capacity) {
    return "waitlisted" as const
  }

  return "confirmed" as const
}

export async function createChildcareEvent(input: ChildcareEventInput) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.name.trim()) {
    throw new Error("Event name is required")
  }

  if (!input.event_date) {
    throw new Error("Event date is required")
  }

  const supabase = await createClient()

  const { error } = await supabase.from("childcare_events").insert({
    organization_id: organizationId,
    name: input.name.trim(),
    event_date: input.event_date,
    start_time: input.start_time?.trim() || null,
    end_time: input.end_time?.trim() || null,
    capacity: input.capacity && input.capacity > 0 ? input.capacity : 20,
    notes: input.notes?.trim() || null,
    is_active: true,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidateChildcarePaths()
  return getChildcareRegistrationsBundle(organizationId)
}

export async function createChildcareRegistration(input: ChildcareRegistrationInput) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.child_name.trim()) {
    throw new Error("Child name is required")
  }

  if (!input.childcare_event_id) {
    throw new Error("Event is required")
  }

  const supabase = await createClient()

  const { data: event, error: eventError } = await supabase
    .from("childcare_events")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", input.childcare_event_id)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Invalid childcare event.")
  }

  const requestedStatus = input.status ?? "pending"
  const status = await resolveRegistrationStatus({
    organizationId,
    eventId: input.childcare_event_id,
    requestedStatus,
  })

  const allergies = input.allergies?.trim() || null
  const formFields = youthFormInsertFields(input)

  const payload = {
    organization_id: organizationId,
    childcare_event_id: input.childcare_event_id,
    child_name: input.child_name.trim(),
    child_age: input.child_age ?? null,
    parent_name: input.parent_name?.trim() || null,
    parent_email: input.parent_email?.trim() || null,
    parent_phone: input.parent_phone?.trim() || null,
    status,
    allergies,
    notes: input.notes?.trim() || null,
    ...formFields,
  }

  const { error } = await supabase.from("childcare_registrations").insert(payload)

  if (error?.code === "42703") {
    const { error: fallbackError } = await supabase
      .from("childcare_registrations")
      .insert({
        organization_id: organizationId,
        childcare_event_id: input.childcare_event_id,
        child_name: input.child_name.trim(),
        child_age: input.child_age ?? null,
        parent_name: input.parent_name?.trim() || null,
        parent_email: input.parent_email?.trim() || null,
        parent_phone: input.parent_phone?.trim() || null,
        status,
        allergies,
        notes: input.notes?.trim() || null,
      })
    if (fallbackError) {
      throw new Error(fallbackError.message)
    }
  } else if (error) {
    throw new Error(error.message)
  }

  revalidateChildcarePaths()
  return getChildcareRegistrationsBundle(organizationId)
}

export async function updateChildcareRegistrationStatus(input: {
  registrationId: string
  status: ChildcareRegistrationStatus
}) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const supabase = await createClient()

  const { data: existing, error: loadError } = await supabase
    .from("childcare_registrations")
    .select("id, childcare_event_id")
    .eq("organization_id", organizationId)
    .eq("id", input.registrationId)
    .maybeSingle()

  if (loadError || !existing) {
    throw new Error("Registration not found.")
  }

  const status = await resolveRegistrationStatus({
    organizationId,
    eventId: existing.childcare_event_id as string,
    requestedStatus: input.status,
  })

  const { error } = await supabase
    .from("childcare_registrations")
    .update({ status })
    .eq("organization_id", organizationId)
    .eq("id", input.registrationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidateChildcarePaths()
  return getChildcareRegistrationsBundle(organizationId)
}

export async function deleteChildcareRegistration(registrationId: string) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("childcare_registrations")
    .update({ status: "cancelled" })
    .eq("organization_id", organizationId)
    .eq("id", registrationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidateChildcarePaths()
  return getChildcareRegistrationsBundle(organizationId)
}

export async function loadChildcareRegistrationsPageData() {
  const organizationId = await getSelectedOrganizationId()
  return getChildcareRegistrationsBundle(organizationId ?? undefined)
}

/** Check a confirmed youth registration in or out for an event session. */
export async function setChildcareRegistrationCheckIn(input: {
  registrationId: string
  action: "check_in" | "check_out" | "undo_check_in" | "undo_check_out"
  pickupAuthorization?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canCheckIn = await hasEventCheckInPermission()
    if (!canCheckIn) {
      return { success: false, error: "You do not have permission to check in youth." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let registration: Record<string, unknown> | null = null
    const withForms = await supabase
      .from("childcare_registrations")
      .select(
        "id, status, childcare_event_id, checked_in_at, checked_out_at, allergies, photo_consent, waiver_signed_at"
      )
      .eq("organization_id", organizationId)
      .eq("id", input.registrationId)
      .maybeSingle()

    if (withForms.error?.code === "42703") {
      const fallback = await supabase
        .from("childcare_registrations")
        .select("id, status, childcare_event_id, checked_in_at, checked_out_at")
        .eq("organization_id", organizationId)
        .eq("id", input.registrationId)
        .maybeSingle()
      if (fallback.error || !fallback.data) {
        return { success: false, error: "Registration not found." }
      }
      registration = fallback.data as Record<string, unknown>
    } else if (withForms.error || !withForms.data) {
      return { success: false, error: "Registration not found." }
    } else {
      registration = withForms.data as Record<string, unknown>
    }

    if (registration.status !== "confirmed") {
      return {
        success: false,
        error: "Only confirmed registrations can be checked in or out.",
      }
    }

    if (input.action === "check_in") {
      const youthConfig = await loadYouthChildcareConfig(
        supabase,
        organizationId,
        registration.childcare_event_id as string
      )
      if (
        hasMissingYouthForms(
          {
            allergies: (registration.allergies as string | null) ?? null,
            photo_consent:
              typeof registration.photo_consent === "boolean"
                ? (registration.photo_consent as boolean)
                : null,
            waiver_signed_at: (registration.waiver_signed_at as string | null) ?? null,
          },
          youthConfig
        )
      ) {
        return {
          success: false,
          error:
            "Complete youth forms (allergies, photo consent, and waiver if required) before check-in.",
        }
      }
    }

    if (input.action === "check_out" && !registration.checked_in_at) {
      return { success: false, error: "Child must be checked in before check-out." }
    }

    if (input.action === "check_out" && registration.checked_out_at) {
      return { success: false, error: "Child is already checked out." }
    }

    const now = new Date().toISOString()
    let patch: Record<string, unknown> = {}

    switch (input.action) {
      case "check_in":
        patch = {
          checked_in_at: now,
          checked_in_by: user?.id ?? null,
          checked_out_at: null,
          checked_out_by: null,
          pickup_authorization: input.pickupAuthorization?.trim() || null,
        }
        break
      case "check_out":
        if (!registration) break
        patch = {
          checked_out_at: now,
          checked_out_by: user?.id ?? null,
        }
        break
      case "undo_check_in":
        patch = {
          checked_in_at: null,
          checked_in_by: null,
          checked_out_at: null,
          checked_out_by: null,
        }
        break
      case "undo_check_out":
        patch = {
          checked_out_at: null,
          checked_out_by: null,
        }
        break
    }

    const { error } = await supabase
      .from("childcare_registrations")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("id", input.registrationId)

    if (error) {
      return { success: false, error: error.message || "Could not update check-in." }
    }

    revalidateChildcarePaths()
    const { data: childcareEvent } = await supabase
      .from("childcare_events")
      .select("source_id")
      .eq("organization_id", organizationId)
      .eq("id", registration.childcare_event_id as string)
      .maybeSingle()

    if (childcareEvent?.source_id) {
      revalidatePath(`/event-management/${childcareEvent.source_id as string}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update check-in.",
    }
  }
}

/** Staff record allergies, photo consent, and liability waiver for a youth registration. */
export async function updateChildcareRegistrationForms(input: {
  registrationId: string
  allergies?: string | null
  photoConsent?: boolean | null
  waiverSigned?: boolean
  waiverSignedBy?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update youth forms." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const supabase = await createClient()
    const { data: registration, error: loadError } = await supabase
      .from("childcare_registrations")
      .select("id, childcare_event_id, parent_name, waiver_signed_at")
      .eq("organization_id", organizationId)
      .eq("id", input.registrationId)
      .maybeSingle()

    if (loadError || !registration) {
      return { success: false, error: "Registration not found." }
    }

    const patch: Record<string, unknown> = {}
    if (input.allergies !== undefined) {
      patch.allergies = input.allergies?.trim() || null
    }
    if (input.photoConsent !== undefined) {
      patch.photo_consent = input.photoConsent
    }
    if (input.waiverSigned === true) {
      patch.waiver_signed_at = new Date().toISOString()
      patch.waiver_signed_by =
        input.waiverSignedBy?.trim() ||
        (registration.parent_name as string | null) ||
        null
    } else if (input.waiverSigned === false) {
      patch.waiver_signed_at = null
      patch.waiver_signed_by = null
    }

    if (Object.keys(patch).length === 0) {
      return { success: true }
    }

    const { error } = await supabase
      .from("childcare_registrations")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("id", input.registrationId)

    if (error) {
      return { success: false, error: error.message || "Could not update youth forms." }
    }

    revalidateChildcarePaths()
    const { data: childcareEvent } = await supabase
      .from("childcare_events")
      .select("source_id")
      .eq("organization_id", organizationId)
      .eq("id", registration.childcare_event_id as string)
      .maybeSingle()
    if (childcareEvent?.source_id) {
      revalidatePath(`/event-management/${childcareEvent.source_id as string}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update youth forms.",
    }
  }
}

export async function assignChildcareEventProvider(input: {
  eventId: string
  providerContactId: string | null
}) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const supabase = await createClient()

  if (input.providerContactId) {
    const { data: providerApplication, error: providerError } = await supabase
      .from("applications")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", input.providerContactId)
      .eq("application_type", "childcare_provider")
      .eq("status", "approved")
      .maybeSingle()

    if (providerError || !providerApplication) {
      throw new Error("Selected provider is not an approved childcare provider.")
    }
  }

  const { error } = await supabase
    .from("childcare_events")
    .update({ assigned_provider_contact_id: input.providerContactId })
    .eq("organization_id", organizationId)
    .eq("id", input.eventId)

  if (error) {
    throw new Error(error.message || "Could not assign provider")
  }

  revalidateChildcarePaths()
  return getChildcareRegistrationsBundle(organizationId)
}
