"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  isWorkforceCredentialType,
  type WorkforceCredentialType,
} from "@/lib/workforce/workforce-credential-constants"

function revalidateCredentialPaths(contactId: string) {
  revalidatePath("/workforce/volunteers")
  revalidatePath("/workforce/childcare")
  revalidatePath("/workforce/volunteers")
  revalidatePath(`/contacts/${contactId}`)
}

function normalizeDate(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || null
}

export async function saveWorkforceCredential(input: {
  id?: string
  contactId: string
  credentialType: WorkforceCredentialType
  label?: string | null
  issuedDate?: string | null
  expiresDate?: string | null
  documentUrl?: string | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!isWorkforceCredentialType(input.credentialType)) {
    throw new Error("Invalid credential type")
  }

  const payload = {
    organization_id: organizationId,
    contact_id: input.contactId,
    credential_type: input.credentialType,
    label: input.label?.trim() || null,
    issued_date: normalizeDate(input.issuedDate),
    expires_date: normalizeDate(input.expiresDate),
    document_url: input.documentUrl?.trim() || null,
    notes: input.notes?.trim() || null,
  }

  if (input.id) {
    const { error } = await supabase
      .from("workforce_credentials")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      throw new Error(error.message || "Could not update credential")
    }
  } else {
    const { error } = await supabase.from("workforce_credentials").insert(payload)

    if (error) {
      throw new Error(error.message || "Could not create credential")
    }
  }

  revalidateCredentialPaths(input.contactId)
}

export async function deleteWorkforceCredential(id: string, contactId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("workforce_credentials")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not delete credential")
  }

  revalidateCredentialPaths(contactId)
}
