"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  getEventVendorEvaluations,
  getVendorEvaluationsForContact,
} from "@/lib/vendor-hub/vendor-evaluation-queries"
import {
  VENDOR_PARTICIPATION_RATINGS,
  type VendorParticipationRating,
} from "@/lib/vendor-hub/vendor-evaluation-types"

export async function fetchEventVendorEvaluations(eventId: string) {
  await requireVendorHubManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected.")
  }
  return getEventVendorEvaluations(eventId, organizationId)
}

export async function fetchContactVendorEvaluations(contactId: string) {
  return getVendorEvaluationsForContact(contactId)
}

export async function upsertVendorParticipationEvaluation(input: {
  eventId: string
  contactId: string
  boothAssignmentId?: string | null
  rating: VendorParticipationRating
  wouldInviteAgain: boolean | null
  notes?: string | null
}) {
  await requireVendorHubManage()

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected.")
  }

  if (!VENDOR_PARTICIPATION_RATINGS.includes(input.rating)) {
    throw new Error("Invalid rating.")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: event, error: eventError } = await supabase
    .from("vendor_hub_events")
    .select("id, organization_id")
    .eq("id", input.eventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Bazaar event not found.")
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", input.contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    throw new Error("Vendor contact not found.")
  }

  const payload = {
    organization_id: organizationId,
    vendor_hub_event_id: input.eventId,
    contact_id: input.contactId,
    booth_assignment_id: input.boothAssignmentId?.trim() || null,
    rating: input.rating,
    would_invite_again: input.wouldInviteAgain,
    notes: input.notes?.trim() || null,
    reviewed_by: user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("vendor_hub_participation_evaluations")
    .upsert(payload, { onConflict: "vendor_hub_event_id,contact_id" })
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(VENDOR_HUB_ROUTES.events.evaluations(input.eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.detail(input.eventId))
  revalidatePath(VENDOR_HUB_ROUTES.network.history)
  revalidatePath(`/contacts/${input.contactId}`)

  return data
}
