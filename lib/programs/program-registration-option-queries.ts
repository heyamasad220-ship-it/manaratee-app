import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"

export async function getRegistrationOptionsForOffering(
  offeringId: string,
  organizationId?: string
) {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())

  if (!orgId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_registration_options")
    .select("*")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("is_active", true)
    .order("priority_rank", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("getRegistrationOptionsForOffering:", error.message)
    throw new Error("Failed to load registration options")
  }

  return (data || []) as ProgramRegistrationOption[]
}

export async function getAllRegistrationOptionsForOffering(offeringId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_registration_options")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .order("priority_rank", { ascending: true })

  if (error) {
    console.error("getAllRegistrationOptionsForOffering:", error.message)
    throw new Error("Failed to load registration options")
  }

  return (data || []) as ProgramRegistrationOption[]
}

export function isRegistrationOptionAvailable(
  option: ProgramRegistrationOption,
  today = new Date()
) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (option.available_from) {
    const from = new Date(`${option.available_from}T00:00:00`)
    if (day < from) return false
  }

  if (option.available_until) {
    const until = new Date(`${option.available_until}T00:00:00`)
    if (day > until) return false
  }

  return option.is_active
}

export async function getRegistrationOptionById(
  optionId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_registration_options")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", optionId)
    .maybeSingle()

  if (error) {
    console.error("getRegistrationOptionById:", error.message)
    return null
  }

  return data as ProgramRegistrationOption | null
}
