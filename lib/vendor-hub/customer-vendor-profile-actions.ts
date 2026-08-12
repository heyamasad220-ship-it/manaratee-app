"use server"

import { revalidatePath } from "next/cache"

import { resolveCustomerPortalActor } from "@/lib/auth/customer-portal-session"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { composeVendorSocialBlob } from "@/lib/vendor-hub/vendor-application-fields"
import { isApprovedOrgVendor } from "@/lib/vendor-hub/vendor-eligibility-queries"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"

export type CustomerVendorProfile = {
  contactId: string
  organizationId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  businessName: string
  vendorTypeId: string | null
  facebook: string
  instagram: string
  website: string
  productsServices: string
  yearsInBusiness: string
  serviceArea: string
  vendorTypes: VendorHubVendorType[]
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {}
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  }
}

function parseLabeledSocial(social: string | null, label: string) {
  if (!social) return ""
  const match = social.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i"))
  return match?.[1]?.trim() || ""
}

function socialFieldsFromFormData(formData: Record<string, unknown>) {
  const facebook =
    stringField(formData, "facebook") ||
    parseLabeledSocial(stringField(formData, "social"), "Facebook")
  const instagram =
    stringField(formData, "instagram") ||
    parseLabeledSocial(stringField(formData, "social"), "Instagram")
  const website =
    stringField(formData, "website") ||
    parseLabeledSocial(stringField(formData, "social"), "Website")

  // If social was a free-form blob without labels, leave website empty and keep blob out of fields
  return { facebook: facebook || "", instagram: instagram || "", website: website || "" }
}

async function resolveOwnedVendorContact(
  userId: string,
  organizationId: string
): Promise<{ contactId: string } | { error: string }> {
  const admin = getServiceRoleClient()

  const { data: contact, error } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .limit(1)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!contact?.id) {
    return {
      error:
        "We could not find your vendor contact for this organization. Join with the same email used on your vendor profile.",
    }
  }

  const approved = await isApprovedOrgVendor({
    supabase: admin,
    organizationId,
    contactId: contact.id as string,
  })

  if (!approved) {
    return {
      error: "Your vendor profile is not approved yet. Apply or wait for review before editing.",
    }
  }

  return { contactId: contact.id as string }
}

export async function getCustomerVendorProfileAction(
  organizationId: string
): Promise<
  | { success: true; profile: CustomerVendorProfile }
  | { success: false; error: string }
> {
  try {
    const actor = await resolveCustomerPortalActor()
    if (!actor) {
      return { success: false, error: "Sign in required." }
    }

    const owned = await resolveOwnedVendorContact(actor.userId, organizationId)
    if ("error" in owned) {
      return { success: false, error: owned.error }
    }

    const admin = getServiceRoleClient()

    const [{ data: contact }, { data: application }, { data: vendorTypes }] =
      await Promise.all([
        admin
          .from("contacts")
          .select("id, full_name, email, phone")
          .eq("id", owned.contactId)
          .maybeSingle(),
        admin
          .from("applications")
          .select("id, form_data")
          .eq("organization_id", organizationId)
          .eq("contact_id", owned.contactId)
          .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
          .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("vendor_hub_vendor_types")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ])

    if (!contact) {
      return { success: false, error: "Contact not found." }
    }

    const formData = asRecord(application?.form_data)
    const fullName = (contact.full_name as string | null)?.trim() || ""
    const nameParts = splitFullName(
      [stringField(formData, "first_name"), stringField(formData, "last_name")]
        .filter(Boolean)
        .join(" ") || fullName
    )
    const social = socialFieldsFromFormData(formData)
    const products =
      stringField(formData, "products_services") ||
      stringField(formData, "selling") ||
      ""

    return {
      success: true,
      profile: {
        contactId: owned.contactId,
        organizationId,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        email: (contact.email as string | null)?.trim() || "",
        phone: (contact.phone as string | null)?.trim() || "",
        businessName: stringField(formData, "business_name") || "",
        vendorTypeId: stringField(formData, "vendor_type_id"),
        facebook: social.facebook,
        instagram: social.instagram,
        website: social.website,
        productsServices: products,
        yearsInBusiness: stringField(formData, "years_in_business") || "",
        serviceArea: stringField(formData, "service_area") || "",
        vendorTypes: (vendorTypes || []) as VendorHubVendorType[],
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load vendor profile.",
    }
  }
}

export type UpdateCustomerVendorProfileInput = {
  organizationId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  businessName: string
  vendorTypeId: string | null
  facebook: string
  instagram: string
  website: string
  productsServices: string
  yearsInBusiness: string
  serviceArea: string
}

export async function updateCustomerVendorProfileAction(
  input: UpdateCustomerVendorProfileInput
) {
  try {
    const actor = await resolveCustomerPortalActor()
    if (!actor) {
      return { success: false as const, error: "Sign in required." }
    }

    const organizationId = input.organizationId.trim()
    if (!organizationId) {
      return { success: false as const, error: "Organization is required." }
    }

    const owned = await resolveOwnedVendorContact(actor.userId, organizationId)
    if ("error" in owned) {
      return { success: false as const, error: owned.error }
    }

    const firstName = input.firstName.trim()
    const lastName = input.lastName.trim()
    const contactName = `${firstName} ${lastName}`.trim()
    const email = input.email.trim().toLowerCase()
    const phone = input.phone.trim()
    const businessName = input.businessName.trim() || contactName
    const products = input.productsServices.trim()
    const vendorTypeId = input.vendorTypeId?.trim() || null

    if (!firstName || !lastName) {
      return { success: false as const, error: "First and last name are required." }
    }
    if (!email) {
      return { success: false as const, error: "Email is required." }
    }
    if (!phone) {
      return { success: false as const, error: "Phone number is required." }
    }
    if (!businessName) {
      return { success: false as const, error: "Business name is required." }
    }
    if (!products) {
      return { success: false as const, error: "Products or services are required." }
    }

    const admin = getServiceRoleClient()

    let vendorTypeName: string | null = null
    if (vendorTypeId) {
      const { data: typeRow } = await admin
        .from("vendor_hub_vendor_types")
        .select("name")
        .eq("id", vendorTypeId)
        .eq("organization_id", organizationId)
        .maybeSingle()
      vendorTypeName = (typeRow?.name as string | null) ?? null
    }

    const { error: contactError } = await admin
      .from("contacts")
      .update({
        full_name: contactName,
        email: email || null,
        phone: phone || null,
      })
      .eq("id", owned.contactId)
      .eq("organization_id", organizationId)
      .eq("auth_user_id", actor.userId)

    if (contactError) {
      return { success: false as const, error: contactError.message }
    }

    const { data: existingApp } = await admin
      .from("applications")
      .select("id, form_data")
      .eq("organization_id", organizationId)
      .eq("contact_id", owned.contactId)
      .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
      .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const social = composeVendorSocialBlob({
      facebook: input.facebook,
      instagram: input.instagram,
      website: input.website,
    })

    const existingForm = asRecord(existingApp?.form_data)
    const formData = {
      ...existingForm,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      business_name: businessName,
      vendor_type_id: vendorTypeId,
      vendor_type_name: vendorTypeName,
      facebook: input.facebook.trim() || null,
      instagram: input.instagram.trim() || null,
      website: input.website.trim() || null,
      social: social || null,
      products_services: products,
      selling: products,
      years_in_business: input.yearsInBusiness.trim() || null,
      service_area: input.serviceArea.trim() || null,
    }

    if (existingApp?.id) {
      const { error: appError } = await admin
        .from("applications")
        .update({
          form_data: formData,
          applicant_name: contactName,
          applicant_email: email,
          applicant_phone: phone || null,
          status: "approved",
        })
        .eq("id", existingApp.id)
      if (appError) {
        return { success: false as const, error: appError.message }
      }
    } else {
      const { error: insertError } = await admin.from("applications").insert({
        organization_id: organizationId,
        application_type: VENDOR_ORG_APPLICATION_TYPE,
        module_owner: VENDOR_ORG_APPLICATION_MODULE,
        contact_id: owned.contactId,
        applicant_name: contactName,
        applicant_email: email,
        applicant_phone: phone || null,
        status: "approved",
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        form_data: formData,
        notes: "Created from customer vendor profile",
      })
      if (insertError) {
        return { success: false as const, error: insertError.message }
      }
    }

    revalidatePath("/customer/profile/vendor")
    revalidatePath("/customer/bazaars")
    revalidatePath("/customer/profile")
    revalidatePath(VENDOR_HUB_ROUTES.network.vendor(owned.contactId))
    revalidatePath(VENDOR_HUB_ROUTES.network.vendors)
    revalidatePath(contactProfilePath(owned.contactId))

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not update vendor profile.",
    }
  }
}
