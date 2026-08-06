"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"
import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"
import {
  isVendorDocumentKind,
  type VendorDocumentKind,
} from "@/lib/vendor-hub/vendor-document-kinds"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"

const APPLICATION_DOCS_BUCKET = "application-documents"

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
])

function revalidateVendorPaths(contactId: string) {
  revalidatePath(VENDOR_HUB_ROUTES.network.vendor(contactId))
  revalidatePath(VENDOR_HUB_ROUTES.network.vendors)
  revalidatePath(contactProfilePath(contactId))
}

async function ensureApplicationDocsBucket() {
  const admin = getServiceRoleClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) throw new Error(listError.message)

  if (buckets?.some((bucket) => bucket.id === APPLICATION_DOCS_BUCKET)) {
    return
  }

  const { error: createError } = await admin.storage.createBucket(APPLICATION_DOCS_BUCKET, {
    public: true,
    fileSizeLimit: 15 * 1024 * 1024,
    allowedMimeTypes: [...ALLOWED_MIME],
  })

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(createError.message)
  }
}

async function ensureVendorApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  contactId: string
) {
  const { data: existing } = await supabase
    .from("applications")
    .select("id, form_data")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
    .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return existing as { id: string; form_data: Record<string, unknown> | null }
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name, email, phone")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const { data: created, error } = await supabase
    .from("applications")
    .insert({
      organization_id: organizationId,
      application_type: VENDOR_ORG_APPLICATION_TYPE,
      module_owner: VENDOR_ORG_APPLICATION_MODULE,
      contact_id: contactId,
      applicant_name: contact?.full_name || "Vendor",
      applicant_email: contact?.email || null,
      applicant_phone: contact?.phone || null,
      status: "approved",
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      form_data: {},
      notes: "Created from vendor profile",
    })
    .select("id, form_data")
    .single()

  if (error || !created) {
    throw new Error(error?.message || "Could not create vendor application.")
  }

  return created as { id: string; form_data: Record<string, unknown> | null }
}

export type UpdateVendorProfileInput = {
  contactId: string
  businessName: string
  phone: string
  email: string
  social: string
  productsServices: string
  vendorTypeId: string | null
  contactName: string
}

export async function updateVendorProfileAction(input: UpdateVendorProfileInput) {
  await requireVendorHubManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const supabase = await createClient()
  const contactName = input.contactName.trim()
  const businessName = input.businessName.trim() || contactName
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()

  if (!contactName) {
    return { success: false as const, error: "Primary contact name is required." }
  }

  const { error: contactError } = await supabase
    .from("contacts")
    .update({
      full_name: contactName,
      email: email || null,
      phone: phone || null,
    })
    .eq("id", input.contactId)
    .eq("organization_id", organizationId)

  if (contactError) {
    return { success: false as const, error: contactError.message }
  }

  const application = await ensureVendorApplication(supabase, organizationId, input.contactId)
  const existingForm =
    application.form_data && typeof application.form_data === "object"
      ? { ...application.form_data }
      : {}

  const formData = {
    ...existingForm,
    business_name: businessName,
    social: input.social.trim() || null,
    selling: input.productsServices.trim() || null,
    products_services: input.productsServices.trim() || null,
    vendor_type_id: input.vendorTypeId || null,
  }

  const { error: appError } = await supabase
    .from("applications")
    .update({
      form_data: formData,
      applicant_name: contactName,
      applicant_email: email || null,
      applicant_phone: phone || null,
      status: "approved",
    })
    .eq("id", application.id)

  if (appError) {
    return { success: false as const, error: appError.message }
  }

  revalidateVendorPaths(input.contactId)
  return { success: true as const }
}

export async function uploadVendorDocumentAction(formData: FormData) {
  await requireVendorHubManage()

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const contactId = String(formData.get("contactId") || "")
  const kindRaw = String(formData.get("documentKind") || "other")
  const documentKind: VendorDocumentKind = isVendorDocumentKind(kindRaw) ? kindRaw : "other"
  const file = formData.get("file")

  if (!contactId) {
    return { success: false as const, error: "Missing vendor contact." }
  }
  if (!(file instanceof File)) {
    return { success: false as const, error: "Please choose a PDF or image file." }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { success: false as const, error: "Please upload a PDF, PNG, JPEG, or WebP file." }
  }
  if (file.size > 15 * 1024 * 1024) {
    return { success: false as const, error: "File must be 15 MB or smaller." }
  }

  try {
    await ensureApplicationDocsBucket()
  } catch (error) {
    console.error("Application docs bucket setup:", error)
    return {
      success: false as const,
      error:
        "Document storage is not set up. Run scripts/230_vendor_profile_documents.sql in Supabase, then try again.",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const application = await ensureVendorApplication(supabase, organizationId, contactId)
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")
  const filePath = `${organizationId}/${application.id}/${documentKind}/${Date.now()}-${safeFileName}`

  try {
    const admin = getServiceRoleClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from(APPLICATION_DOCS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      return { success: false as const, error: uploadError.message }
    }

    const { data: publicUrl } = admin.storage
      .from(APPLICATION_DOCS_BUCKET)
      .getPublicUrl(filePath)

    const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      application_id: application.id,
      file_name: file.name,
      file_url: publicUrl.publicUrl,
      file_type: file.type,
      uploaded_by: user?.id ?? null,
      document_kind: documentKind,
    }

    let { error: insertError } = await supabase
      .from("application_documents")
      .insert(insertPayload)

    if (insertError && /document_kind/i.test(insertError.message)) {
      delete insertPayload.document_kind
      ;({ error: insertError } = await supabase
        .from("application_documents")
        .insert(insertPayload))
    }

    if (insertError) {
      return { success: false as const, error: insertError.message }
    }

    revalidateVendorPaths(contactId)
    return { success: true as const }
  } catch (error) {
    console.error("uploadVendorDocumentAction:", error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not upload document.",
    }
  }
}

export async function deleteVendorDocumentAction(input: {
  contactId: string
  documentId: string
}) {
  await requireVendorHubManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("application_documents")
    .delete()
    .eq("id", input.documentId)
    .eq("organization_id", organizationId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidateVendorPaths(input.contactId)
  return { success: true as const }
}
