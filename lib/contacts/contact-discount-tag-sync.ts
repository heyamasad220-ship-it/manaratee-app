"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  type ContactRoleValue,
  filterContactRoles,
} from "@/lib/contacts/contact-constants"
import { matchDiscountTagsForRoles } from "@/lib/contacts/contact-discount-tag-mapping"
import { ensurePersonForContact } from "@/lib/people/person-tag-actions"

export async function syncContactDiscountTags(
  contactId: string,
  organizationIdInput?: string | null,
  supabaseClient?: SupabaseClient
): Promise<void> {
  const supabase = supabaseClient ?? (await createClient())
  const organizationId = organizationIdInput ?? (await getSelectedOrganizationId())

  if (!organizationId || !contactId) return

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, person_id, contact_type")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact || contact.contact_type !== "individual") {
    return
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("contact_roles")
    .select("role")
    .eq("contact_id", contactId)
    .eq("organization_id", organizationId)

  if (rolesError) {
    throw new Error(rolesError.message || "Could not load contact roles for discount tags")
  }

  const roles = filterContactRoles(
    (roleRows || []).map((row) => row.role as string)
  ) as ContactRoleValue[]

  const { data: tagRows, error: tagsError } = await supabase
    .from("discount_tags")
    .select("id, name, active")
    .eq("organization_id", organizationId)
    .eq("active", true)

  if (tagsError) {
    throw new Error(tagsError.message || "Could not load discount tags")
  }

  const matchedTags = matchDiscountTagsForRoles(roles, tagRows || [])
  const matchedTagIds = matchedTags.map((tag) => tag.id)

  let personId = contact.person_id as string | null

  if (!personId) {
    if (matchedTagIds.length === 0) {
      return
    }
    personId = await ensurePersonForContact(contactId, organizationId)
  }

  const { error: deleteError } = await supabase
    .from("person_tags")
    .delete()
    .eq("organization_id", organizationId)
    .eq("person_id", personId)

  if (deleteError) {
    throw new Error(deleteError.message || "Could not reset person discount tags")
  }

  if (matchedTagIds.length === 0) {
    return
  }

  const { error: insertError } = await supabase.from("person_tags").insert(
    matchedTagIds.map((tagId) => ({
      organization_id: organizationId,
      person_id: personId,
      tag_id: tagId,
    }))
  )

  if (insertError) {
    throw new Error(insertError.message || "Could not sync person discount tags")
  }
}
