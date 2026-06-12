import type { SupabaseClient } from "@supabase/supabase-js"

import type { ApplicationRecord, ApplicationStatus } from "@/lib/applications/application-types"
import type { VendorHubParticipantLifecycleStatus } from "@/lib/vendor-hub/vendor-hub-types"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { revalidatePath } from "next/cache"

const FORM_DATA_EVENT_KEYS = [
  "vendor_hub_event_id",
  "bazaar_event_id",
  "event_id",
] as const

export function extractVendorHubEventIdFromFormData(
  formData: Record<string, unknown>
): string | null {
  for (const key of FORM_DATA_EVENT_KEYS) {
    const value = formData[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function lifecycleStatusFromApplicationStatus(
  status: ApplicationStatus
): VendorHubParticipantLifecycleStatus {
  switch (status) {
    case "submitted":
      return "applied"
    case "pending_review":
      return "under_review"
    case "approved":
      return "approved"
    case "rejected":
      return "rejected"
    case "withdrawn":
      return "cancelled"
    default:
      return "lead"
  }
}

function revalidateVendorHubParticipationPaths(eventId?: string | null) {
  revalidatePath(VENDOR_HUB_ROUTES.network.history)
  revalidatePath(VENDOR_HUB_ROUTES.events.list)
  if (eventId) {
    revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
    revalidatePath(VENDOR_HUB_ROUTES.events.applications(eventId))
  }
}

export async function syncVendorHubParticipantFromApplication(input: {
  application: ApplicationRecord
  newStatus: ApplicationStatus
  organizationId: string
  vendorHubEventId?: string | null
  supabase: SupabaseClient
}) {
  const { application, newStatus, organizationId, supabase } = input

  if (application.module_owner !== "vendor_hub" || application.application_type !== "vendor") {
    return
  }

  if (!application.contact_id) {
    return
  }

  const eventId =
    input.vendorHubEventId?.trim() ||
    extractVendorHubEventIdFromFormData(application.form_data)

  if (!eventId) {
    return
  }

  const lifecycleStatus = lifecycleStatusFromApplicationStatus(newStatus)

  const { data: eventRow, error: eventError } = await supabase
    .from("vendor_hub_events")
    .select("id")
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (eventError) {
    console.error("syncVendorHubParticipantFromApplication event lookup:", eventError)
    return
  }

  if (!eventRow) {
    return
  }

  const { data: existing, error: existingError } = await supabase
    .from("vendor_hub_participant_status")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("vendor_hub_event_id", eventId)
    .eq("application_id", application.id)
    .maybeSingle()

  if (existingError) {
    console.error("syncVendorHubParticipantFromApplication lookup:", existingError)
    return
  }

  const payload = {
    organization_id: organizationId,
    vendor_hub_event_id: eventId,
    contact_id: application.contact_id,
    application_id: application.id,
    lifecycle_status: lifecycleStatus,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("vendor_hub_participant_status")
      .update({
        contact_id: application.contact_id,
        lifecycle_status: lifecycleStatus,
      })
      .eq("id", existing.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error("syncVendorHubParticipantFromApplication update:", error)
      return
    }
  } else {
    const { error } = await supabase
      .from("vendor_hub_participant_status")
      .insert(payload)

    if (error) {
      console.error("syncVendorHubParticipantFromApplication insert:", error)
      return
    }
  }

  revalidateVendorHubParticipationPaths(eventId)
}
