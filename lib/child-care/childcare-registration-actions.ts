"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getChildcareRegistrationsBundle } from "@/lib/child-care/childcare-registration-queries"
import type {
  ChildcareEventInput,
  ChildcareRegistrationInput,
  ChildcareRegistrationStatus,
} from "@/lib/child-care/childcare-registration-types"

function revalidateChildcarePaths() {
  revalidatePath("/customer/opportunities")
  revalidatePath("/event-management/overview")
  revalidatePath("/workforce/childcare/registrations")
  revalidatePath("/workforce/childcare")
  revalidatePath("/child-care/registrations")
  revalidatePath("/child-care/providers")
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

  const { error } = await supabase.from("childcare_registrations").insert({
    organization_id: organizationId,
    childcare_event_id: input.childcare_event_id,
    child_name: input.child_name.trim(),
    child_age: input.child_age ?? null,
    parent_name: input.parent_name?.trim() || null,
    parent_email: input.parent_email?.trim() || null,
    parent_phone: input.parent_phone?.trim() || null,
    status,
    allergies: allergies && allergies.toLowerCase() !== "none" ? allergies : null,
    notes: input.notes?.trim() || null,
  })

  if (error) {
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
  return getChildcareRegistrationsBundle(organizationId)
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
