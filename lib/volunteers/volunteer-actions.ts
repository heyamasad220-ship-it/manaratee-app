"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { findOrCreateContact, ensureHrExtensionRecords } from "@/lib/contacts/contact-actions"
import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import type {
  VolunteerPerformance,
  VolunteerSignUpStatus,
  VolunteerStatus,
} from "@/lib/volunteers/volunteer-types"

export type SaveVolunteerInput = {
  id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  status: VolunteerStatus
  join_date: string
  skills: string[]
  availability: string[]
  notes?: string
}

export async function createVolunteer(input: SaveVolunteerInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.first_name.trim() || !input.last_name.trim()) {
    throw new Error("First name and last name are required")
  }

  const fullName = `${input.first_name.trim()} ${input.last_name.trim()}`.trim()

  const { contactId } = await findOrCreateContact({
    organizationId,
    fullName,
    email: input.email,
    phone: input.phone,
    contactType: "individual",
    notes: input.notes,
  })

  const { data: existingVolunteer } = await supabase
    .from("volunteers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (existingVolunteer) {
    await syncContactAffiliations(contactId, organizationId, supabase)
    revalidateVolunteerPaths()
    return {
      volunteerId: existingVolunteer.id as string,
      contactId,
    }
  }

  const { data, error } = await supabase
    .from("volunteers")
    .insert({
      organization_id: organizationId,
      contact_id: contactId,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      status: input.status,
      join_date: input.join_date || new Date().toISOString().slice(0, 10),
      skills: input.skills,
      availability: input.availability,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Create volunteer error:", error)
    throw new Error(error.message || "Failed to create volunteer")
  }

  await ensureHrExtensionRecords(organizationId, contactId, ["volunteer"], {
    fullName,
    email: input.email,
    phone: input.phone,
  })

  await syncContactAffiliations(contactId, organizationId, supabase)

  revalidateVolunteerPaths()
  return { volunteerId: data.id as string, contactId }
}

export async function updateVolunteer(input: SaveVolunteerInput & { id: string }) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.first_name.trim() || !input.last_name.trim()) {
    throw new Error("First name and last name are required")
  }

  const { error } = await supabase
    .from("volunteers")
    .update({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      status: input.status,
      join_date: input.join_date || new Date().toISOString().slice(0, 10),
      skills: input.skills,
      availability: input.availability,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("Update volunteer error:", error)
    throw new Error(error.message || "Failed to update volunteer")
  }

  revalidateVolunteerPaths()
}

export async function deleteVolunteer(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("volunteers")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("Delete volunteer error:", error)
    throw new Error(error.message || "Failed to delete volunteer")
  }

  revalidateVolunteerPaths()
}

export type SaveVolunteerSignUpInput = {
  id?: string
  volunteer_id: string
  event_name: string
  event_date?: string | null
  role?: string | null
  hours_logged: number
  status: VolunteerSignUpStatus
}

export type SaveVolunteerHistoryInput = {
  id?: string
  volunteer_id: string
  event_name: string
  event_date?: string | null
  role?: string | null
  hours_worked: number
  performance: VolunteerPerformance
  notes?: string | null
}

export async function ensureVolunteerForContact(contactId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, notes")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .single()

  if (contactError || !contact) {
    throw new Error(contactError?.message || "Contact not found")
  }

  await addRolesToContact(contactId, ["volunteer"], {
    fullName: contact.full_name || "Unnamed Contact",
    email: contact.email,
    phone: contact.phone,
  })

  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (volunteerError && volunteerError.code !== "42703") {
    throw new Error(volunteerError.message || "Could not load volunteer record")
  }

  if (volunteer) {
    return volunteer.id as string
  }

  await ensureHrExtensionRecords(organizationId, contactId, ["volunteer"], {
    fullName: contact.full_name || "Unnamed Contact",
    email: contact.email,
    phone: contact.phone,
  })

  const { data: createdVolunteer, error: createdError } = await supabase
    .from("volunteers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (createdError || !createdVolunteer) {
    throw new Error(createdError?.message || "Could not create volunteer record")
  }

  revalidateVolunteerPaths()
  revalidatePath(`/contacts/${contactId}`)
  return createdVolunteer.id as string
}

export async function createVolunteerSignUp(input: SaveVolunteerSignUpInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.event_name.trim()) {
    throw new Error("Event name is required")
  }

  const { data, error } = await supabase
    .from("volunteer_sign_ups")
    .insert({
      organization_id: organizationId,
      volunteer_id: input.volunteer_id,
      event_name: input.event_name.trim(),
      event_date: input.event_date || null,
      role: input.role?.trim() || null,
      hours_logged: input.hours_logged,
      status: input.status,
    })
    .select("id")
    .single()

  if (error) {
    throw new Error(error.message || "Failed to create sign-up")
  }

  revalidateVolunteerPaths()
  return data.id as string
}

export async function updateVolunteerSignUp(input: SaveVolunteerSignUpInput & { id: string }) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("volunteer_sign_ups")
    .update({
      event_name: input.event_name.trim(),
      event_date: input.event_date || null,
      role: input.role?.trim() || null,
      hours_logged: input.hours_logged,
      status: input.status,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to update sign-up")
  }

  revalidateVolunteerPaths()
}

export async function deleteVolunteerSignUp(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("volunteer_sign_ups")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to delete sign-up")
  }

  revalidateVolunteerPaths()
}

export async function createVolunteerHistory(input: SaveVolunteerHistoryInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.event_name.trim()) {
    throw new Error("Event name is required")
  }

  const { data, error } = await supabase
    .from("volunteer_history")
    .insert({
      organization_id: organizationId,
      volunteer_id: input.volunteer_id,
      event_name: input.event_name.trim(),
      event_date: input.event_date || null,
      role: input.role?.trim() || null,
      hours_worked: input.hours_worked,
      performance: input.performance,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single()

  if (error) {
    throw new Error(error.message || "Failed to create history record")
  }

  revalidateVolunteerPaths()
  return data.id as string
}

export async function updateVolunteerHistory(input: SaveVolunteerHistoryInput & { id: string }) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("volunteer_history")
    .update({
      event_name: input.event_name.trim(),
      event_date: input.event_date || null,
      role: input.role?.trim() || null,
      hours_worked: input.hours_worked,
      performance: input.performance,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to update history record")
  }

  revalidateVolunteerPaths()
}

export async function deleteVolunteerHistory(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("volunteer_history")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to delete history record")
  }

  revalidateVolunteerPaths()
}

export async function updateVolunteerFromContact(
  input: SaveVolunteerInput & { id: string; contactId: string }
) {
  await updateVolunteer(input)

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const fullName = `${input.first_name.trim()} ${input.last_name.trim()}`.trim()

  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: fullName,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.replace(/[^\d]/g, "") || null,
    })
    .eq("id", input.contactId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Volunteer saved but contact could not be updated")
  }

  revalidatePath(`/contacts/${input.contactId}`)
}

function revalidateVolunteerPaths() {
  revalidatePath("/workforce/volunteers")
  revalidatePath("/resources/volunteers")
  revalidatePath("/events/volunteers")
  revalidatePath("/contacts")
}
