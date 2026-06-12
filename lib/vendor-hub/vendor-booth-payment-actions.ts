"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { resolveCustomerPortalActor } from "@/lib/auth/customer-portal-session"
import { linkVendorContactsForCurrentUser } from "@/lib/vendor-hub/link-vendor-contact-auth"
import type { VendorBoothPaymentDue } from "@/lib/vendor-hub/vendor-portal-types"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

function computeAssignmentBalance(
  feeAmount: number,
  payments: { amount: number; payment_type: string | null }[]
): { paidAmount: number; balanceDue: number } {
  const paidAmount = payments.reduce((sum, payment) => {
    const amount = Number(payment.amount ?? 0)
    if (payment.payment_type === "refund") {
      return sum - amount
    }
    return sum + amount
  }, 0)

  const balanceDue = Math.max(0, feeAmount - paidAmount)
  return { paidAmount, balanceDue }
}

export async function getVendorPaymentDueForCurrentUser(): Promise<VendorBoothPaymentDue[]> {
  const actor = await resolveCustomerPortalActor()

  if (!actor) {
    return []
  }

  const { userId, supabase, session } = actor

  if (!session.isSupportSession) {
    await linkVendorContactsForCurrentUser(supabase)
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, organization_id, organization_name, company_name")
    .eq("auth_user_id", userId)

  if (!contacts?.length) {
    return []
  }

  const contactIds = contacts.map((row) => row.id as string)
  const orgIds = [...new Set(contacts.map((row) => row.organization_id as string))]

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", orgIds)

  const orgNameById = new Map(
    (organizations ?? []).map((row) => [row.id as string, row.name as string])
  )

  const { data: assignments, error: assignmentsError } = await supabase
    .from("vendor_hub_booth_assignments")
    .select("id, event_id, booth_id, contact_id, fee_amount, status, created_at")
    .in("contact_id", contactIds)
    .in("status", ["reserved", "assigned", "confirmed"])
    .order("created_at", { ascending: false })

  if (assignmentsError || !assignments?.length) {
    if (assignmentsError) {
      console.error("getVendorPaymentDueForCurrentUser assignments:", assignmentsError)
    }
    return []
  }

  const assignmentIds = assignments.map((row) => row.id as string)
  const eventIds = [...new Set(assignments.map((row) => row.event_id).filter(Boolean))] as string[]
  const boothIds = [...new Set(assignments.map((row) => row.booth_id).filter(Boolean))] as string[]

  const [paymentsResult, eventsResult, boothsResult] = await Promise.all([
    supabase
      .from("vendor_hub_payments")
      .select("booth_assignment_id, amount, payment_type")
      .in("booth_assignment_id", assignmentIds),
    eventIds.length > 0
      ? supabase
          .from("vendor_hub_events")
          .select("id, name, event_date, organization_id")
          .in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    boothIds.length > 0
      ? supabase.from("vendor_hub_booths").select("id, number").in("id", boothIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const paymentsByAssignment = new Map<string, { amount: number; payment_type: string | null }[]>()
  for (const payment of paymentsResult.data ?? []) {
    const key = payment.booth_assignment_id as string
    const list = paymentsByAssignment.get(key) ?? []
    list.push({
      amount: Number(payment.amount ?? 0),
      payment_type: payment.payment_type as string | null,
    })
    paymentsByAssignment.set(key, list)
  }

  const eventById = new Map((eventsResult.data ?? []).map((row) => [row.id as string, row]))
  const boothNumberById = new Map(
    (boothsResult.data ?? []).map((row) => [row.id as string, row.number as string])
  )

  const dueItems: VendorBoothPaymentDue[] = []

  for (const assignment of assignments) {
    const feeAmount = Number(assignment.fee_amount ?? 0)
    const payments = paymentsByAssignment.get(assignment.id as string) ?? []
    const { paidAmount, balanceDue } = computeAssignmentBalance(feeAmount, payments)
    const assignmentStatus = (assignment.status as string | null) ?? null

    const needsAction = balanceDue > 0 || assignmentStatus === "reserved"
    if (!needsAction) {
      continue
    }

    const event = assignment.event_id ? eventById.get(assignment.event_id as string) : null
    const contact = contacts.find((row) => row.id === assignment.contact_id)
    const organizationId =
      (event?.organization_id as string | undefined) ??
      (contact?.organization_id as string | undefined) ??
      ""

    dueItems.push({
      assignmentId: assignment.id as string,
      eventId: (assignment.event_id as string | null) ?? "",
      eventName: (event?.name as string) ?? "Bazaar event",
      eventDate: (event?.event_date as string | null) ?? null,
      organizationId,
      organizationName:
        orgNameById.get(organizationId) ??
        contact?.organization_name ??
        contact?.company_name ??
        "Community organization",
      boothNumber: assignment.booth_id
        ? boothNumberById.get(assignment.booth_id as string) ?? null
        : null,
      feeAmount,
      paidAmount,
      balanceDue,
      assignmentStatus,
    })
  }

  dueItems.sort((a, b) => {
    const aTime = a.eventDate ? new Date(a.eventDate).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.eventDate ? new Date(b.eventDate).getTime() : Number.MAX_SAFE_INTEGER
    return aTime - bTime
  })

  return dueItems
}

export async function payVendorBoothFee(input: {
  assignmentId: string
  paymentMethod?: string
}): Promise<{ paymentId: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in to pay.")
  }

  const { data: paymentId, error } = await supabase.rpc("pay_vendor_booth_fee", {
    p_assignment_id: input.assignmentId,
    p_payment_method: input.paymentMethod?.trim() || "online",
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data: assignment } = await supabase
    .from("vendor_hub_booth_assignments")
    .select("event_id")
    .eq("id", input.assignmentId)
    .maybeSingle()

  revalidatePath("/customer/bazaars")
  if (assignment?.event_id) {
    revalidatePath(VENDOR_HUB_ROUTES.events.payments(assignment.event_id as string))
    revalidatePath(VENDOR_HUB_ROUTES.events.applications(assignment.event_id as string))
    revalidatePath(VENDOR_HUB_ROUTES.events.booths(assignment.event_id as string))
  }

  return { paymentId: (paymentId as string | null) ?? null }
}
