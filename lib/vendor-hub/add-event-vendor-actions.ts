"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"
import type { VendorHubParticipantLifecycleStatus } from "@/lib/vendor-hub/vendor-hub-types"
import { refreshContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"

export type AddVendorToEventInput = {
  eventId: string
  contactId: string
  businessName: string
  vendorTypeId?: string | null
  vendorTypeName?: string | null
  boothId?: string | null
  feeAmount?: number | null
  paymentMethod?: string | null
  paymentDate?: string | null
  productsServices?: string | null
  notes?: string | null
}

export type EventBoothOption = {
  id: string
  number: string
  status: string | null
  location: string | null
}

async function ensureVendorApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  contactId: string,
  businessName: string,
  vendorTypeId: string | null,
  productsServices: string | null
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

  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name, email, phone")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const nextFormData: Record<string, unknown> = {
    ...((existing?.form_data && typeof existing.form_data === "object"
      ? existing.form_data
      : {}) as Record<string, unknown>),
    business_name: businessName,
  }
  if (vendorTypeId) nextFormData.vendor_type_id = vendorTypeId
  if (productsServices) nextFormData.products_services = productsServices

  if (existing?.id) {
    const { error } = await supabase
      .from("applications")
      .update({
        form_data: nextFormData,
        status: "approved",
        applicant_name: contact?.full_name || businessName,
        applicant_email: contact?.email || null,
        applicant_phone: contact?.phone || null,
      })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
    return existing.id as string
  }

  const { data: created, error } = await supabase
    .from("applications")
    .insert({
      organization_id: organizationId,
      application_type: VENDOR_ORG_APPLICATION_TYPE,
      module_owner: VENDOR_ORG_APPLICATION_MODULE,
      contact_id: contactId,
      applicant_name: contact?.full_name || businessName,
      applicant_email: contact?.email || null,
      applicant_phone: contact?.phone || null,
      status: "approved",
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      form_data: nextFormData,
      notes: "Created when adding vendor to bazaar event",
    })
    .select("id")
    .single()

  if (error || !created) {
    throw new Error(error?.message || "Could not create vendor application.")
  }

  return created.id as string
}

async function ensureVendorRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  contactId: string
) {
  const { data: existing } = await supabase
    .from("contact_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", "vendor")
    .maybeSingle()

  if (existing?.id) return

  const { error } = await supabase.from("contact_roles").insert({
    organization_id: organizationId,
    contact_id: contactId,
    role: "vendor",
  })
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message)
  }
}

export async function createVendorInNetworkAction(input: {
  contactId: string
  businessName: string
  vendorTypeId?: string | null
  productsServices?: string | null
}) {
  try {
    await requireVendorHubManage()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false as const, error: "No organization selected." }
    }

    const contactId = input.contactId.trim()
    const businessName = input.businessName.trim()
    if (!contactId) return { success: false as const, error: "Select a contact." }
    if (!businessName) return { success: false as const, error: "Business name is required." }

    const vendorTypeId = input.vendorTypeId?.trim() || null
    const productsServices = input.productsServices?.trim() || null

    const supabase = await createClient()

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("id", contactId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (contactError || !contact) {
      return { success: false as const, error: "Contact not found." }
    }

    await ensureVendorApplication(
      supabase,
      organizationId,
      contactId,
      businessName,
      vendorTypeId,
      productsServices
    )
    await ensureVendorRole(supabase, organizationId, contactId)

    try {
      await refreshContactAffiliations(contactId)
    } catch (syncError) {
      console.warn("createVendorInNetwork affiliation sync:", syncError)
    }

    revalidatePath(VENDOR_HUB_ROUTES.network.vendors)
    revalidatePath(VENDOR_HUB_ROUTES.network.vendor(contactId))

    const contactName = (contact.full_name as string | null)?.trim() || "Unnamed"

    return {
      success: true as const,
      vendor: {
        contactId,
        businessName,
        contactName,
        email: (contact.email as string | null) ?? null,
        phone: (contact.phone as string | null) ?? null,
        vendorTypeId,
      },
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not create vendor.",
    }
  }
}

export async function getEventBoothOptionsAction(
  eventId: string
): Promise<{ success: true; booths: EventBoothOption[] } | { success: false; error: string }> {
  try {
    await requireVendorHubManage()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) return { success: false, error: "No organization selected." }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("vendor_hub_booths")
      .select("id, number, status, location")
      .eq("event_id", eventId)
      .order("number", { ascending: true })

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      booths: (data || []).map((row) => ({
        id: row.id as string,
        number: String(row.number ?? ""),
        status: (row.status as string | null) ?? null,
        location: (row.location as string | null) ?? null,
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load booths.",
    }
  }
}

export async function addVendorToEventAction(input: AddVendorToEventInput) {
  try {
    await requireVendorHubManage()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false as const, error: "No organization selected." }
    }

    const eventId = input.eventId.trim()
    const contactId = input.contactId.trim()
    const businessName = input.businessName.trim()
    if (!eventId) return { success: false as const, error: "Event is required." }
    if (!contactId) return { success: false as const, error: "Select a contact." }
    if (!businessName) return { success: false as const, error: "Business name is required." }

    const feeAmount =
      input.feeAmount != null && Number.isFinite(Number(input.feeAmount))
        ? Number(input.feeAmount)
        : 0
    const vendorTypeName = input.vendorTypeName?.trim() || null
    const vendorTypeId = input.vendorTypeId?.trim() || null
    const boothId = input.boothId?.trim() || null
    const productsServices = input.productsServices?.trim() || null
    const extraNotes = input.notes?.trim() || null
    const paymentMethod = input.paymentMethod?.trim() || "manual"
    const paymentDate =
      input.paymentDate?.trim() || new Date().toISOString().slice(0, 10)

    const lifecycleStatus: VendorHubParticipantLifecycleStatus =
      feeAmount > 0 ? "paid" : boothId ? "assigned" : "approved"

    const supabase = await createClient()

    const { data: event, error: eventError } = await supabase
      .from("vendor_hub_events")
      .select("id, organization_id")
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (eventError || !event) {
      return { success: false as const, error: "Event not found." }
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (contactError || !contact) {
      return { success: false as const, error: "Contact not found." }
    }

    const applicationId = await ensureVendorApplication(
      supabase,
      organizationId,
      contactId,
      businessName,
      vendorTypeId,
      productsServices
    )
    await ensureVendorRole(supabase, organizationId, contactId)

    try {
      await refreshContactAffiliations(contactId)
    } catch (syncError) {
      console.warn("addVendorToEvent affiliation sync:", syncError)
    }

    const participantNotes = [
      vendorTypeName ? `category=${vendorTypeName}` : null,
      extraNotes,
    ]
      .filter(Boolean)
      .join("\n")

    const { data: existingParticipant } = await supabase
      .from("vendor_hub_participant_status")
      .select("id, notes")
      .eq("organization_id", organizationId)
      .eq("vendor_hub_event_id", eventId)
      .eq("contact_id", contactId)
      .maybeSingle()

    if (existingParticipant?.id) {
      const { error } = await supabase
        .from("vendor_hub_participant_status")
        .update({
          lifecycle_status: lifecycleStatus,
          application_id: applicationId,
          notes: [existingParticipant.notes, participantNotes].filter(Boolean).join("\n").trim() || null,
        })
        .eq("id", existingParticipant.id)
      if (error) return { success: false as const, error: error.message }
    } else {
      const { error } = await supabase.from("vendor_hub_participant_status").insert({
        organization_id: organizationId,
        vendor_hub_event_id: eventId,
        contact_id: contactId,
        application_id: applicationId,
        lifecycle_status: lifecycleStatus,
        notes: participantNotes || null,
      })
      if (error) return { success: false as const, error: error.message }
    }

    let assignmentId: string | null = null
    if (boothId) {
      const { data: booth } = await supabase
        .from("vendor_hub_booths")
        .select("id, status")
        .eq("id", boothId)
        .eq("event_id", eventId)
        .maybeSingle()

      if (!booth) {
        return { success: false as const, error: "Selected booth was not found for this event." }
      }

      const { data: existingAssignment } = await supabase
        .from("vendor_hub_booth_assignments")
        .select("id")
        .eq("event_id", eventId)
        .eq("booth_id", boothId)
        .maybeSingle()

      if (existingAssignment?.id) {
        return {
          success: false as const,
          error: "That booth is already assigned. Choose another booth or leave booth blank.",
        }
      }

      const { data: assignment, error: assignmentError } = await supabase
        .from("vendor_hub_booth_assignments")
        .insert({
          event_id: eventId,
          booth_id: boothId,
          contact_id: contactId,
          fee_amount: feeAmount > 0 ? feeAmount : null,
          status: feeAmount > 0 ? "confirmed" : "assigned",
        })
        .select("id")
        .single()

      if (assignmentError || !assignment) {
        return {
          success: false as const,
          error: assignmentError?.message || "Could not assign booth.",
        }
      }

      assignmentId = assignment.id as string
      await supabase
        .from("vendor_hub_booths")
        .update({ status: "assigned" })
        .eq("id", boothId)
    }

    if (feeAmount > 0) {
      const paymentNotes = [
        vendorTypeName ? `category=${vendorTypeName}` : null,
        `method=${paymentMethod}`,
        extraNotes,
      ]
        .filter(Boolean)
        .join("\n")

      const { error: paymentError } = await supabase.from("vendor_hub_payments").insert({
        event_id: eventId,
        booth_assignment_id: assignmentId,
        contact_id: contactId,
        amount: feeAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        payment_type: "payment",
        notes: paymentNotes || null,
      })

      if (paymentError) {
        return { success: false as const, error: paymentError.message }
      }
    }

    revalidatePath(VENDOR_HUB_ROUTES.events.booths(eventId))
    revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
    revalidatePath(VENDOR_HUB_ROUTES.network.vendors)
    revalidatePath(VENDOR_HUB_ROUTES.network.vendor(contactId))

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not add vendor to event.",
    }
  }
}

export type UpdateEventVendorRegistrationInput = {
  eventId: string
  contactId: string
  businessName: string
  vendorTypeId?: string | null
  vendorTypeName?: string | null
  boothId?: string | null
  /** Target net fee / amount paid for this event registration. */
  feeAmount?: number | null
  paymentMethod?: string | null
  paymentDate?: string | null
  notes?: string | null
}

async function getNetPaidForContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  contactId: string
) {
  const { data: payments } = await supabase
    .from("vendor_hub_payments")
    .select("amount, payment_type")
    .eq("event_id", eventId)
    .eq("contact_id", contactId)

  return (payments || []).reduce((sum, payment) => {
    const amount = Number(payment.amount || 0)
    if (!Number.isFinite(amount)) return sum
    if ((payment.payment_type as string | null) === "refund") {
      return sum - Math.abs(amount)
    }
    return sum + amount
  }, 0)
}

export async function updateEventVendorRegistrationAction(
  input: UpdateEventVendorRegistrationInput
) {
  try {
    await requireVendorHubManage()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false as const, error: "No organization selected." }
    }

    const eventId = input.eventId.trim()
    const contactId = input.contactId.trim()
    const businessName = input.businessName.trim()
    if (!eventId || !contactId) {
      return { success: false as const, error: "Event and vendor are required." }
    }
    if (!businessName) {
      return { success: false as const, error: "Business name is required." }
    }

    const feeAmount =
      input.feeAmount != null && Number.isFinite(Number(input.feeAmount))
        ? Math.max(0, Number(input.feeAmount))
        : 0
    const vendorTypeName = input.vendorTypeName?.trim() || null
    const vendorTypeId = input.vendorTypeId?.trim() || null
    const boothId = input.boothId?.trim() || null
    const extraNotes = input.notes?.trim() || null
    const paymentMethod = input.paymentMethod?.trim() || "manual"
    const paymentDate =
      input.paymentDate?.trim() || new Date().toISOString().slice(0, 10)

    const supabase = await createClient()

    const { data: event } = await supabase
      .from("vendor_hub_events")
      .select("id")
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (!event) return { success: false as const, error: "Event not found." }

    await ensureVendorApplication(
      supabase,
      organizationId,
      contactId,
      businessName,
      vendorTypeId,
      null
    )

    const participantNotes = [vendorTypeName ? `category=${vendorTypeName}` : null, extraNotes]
      .filter(Boolean)
      .join("\n")

    const netPaid = await getNetPaidForContact(supabase, eventId, contactId)
    const lifecycleStatus: VendorHubParticipantLifecycleStatus =
      feeAmount > 0 || netPaid > 0
        ? feeAmount > 0 && netPaid + 0.001 >= feeAmount
          ? "paid"
          : feeAmount > netPaid
            ? "payment_pending"
            : "paid"
        : boothId
          ? "assigned"
          : "approved"

    const { data: existingParticipant } = await supabase
      .from("vendor_hub_participant_status")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("vendor_hub_event_id", eventId)
      .eq("contact_id", contactId)
      .maybeSingle()

    if (existingParticipant?.id) {
      const { error } = await supabase
        .from("vendor_hub_participant_status")
        .update({
          lifecycle_status: lifecycleStatus,
          notes: participantNotes || null,
        })
        .eq("id", existingParticipant.id)
      if (error) return { success: false as const, error: error.message }
    } else {
      const { error } = await supabase.from("vendor_hub_participant_status").insert({
        organization_id: organizationId,
        vendor_hub_event_id: eventId,
        contact_id: contactId,
        lifecycle_status: lifecycleStatus,
        notes: participantNotes || null,
      })
      if (error) return { success: false as const, error: error.message }
    }

    const { data: existingAssignment } = await supabase
      .from("vendor_hub_booth_assignments")
      .select("id, booth_id, status")
      .eq("event_id", eventId)
      .eq("contact_id", contactId)
      .maybeSingle()

    let assignmentId = (existingAssignment?.id as string | null) ?? null
    const previousBoothId = (existingAssignment?.booth_id as string | null) ?? null

    if (boothId) {
      const { data: booth } = await supabase
        .from("vendor_hub_booths")
        .select("id")
        .eq("id", boothId)
        .eq("event_id", eventId)
        .maybeSingle()

      if (!booth) {
        return { success: false as const, error: "Selected booth was not found for this event." }
      }

      const { data: conflict } = await supabase
        .from("vendor_hub_booth_assignments")
        .select("id, contact_id")
        .eq("event_id", eventId)
        .eq("booth_id", boothId)
        .maybeSingle()

      if (conflict?.id && conflict.contact_id !== contactId) {
        return {
          success: false as const,
          error: "That booth is already assigned to another vendor.",
        }
      }

      if (assignmentId) {
        const { error } = await supabase
          .from("vendor_hub_booth_assignments")
          .update({
            booth_id: boothId,
            fee_amount: feeAmount > 0 ? feeAmount : null,
            status:
              existingAssignment?.status === "cancelled"
                ? feeAmount > 0
                  ? "confirmed"
                  : "assigned"
                : feeAmount > 0 || netPaid > 0
                  ? "confirmed"
                  : "assigned",
          })
          .eq("id", assignmentId)
        if (error) return { success: false as const, error: error.message }
      } else {
        const { data: created, error } = await supabase
          .from("vendor_hub_booth_assignments")
          .insert({
            event_id: eventId,
            booth_id: boothId,
            contact_id: contactId,
            fee_amount: feeAmount > 0 ? feeAmount : null,
            status: feeAmount > 0 || netPaid > 0 ? "confirmed" : "assigned",
          })
          .select("id")
          .single()
        if (error || !created) {
          return {
            success: false as const,
            error: error?.message || "Could not assign booth.",
          }
        }
        assignmentId = created.id as string
      }

      await supabase.from("vendor_hub_booths").update({ status: "assigned" }).eq("id", boothId)

      if (previousBoothId && previousBoothId !== boothId) {
        await supabase
          .from("vendor_hub_booths")
          .update({ status: "available" })
          .eq("id", previousBoothId)
      }
    } else if (assignmentId) {
      const { error } = await supabase
        .from("vendor_hub_booth_assignments")
        .update({
          booth_id: null,
          fee_amount: feeAmount > 0 ? feeAmount : null,
          status: feeAmount > 0 || netPaid > 0 ? "confirmed" : "assigned",
        })
        .eq("id", assignmentId)

      if (error) {
        // booth_id may be NOT NULL — delete assignment instead
        await supabase.from("vendor_hub_booth_assignments").delete().eq("id", assignmentId)
        assignmentId = null
        if (previousBoothId) {
          await supabase
            .from("vendor_hub_booths")
            .update({ status: "available" })
            .eq("id", previousBoothId)
        }
      } else if (previousBoothId) {
        await supabase
          .from("vendor_hub_booths")
          .update({ status: "available" })
          .eq("id", previousBoothId)
      }
    }

    const delta = Math.round((feeAmount - netPaid) * 100) / 100
    if (delta > 0.001) {
      const { error: paymentError } = await supabase.from("vendor_hub_payments").insert({
        event_id: eventId,
        booth_assignment_id: assignmentId,
        contact_id: contactId,
        amount: delta,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        payment_type: "payment",
        notes: [
          vendorTypeName ? `category=${vendorTypeName}` : null,
          `method=${paymentMethod}`,
          "Registration fee update",
        ]
          .filter(Boolean)
          .join("\n"),
      })
      if (paymentError) return { success: false as const, error: paymentError.message }
    } else if (delta < -0.001) {
      const { error: refundError } = await supabase.from("vendor_hub_payments").insert({
        event_id: eventId,
        booth_assignment_id: assignmentId,
        contact_id: contactId,
        amount: Math.abs(delta),
        payment_method: paymentMethod,
        payment_date: paymentDate,
        payment_type: "refund",
        notes: "Registration fee adjustment refund",
      })
      if (refundError) return { success: false as const, error: refundError.message }
    }

    revalidatePath(VENDOR_HUB_ROUTES.events.booths(eventId))
    revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
    revalidatePath(VENDOR_HUB_ROUTES.network.vendor(contactId))

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Could not update vendor registration.",
    }
  }
}

export async function removeVendorFromEventAction(input: {
  eventId: string
  contactId: string
  refundFee?: boolean
}) {
  try {
    await requireVendorHubManage()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false as const, error: "No organization selected." }
    }

    const eventId = input.eventId.trim()
    const contactId = input.contactId.trim()
    if (!eventId || !contactId) {
      return { success: false as const, error: "Event and vendor are required." }
    }

    const supabase = await createClient()

    const { data: event } = await supabase
      .from("vendor_hub_events")
      .select("id")
      .eq("id", eventId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (!event) return { success: false as const, error: "Event not found." }

    const { data: assignment } = await supabase
      .from("vendor_hub_booth_assignments")
      .select("id, booth_id")
      .eq("event_id", eventId)
      .eq("contact_id", contactId)
      .maybeSingle()

    const assignmentId = (assignment?.id as string | null) ?? null
    const boothId = (assignment?.booth_id as string | null) ?? null
    const netPaid = await getNetPaidForContact(supabase, eventId, contactId)

    if (input.refundFee && netPaid > 0.001) {
      const { error: refundError } = await supabase.from("vendor_hub_payments").insert({
        event_id: eventId,
        booth_assignment_id: assignmentId,
        contact_id: contactId,
        amount: netPaid,
        payment_method: "refund",
        payment_date: new Date().toISOString().slice(0, 10),
        payment_type: "refund",
        notes: "Refund on removal from event",
      })
      if (refundError) return { success: false as const, error: refundError.message }
    }

    if (assignmentId) {
      await supabase
        .from("vendor_hub_booth_assignments")
        .update({ status: "cancelled" })
        .eq("id", assignmentId)
    }

    if (boothId) {
      await supabase.from("vendor_hub_booths").update({ status: "available" }).eq("id", boothId)
    }

    const { data: participant } = await supabase
      .from("vendor_hub_participant_status")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("vendor_hub_event_id", eventId)
      .eq("contact_id", contactId)
      .maybeSingle()

    if (participant?.id) {
      const { error } = await supabase
        .from("vendor_hub_participant_status")
        .update({ lifecycle_status: "cancelled" })
        .eq("id", participant.id)
      if (error) return { success: false as const, error: error.message }
    } else {
      const { error } = await supabase.from("vendor_hub_participant_status").insert({
        organization_id: organizationId,
        vendor_hub_event_id: eventId,
        contact_id: contactId,
        lifecycle_status: "cancelled",
        notes: "Removed from event",
      })
      if (error) return { success: false as const, error: error.message }
    }

    revalidatePath(VENDOR_HUB_ROUTES.events.booths(eventId))
    revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
    revalidatePath(VENDOR_HUB_ROUTES.network.vendor(contactId))

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Could not remove vendor from event.",
    }
  }
}
