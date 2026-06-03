"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import {
  isOrgStaffSystemRole,
  type OrganizationMemberSystemRole,
} from "@/lib/organizations/organization-member-constants"
import { setActiveOrganization } from "@/lib/organizations/organization-actions"
import { syncProfileForOrganizationMember } from "@/lib/organizations/sync-profile-organization"

export type JoinOrganizationSummary = {
  id: string
  name: string
  slug: string
}

export async function getJoinOrganizationBySlug(
  orgSlug: string
): Promise<JoinOrganizationSummary | null> {
  const slug = orgSlug.trim().toLowerCase()
  if (!slug) return null

  const admin = getServiceRoleClient()

  const { data, error } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    id: data.id as string,
    name: data.name as string,
    slug: data.slug as string,
  }
}

async function ensureContactMemberRole(
  admin: ReturnType<typeof getServiceRoleClient>,
  organizationId: string,
  contactId: string
) {
  const { data: existingRole } = await admin
    .from("contact_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", "member")
    .maybeSingle()

  if (existingRole) return

  const { error } = await admin.from("contact_roles").insert({
    organization_id: organizationId,
    contact_id: contactId,
    role: "member",
  })

  if (error && !error.message.includes("duplicate")) {
    throw new Error(error.message || "Could not assign contact role")
  }
}

export async function joinOrganizationAsCustomer(input: {
  organizationId: string
  organizationSlug: string
  firstName: string
  lastName: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false as const, error: "Please sign in to continue." }
  }

  const organization = await getJoinOrganizationBySlug(input.organizationSlug)
  if (!organization || organization.id !== input.organizationId) {
    return { success: false as const, error: "Organization not found." }
  }

  const admin = getServiceRoleClient()
  const email = user.email?.trim().toLowerCase() ?? ""
  const firstName = input.firstName.trim() || "Member"
  const lastName = input.lastName.trim()
  const fullName = `${firstName} ${lastName}`.trim() || firstName

  const { data: existingMembership } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .maybeSingle()

  const membershipRole =
    (existingMembership?.role as OrganizationMemberSystemRole | undefined) ?? "viewer"

  if (!existingMembership) {
    const { error: membershipError } = await admin.from("organization_members").upsert(
      {
        organization_id: organization.id,
        user_id: user.id,
        role: "viewer",
        status: "active",
      },
      { onConflict: "organization_id,user_id" }
    )

    if (membershipError) {
      return {
        success: false as const,
        error: membershipError.message || "Could not add you to this organization.",
      }
    }
  }

  let contactId: string | null = null

  const { data: linkedContact } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (linkedContact?.id) {
    contactId = linkedContact.id as string
  } else if (email) {
    const { data: emailContact } = await admin
      .from("contacts")
      .select("id, auth_user_id, person_id")
      .eq("organization_id", organization.id)
      .eq("email", email)
      .maybeSingle()

    if (emailContact?.id) {
      if (
        emailContact.auth_user_id &&
        emailContact.auth_user_id !== user.id
      ) {
        return {
          success: false as const,
          error:
            "This email is already linked to another account at this organization. Contact your administrator.",
        }
      }

      contactId = emailContact.id as string

      const { error: linkError } = await admin
        .from("contacts")
        .update({
          auth_user_id: user.id,
          full_name: fullName,
          email,
        })
        .eq("id", contactId)

      if (linkError) {
        return {
          success: false as const,
          error: linkError.message || "Could not link your profile.",
        }
      }

      if (!emailContact.person_id) {
        const { data: person, error: personError } = await admin
          .from("people")
          .insert({
            organization_id: organization.id,
            first_name: firstName,
            last_name: lastName || "Member",
            email,
            phone: null,
            person_type: "contact",
          })
          .select("id")
          .single()

        if (!personError && person?.id) {
          await admin
            .from("contacts")
            .update({ person_id: person.id })
            .eq("id", contactId)
        }
      }
    }
  }

  if (!contactId) {
    const { data: person, error: personError } = await admin
      .from("people")
      .insert({
        organization_id: organization.id,
        first_name: firstName,
        last_name: lastName || "Member",
        email: email || null,
        phone: null,
        person_type: "contact",
      })
      .select("id")
      .single()

    if (personError || !person?.id) {
      return {
        success: false as const,
        error: personError?.message || "Could not create your profile.",
      }
    }

    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .insert({
        organization_id: organization.id,
        person_id: person.id,
        full_name: fullName,
        email: email || null,
        auth_user_id: user.id,
        contact_type: "individual",
        status: "active",
      })
      .select("id")
      .single()

    if (contactError || !contact?.id) {
      return {
        success: false as const,
        error: contactError?.message || "Could not create your contact record.",
      }
    }

    contactId = contact.id as string
  }

  await ensureContactMemberRole(admin, organization.id, contactId)

  await syncProfileForOrganizationMember(admin, {
    userId: user.id,
    email,
    firstName,
    lastName,
    organizationId: organization.id,
    systemRole: isOrgStaffSystemRole(membershipRole) ? membershipRole : "viewer",
  })

  await setActiveOrganization(organization.id)

  revalidatePath("/customer")
  revalidatePath(`/join/${organization.slug}`)

  return {
    success: true as const,
    organizationId: organization.id,
    organizationName: organization.name,
  }
}
