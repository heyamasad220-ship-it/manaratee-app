"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

type ContactRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  contact_type: string | null
}

/** Ensure a donors extension row exists for this contact (individual or organization). */
export async function ensureDonorExtensionForContact(
  organizationId: string,
  contactId: string,
  supabaseClient?: SupabaseClient
): Promise<string | null> {
  const supabase = supabaseClient || (await createClient())

  const { data: existing, error: existingError } = await supabase
    .from("donors")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (existingError && existingError.code !== "42P01" && existingError.code !== "42703") {
    console.warn("Donor lookup failed:", existingError.message)
    return null
  }

  if (existing?.id) {
    return existing.id as string
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, contact_type")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (contactError || !contact) {
    return null
  }

  const row = contact as ContactRow
  const donorType =
    row.contact_type === "organization" ? "organization" : "individual"

  const { data: created, error: insertError } = await supabase
    .from("donors")
    .insert({
      organization_id: organizationId,
      contact_id: contactId,
      full_name: row.full_name || "Unnamed",
      email: row.email,
      phone: row.phone,
      donor_type: donorType,
      status: "active",
    })
    .select("id")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: retry } = await supabase
        .from("donors")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .maybeSingle()
      return retry?.id ?? null
    }
    console.warn("Could not create donor extension:", insertError.message)
    return null
  }

  return created?.id ?? null
}
