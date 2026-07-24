"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { ensureHrExtensionRecords } from "@/lib/contacts/contact-actions"

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first_name: "Volunteer", last_name: "" }
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" }
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

function skillsFromFormData(formData: Record<string, unknown> | null | undefined): string[] {
  if (!formData) return []
  const interests = Array.isArray(formData.areasOfInterest)
    ? formData.areasOfInterest.map(String)
    : []
  const skillsText =
    typeof formData.skills === "string"
      ? formData.skills
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : []
  return Array.from(new Set([...interests, ...skillsText]))
}

function availabilityFromFormData(
  formData: Record<string, unknown> | null | undefined
): string[] {
  if (!formData) return []
  if (!Array.isArray(formData.availability)) return []
  return formData.availability.map(String).filter(Boolean)
}

/**
 * Ensures an approved volunteer application has an active volunteers roster row.
 */
export async function ensureVolunteerFromApprovedApplication(input: {
  supabase: SupabaseClient
  organizationId: string
  contactId: string
  applicantName: string
  applicantEmail?: string | null
  applicantPhone?: string | null
  formData?: Record<string, unknown> | null
}): Promise<{ volunteerId: string; created: boolean }> {
  const { supabase, organizationId, contactId } = input
  const skills = skillsFromFormData(input.formData)
  const availability = availabilityFromFormData(input.formData)
  const notesParts = [
    typeof input.formData?.whyVolunteer === "string"
      ? input.formData.whyVolunteer.trim()
      : "",
    typeof input.formData?.experience === "string"
      ? `Experience: ${input.formData.experience.trim()}`
      : "",
    typeof input.formData?.additionalNotes === "string"
      ? input.formData.additionalNotes.trim()
      : "",
  ].filter(Boolean)

  const { data: existingVolunteer, error: existingError } = await supabase
    .from("volunteers")
    .select("id, status, skills, availability, notes")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(existingError.message || "Could not check existing volunteer.")
  }

  if (existingVolunteer?.id) {
    const patch: Record<string, unknown> = {}
    const status = ((existingVolunteer.status as string) || "").toLowerCase()
    if (status && status !== "active") {
      patch.status = "active"
    }
    const existingSkills = Array.isArray(existingVolunteer.skills)
      ? (existingVolunteer.skills as string[])
      : []
    if (skills.length > 0 && existingSkills.length === 0) {
      patch.skills = skills
    }
    const existingAvailability = Array.isArray(existingVolunteer.availability)
      ? (existingVolunteer.availability as string[])
      : []
    if (availability.length > 0 && existingAvailability.length === 0) {
      patch.availability = availability
    }
    if (notesParts.length > 0 && !(existingVolunteer.notes as string | null)?.trim()) {
      patch.notes = notesParts.join("\n\n")
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase
        .from("volunteers")
        .update(patch)
        .eq("id", existingVolunteer.id)
        .eq("organization_id", organizationId)
      if (updateError) {
        throw new Error(updateError.message)
      }
    }

    const { data: existingContact } = await supabase
      .from("contacts")
      .select("full_name, email, phone")
      .eq("id", contactId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    await ensureHrExtensionRecords(organizationId, contactId, ["volunteer"], {
      fullName:
        existingContact?.full_name?.trim() ||
        input.applicantName.trim() ||
        "Volunteer",
      email:
        (existingContact?.email as string | null)?.trim() ||
        input.applicantEmail?.trim() ||
        undefined,
      phone:
        (existingContact?.phone as string | null)?.trim() ||
        input.applicantPhone?.trim() ||
        undefined,
    })
    await syncContactAffiliations(contactId, organizationId, supabase)
    revalidateVolunteerApplyPaths(contactId)
    return { volunteerId: existingVolunteer.id as string, created: false }
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name, email, phone")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const displayName =
    contact?.full_name?.trim() || input.applicantName.trim() || "Volunteer"
  const { first_name, last_name } = splitFullName(displayName)
  const email =
    (contact?.email as string | null)?.trim() ||
    input.applicantEmail?.trim() ||
    null
  const phone =
    (contact?.phone as string | null)?.trim() ||
    input.applicantPhone?.trim() ||
    null

  const { data: created, error: insertError } = await supabase
    .from("volunteers")
    .insert({
      organization_id: organizationId,
      contact_id: contactId,
      first_name,
      last_name,
      email,
      phone,
      status: "active",
      join_date: new Date().toISOString().slice(0, 10),
      skills,
      availability,
      notes: notesParts.join("\n\n") || null,
    })
    .select("id")
    .single()

  if (insertError || !created) {
    throw new Error(insertError?.message || "Could not create volunteer roster row.")
  }

  await ensureHrExtensionRecords(organizationId, contactId, ["volunteer"], {
    fullName: displayName,
    email: email || undefined,
    phone: phone || undefined,
  })
  await syncContactAffiliations(contactId, organizationId, supabase)
  revalidateVolunteerApplyPaths(contactId)
  return { volunteerId: created.id as string, created: true }
}

function revalidateVolunteerApplyPaths(contactId: string) {
  revalidatePath("/workforce")
  revalidatePath("/workforce/volunteers")
  revalidatePath(`/contacts/${contactId}`)
}
