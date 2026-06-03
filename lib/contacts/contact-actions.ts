"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  type ContactRoleValue,
  normalizePhone,
  sanitizeRoleInput,
  splitFullName,
} from "@/lib/contacts/contact-constants"

type FindOrCreateContactInput = {
  organizationId: string
  fullName: string
  email?: string | null
  phone?: string | null
  contactType?: "individual" | "organization"
  notes?: string | null
}

export async function findOrCreateContact(input: FindOrCreateContactInput) {
  const supabase = await createClient()
  const cleanName = input.fullName.trim()
  const cleanEmail = input.email?.trim().toLowerCase() || null
  const cleanPhone = normalizePhone(input.phone) || null

  if (!cleanName) {
    throw new Error("Contact name is required")
  }

  let existingContact: { id: string } | null = null

  if (cleanEmail || cleanPhone) {
    const duplicateChecks = [
      cleanEmail ? `email.eq.${cleanEmail}` : "",
      cleanPhone ? `phone.eq.${cleanPhone}` : "",
    ]
      .filter(Boolean)
      .join(",")

    const { data: matches, error: matchError } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", input.organizationId)
      .or(duplicateChecks)
      .limit(1)

    if (matchError) {
      throw new Error(matchError.message || "Could not check existing contacts")
    }

    existingContact = matches?.[0] || null
  }

  if (!existingContact) {
    const { data: nameMatches, error: nameMatchError } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", input.organizationId)
      .ilike("full_name", cleanName)
      .limit(1)

    if (nameMatchError) {
      throw new Error(nameMatchError.message || "Could not check contact name")
    }

    existingContact = nameMatches?.[0] || null
  }

  if (existingContact) {
    return { contactId: existingContact.id, created: false }
  }

  const { data: newContact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      organization_id: input.organizationId,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      contact_type: input.contactType || "individual",
      notes: input.notes?.trim() || null,
      status: "active",
    })
    .select("id")
    .single()

  if (contactError || !newContact) {
    throw new Error(contactError?.message || "Could not create contact")
  }

  return { contactId: newContact.id, created: true }
}

export async function ensureContactForPerson(input: {
  organizationId: string
  personId: string
  roles?: ContactRoleValue[]
}) {
  const supabase = await createClient()
  const organizationId = input.organizationId.trim()
  const personId = input.personId.trim()
  const roles = sanitizeRoleInput(input.roles?.length ? input.roles : ["member"])

  if (!organizationId || !personId) {
    throw new Error("Organization and person are required.")
  }

  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id, first_name, last_name, email, phone")
    .eq("id", personId)
    .eq("organization_id", organizationId)
    .single()

  if (personError || !person) {
    throw new Error(personError?.message || "Person not found.")
  }

  const fullName =
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Family Member"

  const { data: linkedContact, error: linkedContactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("person_id", personId)
    .maybeSingle()

  if (linkedContactError) {
    throw new Error(linkedContactError.message || "Could not check existing contact.")
  }

  let contactId = linkedContact?.id as string | undefined
  let created = false

  if (!contactId) {
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        organization_id: organizationId,
        full_name: fullName,
        person_id: personId,
        email: person.email || null,
        phone: person.phone || null,
        contact_type: "individual",
        status: "active",
      })
      .select("id")
      .single()

    if (contactError || !newContact) {
      throw new Error(contactError?.message || "Could not create contact for family member.")
    }

    contactId = newContact.id as string
    created = true
  }

  for (const role of roles) {
    await ensureRoleRow(organizationId, contactId, role)
  }

  return { contactId, created }
}

async function ensureRoleRow(
  organizationId: string,
  contactId: string,
  role: ContactRoleValue
) {
  const supabase = await createClient()

  const { data: existingRole, error: existingRoleError } = await supabase
    .from("contact_roles")
    .select("id")
    .eq("contact_id", contactId)
    .eq("role", role)
    .maybeSingle()

  if (existingRoleError) {
    throw new Error(existingRoleError.message || "Could not check contact role")
  }

  if (existingRole) return

  const { error: roleError } = await supabase.from("contact_roles").insert({
    organization_id: organizationId,
    contact_id: contactId,
    role,
  })

  if (roleError) {
    throw new Error(roleError.message || "Could not add contact role")
  }
}

export async function ensureHrExtensionRecords(
  organizationId: string,
  contactId: string,
  roles: ContactRoleValue[],
  contactInfo: { fullName: string; email?: string | null; phone?: string | null }
) {
  const supabase = await createClient()
  const { first_name, last_name } = splitFullName(contactInfo.fullName)
  const email = contactInfo.email?.trim() || null
  const phone = normalizePhone(contactInfo.phone) || null

  if (roles.includes("employee")) {
    const { data: existingStaff, error: staffLookupError } = await supabase
      .from("staff")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .maybeSingle()

    if (staffLookupError && staffLookupError.code !== "42703") {
      throw new Error(staffLookupError.message || "Could not check staff record")
    }

    if (!existingStaff) {
      const { error: staffError } = await supabase.from("staff").insert({
        organization_id: organizationId,
        contact_id: contactId,
        first_name,
        last_name,
        email,
        phone,
        staff_type: "full_time",
        status: "active",
      })

      if (staffError && staffError.code !== "42703") {
        throw new Error(staffError.message || "Could not create staff record")
      }
    }
  }

  if (roles.includes("volunteer")) {
    const { data: existingVolunteer, error: volunteerLookupError } = await supabase
      .from("volunteers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .maybeSingle()

    if (volunteerLookupError && volunteerLookupError.code !== "42703") {
      throw new Error(volunteerLookupError.message || "Could not check volunteer record")
    }

    if (!existingVolunteer) {
      const { error: volunteerError } = await supabase.from("volunteers").insert({
        organization_id: organizationId,
        contact_id: contactId,
        first_name,
        last_name,
        email,
        phone,
        status: "active",
        join_date: new Date().toISOString().slice(0, 10),
        skills: [],
        availability: [],
      })

      if (volunteerError && volunteerError.code !== "42703") {
        throw new Error(volunteerError.message || "Could not create volunteer record")
      }
    }
  }
}

export async function syncContactRoles(
  contactId: string,
  roles: ContactRoleValue[],
  contactInfo?: { fullName: string; email?: string | null; phone?: string | null }
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const uniqueRoles = sanitizeRoleInput(Array.from(new Set(roles)))

  const { data: existingRows, error: loadError } = await supabase
    .from("contact_roles")
    .select("id, role")
    .eq("contact_id", contactId)
    .eq("organization_id", organizationId)

  if (loadError) {
    throw new Error(loadError.message || "Could not load contact roles")
  }

  const existingRoles = (existingRows || []).map((row) => row.role as string)
  const rolesToAdd = uniqueRoles.filter((role) => !existingRoles.includes(role))
  const rolesToRemove = existingRoles.filter((role) => !uniqueRoles.includes(role))

  if (rolesToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("contact_roles")
      .delete()
      .eq("contact_id", contactId)
      .eq("organization_id", organizationId)
      .in("role", rolesToRemove)

    if (deleteError) {
      throw new Error(deleteError.message || "Could not remove contact roles")
    }
  }

  for (const role of rolesToAdd) {
    await ensureRoleRow(organizationId, contactId, role)
  }

  if (contactInfo) {
    await ensureHrExtensionRecords(organizationId, contactId, uniqueRoles, contactInfo)
  }

  revalidateContactPaths()
  revalidatePath(`/contacts/${contactId}`)
}

export async function addRolesToContact(
  contactId: string,
  roles: ContactRoleValue[],
  contactInfo?: { fullName: string; email?: string | null; phone?: string | null }
) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const uniqueRoles = sanitizeRoleInput(Array.from(new Set(roles)))
  if (uniqueRoles.length === 0 && roles.length > 0) {
    throw new Error("No valid roles selected")
  }

  for (const role of uniqueRoles) {
    await ensureRoleRow(organizationId, contactId, role)
  }

  if (contactInfo) {
    await ensureHrExtensionRecords(organizationId, contactId, uniqueRoles, contactInfo)
  }

  revalidateContactPaths()
}

export async function addContactWithRoles(input: {
  fullName: string
  email?: string
  phone?: string
  contactType?: "individual" | "organization"
  notes?: string
  roles: ContactRoleValue[]
}) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const uniqueRoles = sanitizeRoleInput(Array.from(new Set(input.roles)))
  if (uniqueRoles.length === 0) {
    throw new Error("Select at least one role")
  }

  const { contactId, created } = await findOrCreateContact({
    organizationId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    contactType: input.contactType,
    notes: input.notes,
  })

  for (const role of uniqueRoles) {
    await ensureRoleRow(organizationId, contactId, role)
  }

  await ensureHrExtensionRecords(organizationId, contactId, uniqueRoles, {
    fullName: input.fullName.trim(),
    email: input.email,
    phone: input.phone,
  })

  revalidateContactPaths()

  return { contactId, created }
}

function revalidateContactPaths() {
  revalidatePath("/contacts")
  revalidatePath("/contacts/people")
  revalidatePath("/contacts/organizations")
  revalidatePath("/hr/members")
  revalidatePath("/hr/employees")
  revalidatePath("/hr/volunteers")
  revalidatePath("/hr/service-providers")
  revalidatePath("/donations/donors")
  revalidatePath("/vendor-hub/vendors")
  revalidatePath("/resources/volunteers")
  revalidatePath("/programs/instructors")
}

export async function linkStaffToContact(input: {
  staffId: string
  fullName: string
  email?: string | null
  phone?: string | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { contactId } = await findOrCreateContact({
    organizationId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    contactType: "individual",
  })

  await ensureRoleRow(organizationId, contactId, "employee")

  const { error } = await supabase
    .from("staff")
    .update({ contact_id: contactId })
    .eq("id", input.staffId)
    .eq("organization_id", organizationId)

  if (error && error.code !== "42703") {
    throw new Error(error.message || "Could not link staff to contact")
  }

  revalidateContactPaths()
  return contactId
}
