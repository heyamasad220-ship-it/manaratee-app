"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { WorkforceCredentialType } from "@/lib/workforce/workforce-credential-constants"

export type WorkforceCredentialRecord = {
  id: string
  organization_id: string
  contact_id: string
  credential_type: WorkforceCredentialType
  label: string | null
  issued_date: string | null
  expires_date: string | null
  document_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

export async function fetchContactCredentials(
  contactId: string
): Promise<WorkforceCredentialRecord[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from("workforce_credentials")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("expires_date", { ascending: true, nullsFirst: false })

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message || "Could not load credentials")
  }

  return (data || []) as WorkforceCredentialRecord[]
}

export async function fetchExpiringCredentialsCount(withinDays = 30) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return 0

  const today = new Date()
  const soon = new Date(today)
  soon.setDate(soon.getDate() + withinDays)

  const { count, error } = await supabase
    .from("workforce_credentials")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .not("expires_date", "is", null)
    .gte("expires_date", today.toISOString().slice(0, 10))
    .lte("expires_date", soon.toISOString().slice(0, 10))

  if (error) {
    if (isMissingTableError(error)) return 0
    return 0
  }

  return count ?? 0
}
