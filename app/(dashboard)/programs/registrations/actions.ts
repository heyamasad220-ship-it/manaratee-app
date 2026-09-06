"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  canManageEnrollment,
  canManageWaitlist,
} from "@/lib/programs/program-access"
import {
  advanceEnrollmentStatusRpc,
  cancelEnrollmentRpc,
  promoteWaitlistRpc,
  removeWaitlistRpc,
} from "@/lib/programs/program-lifecycle-actions"

function refreshAndRedirect(path: string): never {
  revalidatePath("/programs/registrations")
  revalidatePath(path)
  redirect(path)
}

async function requireOrganizationId() {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return organizationId
}

async function assertCanManageEnrollmentOrThrow(enrollmentId: string) {
  if (!(await canManageEnrollment(enrollmentId))) {
    throw new Error("You do not have permission to manage this registration.")
  }
}

async function assertCanManageWaitlistOrThrow(waitlistId: string) {
  if (!(await canManageWaitlist(waitlistId))) {
    throw new Error("You do not have permission to manage this waitlist entry.")
  }
}

export async function markEnrollmentPaymentAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const paymentStatus = String(formData.get("payment_status") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  const allowedStatuses = ["pending", "paid", "partial", "waived", "refunded"]

  if (!enrollmentId || !allowedStatuses.includes(paymentStatus)) {
    refreshAndRedirect(redirectTo)
  }
  await assertCanManageEnrollmentOrThrow(enrollmentId)

  const supabase = await createClient()

  const updatePayload: {
    payment_status: string
    updated_at: string
    amount_paid?: number
  } = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }

  if (paymentStatus === "paid") {
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select("total_amount")
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (enrollmentError) {
      throw new Error(enrollmentError.message)
    }

    const enrollment = enrollmentData as { total_amount: number | null } | null
    updatePayload.amount_paid = Number(enrollment?.total_amount || 0)
  }

  const { error } = await supabase
    .from("program_enrollments")
    .update(updatePayload)
    .eq("organization_id", organizationId)
    .eq("id", enrollmentId)

  if (error) {
    throw new Error(error.message)
  }

  refreshAndRedirect(redirectTo)
}

export async function cancelEnrollmentAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const cancelReason = String(formData.get("cancel_reason") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  if (!enrollmentId) {
    refreshAndRedirect(redirectTo)
  }
  await assertCanManageEnrollmentOrThrow(enrollmentId)

  await cancelEnrollmentRpc({
    organizationId,
    enrollmentId,
    cancelReason: cancelReason || null,
  })

  refreshAndRedirect(redirectTo)
}

export async function advanceEnrollmentStatusAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const targetStatus = String(formData.get("target_status") || "")
  const reason = String(formData.get("reason") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  const allowedTargets = ["enrolled", "active", "completed"]

  if (!enrollmentId || !allowedTargets.includes(targetStatus)) {
    refreshAndRedirect(redirectTo)
  }
  await assertCanManageEnrollmentOrThrow(enrollmentId)

  await advanceEnrollmentStatusRpc({
    organizationId,
    enrollmentId,
    targetStatus,
    reason: reason || null,
  })

  refreshAndRedirect(redirectTo)
}

export async function removeWaitlistEntryAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const waitlistId = String(formData.get("waitlist_id") || "")
  const reason = String(formData.get("reason") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  if (!waitlistId) {
    refreshAndRedirect(redirectTo)
  }
  await assertCanManageWaitlistOrThrow(waitlistId)

  await removeWaitlistRpc({
    organizationId,
    waitlistId,
    reason: reason || null,
  })

  revalidatePath("/programs/registrations")
  revalidatePath("/programs/reports")
  revalidatePath(redirectTo)
  redirect(redirectTo)
}

export async function promoteWaitlistAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const waitlistId = String(formData.get("waitlist_id") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  if (!waitlistId) {
    refreshAndRedirect(redirectTo)
  }
  await assertCanManageWaitlistOrThrow(waitlistId)

  const result = await promoteWaitlistRpc({
    organizationId,
    waitlistId,
  })

  revalidatePath("/programs/registrations")
  revalidatePath("/programs/reports")
  revalidatePath(`/programs/registrations/waitlist/${waitlistId}`)

  if (result.enrollment_id) {
    redirect(`/programs/registrations/${result.enrollment_id}`)
  }

  redirect(redirectTo)
}

/** @deprecated Use cancelEnrollmentAction or advanceEnrollmentStatusAction */
export async function updateEnrollmentStatusAction(formData: FormData) {
  const status = String(formData.get("status") || "").toLowerCase()

  if (status === "cancelled") {
    return cancelEnrollmentAction(formData)
  }

  const nextFormData = new FormData()
  for (const [key, value] of formData.entries()) {
    nextFormData.append(key, value)
  }
  nextFormData.set("target_status", status)

  return advanceEnrollmentStatusAction(nextFormData)
}

/** @deprecated Use promoteWaitlistAction */
export async function moveWaitlistToEnrollmentAction(formData: FormData) {
  return promoteWaitlistAction(formData)
}
