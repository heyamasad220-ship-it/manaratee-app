"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"

const PROGRAM_FLYERS_BUCKET = "program-flyers"

async function ensureProgramFlyersBucket() {
  const admin = getServiceRoleClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()

  if (listError) {
    throw new Error(listError.message)
  }

  const bucketExists = buckets?.some(
    (bucket) => bucket.id === PROGRAM_FLYERS_BUCKET
  )

  if (bucketExists) {
    return
  }

  const { error: createError } = await admin.storage.createBucket(
    PROGRAM_FLYERS_BUCKET,
    {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    }
  )

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(createError.message)
  }
}

export type UploadProgramFlyerResult =
  | { success: true; url: string }
  | { success: false; error: string }

export async function uploadProgramFlyer(
  formData: FormData
): Promise<UploadProgramFlyerResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: "You must be signed in to upload a flyer." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const file = formData.get("file")
  const programId = String(formData.get("programId") || "draft")

  if (!(file instanceof File)) {
    return { success: false, error: "Please choose an image file." }
  }

  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Please choose an image file." }
  }

  try {
    await ensureProgramFlyersBucket()
  } catch (error) {
    console.error("Program flyer bucket setup error:", error)
    return {
      success: false,
      error:
        "Flyer storage is not set up. Run scripts/028_program_flyer.sql in Supabase, then try again.",
    }
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")
  const filePath = `${organizationId}/${programId}/${Date.now()}-${safeFileName}`

  try {
    const admin = getServiceRoleClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(PROGRAM_FLYERS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data } = admin.storage
      .from(PROGRAM_FLYERS_BUCKET)
      .getPublicUrl(filePath)

    return { success: true, url: data.publicUrl }
  } catch (error) {
    console.error("Program flyer upload error:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not upload flyer.",
    }
  }
}
