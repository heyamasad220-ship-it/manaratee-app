"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isBillingSchemaMissingError } from "@/lib/programs/program-billing-schema"

async function requireOrganizationId() {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return organizationId
}

function revalidateBilling(programId: string) {
  revalidatePath(`/programs/${programId}/billing`)
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath("/programs/registrations")
}

export async function waiveChargeScheduleAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const scheduleId = String(formData.get("schedule_id") || "")
  const programId = String(formData.get("program_id") || "")
  const reason = String(formData.get("reason") || "")
  const adminNotes = String(formData.get("admin_notes") || "")

  if (!scheduleId) {
    return { ok: false, error: "Missing schedule item" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("waive_charge_schedule_item", {
    p_organization_id: organizationId,
    p_schedule_id: scheduleId,
    p_reason: reason || null,
    p_admin_notes: adminNotes || null,
  })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return { ok: false, error: "Billing migrations are not applied yet. Run 020 and 021 in Supabase." }
    }
    return { ok: false, error: error.message }
  }

  if (programId) {
    revalidateBilling(programId)
  }

  return { ok: true }
}

export async function adjustChargeScheduleAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const scheduleId = String(formData.get("schedule_id") || "")
  const programId = String(formData.get("program_id") || "")
  const newAmount = Number(formData.get("new_amount") || 0)
  const reason = String(formData.get("reason") || "")
  const adminNotes = String(formData.get("admin_notes") || "")

  if (!scheduleId) {
    return { ok: false, error: "Missing schedule item" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("adjust_charge_schedule_item", {
    p_organization_id: organizationId,
    p_schedule_id: scheduleId,
    p_new_amount: newAmount,
    p_reason: reason || null,
    p_admin_notes: adminNotes || null,
  })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return { ok: false, error: "Billing migrations are not applied yet. Run 020 and 021 in Supabase." }
    }
    return { ok: false, error: error.message }
  }

  if (programId) {
    revalidateBilling(programId)
  }

  return { ok: true }
}

export async function addEnrollmentFeeAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const programId = String(formData.get("program_id") || "")
  const label = String(formData.get("label") || "")
  const amount = Number(formData.get("amount") || 0)
  const billingPeriodId = String(formData.get("billing_period_id") || "") || null
  const reason = String(formData.get("reason") || "")
  const adminNotes = String(formData.get("admin_notes") || "")

  if (!enrollmentId || !label) {
    return { ok: false, error: "Enrollment and label are required" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("add_enrollment_schedule_fee", {
    p_organization_id: organizationId,
    p_enrollment_id: enrollmentId,
    p_label: label,
    p_amount: amount,
    p_billing_period_id: billingPeriodId,
    p_due_date: null,
    p_reason: reason || null,
    p_admin_notes: adminNotes || null,
  })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return { ok: false, error: "Billing migrations are not applied yet. Run 020 and 021 in Supabase." }
    }
    return { ok: false, error: error.message }
  }

  if (programId) {
    revalidateBilling(programId)
  }

  return { ok: true }
}

export async function createBillingOverrideAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const offeringId = String(formData.get("offering_id") || "")
  const programId = String(formData.get("program_id") || "")
  const overrideType = String(formData.get("override_type") || "") as BillingOverrideType
  const label = String(formData.get("label") || "")
  const billingPeriodId = String(formData.get("billing_period_id") || "") || null
  const enrollmentId = String(formData.get("enrollment_id") || "") || null
  const amountRaw = formData.get("amount")
  const amount =
    amountRaw === null || amountRaw === "" ? null : Number(amountRaw)
  const reason = String(formData.get("reason") || "")
  const adminNotes = String(formData.get("admin_notes") || "")
  const applyToAll = formData.get("apply_to_all") === "true"

  if (!offeringId || !overrideType || !label) {
    return { ok: false, error: "Missing required override fields" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("create_offering_billing_override", {
    p_organization_id: organizationId,
    p_offering_id: offeringId,
    p_override_type: overrideType,
    p_label: label,
    p_billing_period_id: billingPeriodId,
    p_enrollment_id: enrollmentId,
    p_amount: amount,
    p_reason: reason || null,
    p_admin_notes: adminNotes || null,
    p_apply_to_all: applyToAll,
  })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return { ok: false, error: "Billing migrations are not applied yet. Run 020 and 021 in Supabase." }
    }
    return { ok: false, error: error.message }
  }

  if (programId) {
    revalidateBilling(programId)
  }

  return { ok: true }
}

export async function setOfferingBillingPeriodStatusesAction(input: {
  offeringId: string
  programId: string
  periodIds: string[]
  periodStatus: "active" | "skipped"
}) {
  const organizationId = await requireOrganizationId()
  const periodIds = input.periodIds.filter(Boolean)

  if (!input.offeringId || periodIds.length === 0) {
    return { ok: false as const, error: "Missing offering or periods" }
  }

  if (input.periodStatus !== "active" && input.periodStatus !== "skipped") {
    return { ok: false as const, error: "Invalid period status" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("set_offering_billing_period_statuses", {
    p_organization_id: organizationId,
    p_offering_id: input.offeringId,
    p_period_ids: periodIds,
    p_period_status: input.periodStatus,
  })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return {
        ok: false as const,
        error:
          "Billing migrations are not applied yet. Run 021 and 238 in Supabase.",
      }
    }

    const rpcMissing =
      error.message.includes("set_offering_billing_period_statuses") ||
      error.message.includes("Could not find the function") ||
      error.code === "PGRST202"

    if (!rpcMissing) {
      return { ok: false as const, error: error.message }
    }

    const { error: updateError } = await supabase
      .from("program_offering_billing_periods")
      .update({
        period_status: input.periodStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("offering_id", input.offeringId)
      .in("id", periodIds)

    if (updateError) {
      return { ok: false as const, error: updateError.message }
    }
  }

  if (input.programId) {
    revalidateBilling(input.programId)
  }

  return { ok: true as const }
}

export async function syncBillingPeriodsAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const offeringId = String(formData.get("offering_id") || "")
  const programId = String(formData.get("program_id") || "")

  if (!offeringId) {
    return { ok: false, error: "Missing offering" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("sync_offering_billing_periods", {
    p_organization_id: organizationId,
    p_offering_id: offeringId,
    p_default_tuition_amount: null,
    p_payment_due_day: null,
  })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return { ok: false, error: "Billing migrations are not applied yet. Run 020 and 021 in Supabase." }
    }
    return { ok: false, error: error.message }
  }

  if (programId) {
    revalidateBilling(programId)
  }

  return { ok: true }
}
