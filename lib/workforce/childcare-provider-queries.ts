"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export type ChildcareProviderPickerOption = {
  contactId: string
  name: string
  email: string
}

export async function fetchApprovedChildcareProviders(): Promise<ChildcareProviderPickerOption[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from("applications")
    .select("contact_id, applicant_name, applicant_email")
    .eq("organization_id", organizationId)
    .eq("application_type", "childcare_provider")
    .eq("status", "approved")
    .not("contact_id", "is", null)
    .order("applicant_name", { ascending: true })

  if (error) {
    console.error("fetchApprovedChildcareProviders:", error.message)
    return []
  }

  const seen = new Set<string>()
  const options: ChildcareProviderPickerOption[] = []

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId || seen.has(contactId)) continue
    seen.add(contactId)
    options.push({
      contactId,
      name: (row.applicant_name as string) || "Unnamed provider",
      email: (row.applicant_email as string) || "",
    })
  }

  return options
}

export async function isApprovedChildcareProviderContact(contactId: string): Promise<boolean> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return false

  const { count, error } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("application_type", "childcare_provider")
    .eq("status", "approved")

  if (error) return false
  return (count ?? 0) > 0
}
