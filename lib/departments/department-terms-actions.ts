"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

const DEPARTMENT_DOCS_BUCKET = "program-flyers"

const DEPARTMENT_DOCS_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

async function ensureDepartmentDocsBucket() {
  const admin = getServiceRoleClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) throw new Error(listError.message)

  const bucketExists = buckets?.some((bucket) => bucket.id === DEPARTMENT_DOCS_BUCKET)
  if (bucketExists) {
    // Existing flyer bucket may be image-only; widen for PDFs (best-effort).
    try {
      await admin.storage.updateBucket(DEPARTMENT_DOCS_BUCKET, {
        public: true,
        fileSizeLimit: 15 * 1024 * 1024,
        allowedMimeTypes: [...DEPARTMENT_DOCS_MIME],
      })
    } catch (error) {
      console.warn("Could not update program-flyers mime types for PDFs:", error)
    }
    return
  }

  const { error: createError } = await admin.storage.createBucket(
    DEPARTMENT_DOCS_BUCKET,
    {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: [...DEPARTMENT_DOCS_MIME],
    }
  )

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(createError.message)
  }
}

export type UploadDepartmentTermsPdfResult =
  | { success: true; url: string }
  | { success: false; error: string }

export async function uploadDepartmentTermsPdf(
  formData: FormData
): Promise<UploadDepartmentTermsPdfResult> {
  const canWrite =
    (await hasPermission(PERMISSIONS.STAFF_MANAGE)) ||
    (await hasPermission(PERMISSIONS.STAFF_VIEW))
  if (!canWrite) {
    return {
      success: false,
      error: "You do not have permission to upload department documents.",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "You must be signed in to upload a PDF." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const file = formData.get("file")
  const departmentId = String(formData.get("departmentId") || "draft").trim()
  if (!(file instanceof File)) {
    return { success: false, error: "Please choose a PDF file." }
  }

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  if (!isPdf) {
    return { success: false, error: "Please choose a PDF file." }
  }

  try {
    await ensureDepartmentDocsBucket()
  } catch (error) {
    console.error("Department terms bucket setup error:", error)
    return {
      success: false,
      error:
        "Document storage is not set up. Run scripts/028_program_flyer.sql in Supabase, then try again.",
    }
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")
  const filePath = `${organizationId}/departments/${departmentId}/terms-${Date.now()}-${safeFileName}`

  try {
    const admin = getServiceRoleClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from(DEPARTMENT_DOCS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data } = admin.storage
      .from(DEPARTMENT_DOCS_BUCKET)
      .getPublicUrl(filePath)

    return { success: true, url: data.publicUrl }
  } catch (error) {
    console.error("Department terms PDF upload error:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not upload PDF.",
    }
  }
}
