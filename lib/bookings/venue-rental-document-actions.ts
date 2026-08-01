"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"

const VENUE_RENTAL_DOCS_BUCKET = "venue-rental-docs"

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
])

async function ensureVenueRentalDocsBucket() {
  const admin = getServiceRoleClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()

  if (listError) {
    throw new Error(listError.message)
  }

  const bucketExists = buckets?.some(
    (bucket) => bucket.id === VENUE_RENTAL_DOCS_BUCKET
  )

  if (bucketExists) {
    return
  }

  const { error: createError } = await admin.storage.createBucket(
    VENUE_RENTAL_DOCS_BUCKET,
    {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: [...ALLOWED_MIME],
    }
  )

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(createError.message)
  }
}

export type UploadVenueRentalDocumentResult =
  | { success: true; url: string; fileName: string }
  | { success: false; error: string }

export async function uploadVenueRentalOrgDocument(
  formData: FormData
): Promise<UploadVenueRentalDocumentResult> {
  const canManage = await hasAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    return {
      success: false,
      error: "You do not have permission to upload venue rental documents.",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: "You must be signed in to upload a document." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const file = formData.get("file")
  const docKind = String(formData.get("docKind") || "document")

  if (!(file instanceof File)) {
    return { success: false, error: "Please choose a PDF or image file." }
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return {
      success: false,
      error: "Please upload a PDF, PNG, JPEG, or WebP file.",
    }
  }

  if (file.size > 15 * 1024 * 1024) {
    return { success: false, error: "File must be 15 MB or smaller." }
  }

  try {
    await ensureVenueRentalDocsBucket()
  } catch (error) {
    console.error("Venue rental docs bucket setup error:", error)
    return {
      success: false,
      error:
        "Document storage is not set up. Run scripts/221_venue_rental_customer_documents.sql in Supabase, then try again.",
    }
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")
  const filePath = `${organizationId}/${docKind}/${Date.now()}-${safeFileName}`

  try {
    const admin = getServiceRoleClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(VENUE_RENTAL_DOCS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data } = admin.storage
      .from(VENUE_RENTAL_DOCS_BUCKET)
      .getPublicUrl(filePath)

    return {
      success: true,
      url: data.publicUrl,
      fileName: file.name,
    }
  } catch (error) {
    console.error("Venue rental document upload error:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not upload document.",
    }
  }
}
