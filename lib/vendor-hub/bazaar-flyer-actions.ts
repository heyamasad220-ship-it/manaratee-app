"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

const BAZAAR_FLYERS_BUCKET = "bazaar-flyers"

async function ensureBazaarFlyersBucket() {
  const admin = getServiceRoleClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()

  if (listError) {
    throw new Error(listError.message)
  }

  const bucketExists = buckets?.some((bucket) => bucket.id === BAZAAR_FLYERS_BUCKET)
  if (bucketExists) {
    return
  }

  const { error: createError } = await admin.storage.createBucket(BAZAAR_FLYERS_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  })

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(createError.message)
  }
}

export type UploadBazaarFlyerResult =
  | { success: true; url: string }
  | { success: false; error: string }

export async function uploadBazaarFlyer(formData: FormData): Promise<UploadBazaarFlyerResult> {
  await requireVendorHubManage()

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const file = formData.get("file")
  const eventId = String(formData.get("eventId") || "draft")

  if (!(file instanceof File)) {
    return { success: false, error: "Please choose an image file." }
  }

  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Please choose an image file." }
  }

  try {
    await ensureBazaarFlyersBucket()
  } catch (error) {
    console.error("Bazaar flyer bucket setup error:", error)
    return {
      success: false,
      error:
        "Flyer storage is not set up. Run scripts/085_vendor_hub_flyer_and_share.sql in Supabase, then try again.",
    }
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")
  const filePath = `${organizationId}/${eventId}/${Date.now()}-${safeFileName}`

  try {
    const admin = getServiceRoleClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(BAZAAR_FLYERS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data } = admin.storage.from(BAZAAR_FLYERS_BUCKET).getPublicUrl(filePath)
    return { success: true, url: data.publicUrl }
  } catch (error) {
    console.error("Bazaar flyer upload error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not upload flyer.",
    }
  }
}

export async function saveBazaarEventFlyer(eventId: string, flyerUrl: string | null) {
  await requireVendorHubManage()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("vendor_hub_events")
    .update({ flyer_url: flyerUrl?.trim() || null })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message)
  }

  const { data: event } = await supabase
    .from("vendor_hub_events")
    .select("public_share_token")
    .eq("id", eventId)
    .maybeSingle()

  revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
  if (event?.public_share_token) {
    revalidatePath(`/bazaar/${event.public_share_token as string}`)
  }

  return { flyerUrl: flyerUrl?.trim() || null }
}
