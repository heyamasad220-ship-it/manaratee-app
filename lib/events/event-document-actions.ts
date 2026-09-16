"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { canManageInternalEvent } from "@/lib/events/event-access"
import { createClient } from "@/lib/supabase/server"
import type {
  EventDocument,
  EventDocumentVisibility,
} from "@/lib/events/event-document-types"

const EVENT_DOCS_BUCKET = "program-flyers"

const EVENT_DOCS_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const

async function assertEventManage(eventId: string) {
  const canManage = await canManageInternalEvent(eventId)
  if (!canManage) {
    throw new Error("You do not have permission to manage event documents.")
  }
}

function mapDocument(row: Record<string, unknown>): EventDocument {
  return {
    id: row.id as string,
    title: (row.title as string) || "Document",
    fileUrl: row.file_url as string,
    mimeType: (row.mime_type as string | null) || null,
    fileSize: (row.file_size as number | null) || null,
    visibility: row.visibility === "public" ? "public" : "staff",
    createdAt: row.created_at as string,
  }
}

export async function listEventDocuments(eventId: string): Promise<EventDocument[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const { data, error } = await supabase
    .from("event_documents")
    .select("id, title, file_url, mime_type, file_size, visibility, created_at")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", eventId)
    .order("sort_order")
    .order("created_at", { ascending: false })

  if (error) {
    if (error.code === "42P01") return []
    console.error("listEventDocuments:", error.message)
    return []
  }

  return (data || []).map((row) => mapDocument(row as Record<string, unknown>))
}

export async function listPublicEventDocuments(input: {
  organizationId: string
  eventId: string
}): Promise<EventDocument[]> {
  const admin = getServiceRoleClient()
  const { data, error } = await admin
    .from("event_documents")
    .select("id, title, file_url, mime_type, file_size, visibility, created_at")
    .eq("organization_id", input.organizationId)
    .eq("internal_event_id", input.eventId)
    .eq("visibility", "public")
    .order("sort_order")
    .order("created_at", { ascending: false })

  if (error) {
    if (error.code === "42P01") return []
    console.error("listPublicEventDocuments:", error.message)
    return []
  }

  return (data || []).map((row) => mapDocument(row as Record<string, unknown>))
}

export async function uploadEventDocument(formData: FormData): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const eventId = String(formData.get("eventId") || "").trim()
    if (!eventId) return { success: false, error: "Event is required." }
    await assertEventManage(eventId)
    const title = String(formData.get("title") || "").trim()
    const visibility =
      String(formData.get("visibility") || "staff") === "public" ? "public" : "staff"
    const file = formData.get("file")
    if (!title) return { success: false, error: "Title is required." }
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Choose a PDF or image file." }
    }
    if (file.size > 15 * 1024 * 1024) {
      return { success: false, error: "File must be 15 MB or smaller." }
    }
    if (
      !EVENT_DOCS_MIME.includes(file.type as (typeof EVENT_DOCS_MIME)[number])
    ) {
      return { success: false, error: "Upload a PDF, PNG, JPEG, or WebP file." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "You must be signed in." }

    const { data: event, error: eventError } = await supabase
      .from("internal_events")
      .select("id")
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (eventError || !event) {
      return { success: false, error: "Event not found." }
    }

    const admin = getServiceRoleClient()
    const safeName = file.name.replace(/[^\w.\-]+/g, "-").slice(0, 80) || "document"
    const storagePath = `event-docs/${organizationId}/${eventId}/${crypto.randomUUID()}-${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(EVENT_DOCS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })
    if (uploadError) {
      return { success: false, error: uploadError.message || "Could not upload file." }
    }

    const { data: publicUrl } = admin.storage
      .from(EVENT_DOCS_BUCKET)
      .getPublicUrl(storagePath)

    const { error: insertError } = await admin.from("event_documents").insert({
      organization_id: organizationId,
      internal_event_id: eventId,
      title,
      file_url: publicUrl.publicUrl,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      visibility,
      created_by: user.id,
    })
    if (insertError) {
      return { success: false, error: insertError.message || "Could not save document." }
    }

    revalidatePath(`/event-management/${eventId}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not upload document.",
    }
  }
}

export async function deleteEventDocument(input: {
  eventId: string
  documentId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await assertEventManage(input.eventId)
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const admin = getServiceRoleClient()
    const { data: row, error: loadError } = await admin
      .from("event_documents")
      .select("id, storage_path")
      .eq("id", input.documentId)
      .eq("organization_id", organizationId)
      .eq("internal_event_id", input.eventId)
      .maybeSingle()

    if (loadError || !row) {
      return { success: false, error: "Document not found." }
    }

    if (row.storage_path) {
      await admin.storage.from(EVENT_DOCS_BUCKET).remove([row.storage_path as string])
    }

    const { error: deleteError } = await admin
      .from("event_documents")
      .delete()
      .eq("id", input.documentId)
      .eq("organization_id", organizationId)

    if (deleteError) {
      return { success: false, error: deleteError.message || "Could not delete document." }
    }

    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not delete document.",
    }
  }
}

export async function updateEventDocumentVisibility(input: {
  eventId: string
  documentId: string
  visibility: EventDocumentVisibility
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await assertEventManage(input.eventId)
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const supabase = await createClient()
    const { error } = await supabase
      .from("event_documents")
      .update({ visibility: input.visibility })
      .eq("id", input.documentId)
      .eq("organization_id", organizationId)
      .eq("internal_event_id", input.eventId)

    if (error) {
      return { success: false, error: error.message || "Could not update visibility." }
    }

    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update visibility.",
    }
  }
}
