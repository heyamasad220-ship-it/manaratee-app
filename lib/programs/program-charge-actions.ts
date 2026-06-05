"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isBillingSchemaMissingError } from "@/lib/programs/program-billing-schema"
import { canEditEnrollmentCharges } from "@/lib/programs/registration-display-helpers"

async function requireOrganizationId() {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return organizationId
}

function revalidateRegistration(registrationId: string, programId?: string) {
  revalidatePath(`/programs/registrations/${registrationId}`)
  revalidatePath("/programs/registrations")
  if (programId) {
    revalidatePath(`/programs/${programId}/billing`)
  }
}

function mapRpcError(error: { message: string }) {
  if (isBillingSchemaMissingError(error.message)) {
    return "Charge ledger migrations are not applied yet. Run scripts/020–023 in Supabase."
  }

  return error.message
}

async function assertEnrollmentChargesEditable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  enrollmentId: string
) {
  if (!enrollmentId) {
    return { ok: false as const, error: "Missing enrollment" }
  }

  const { data: enrollment, error } = await supabase
    .from("program_enrollments")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("id", enrollmentId)
    .maybeSingle()

  if (error || !enrollment) {
    return { ok: false as const, error: "Enrollment not found" }
  }

  if (!canEditEnrollmentCharges(enrollment.status as string)) {
    return {
      ok: false as const,
      error: "Fees cannot be changed for a cancelled or closed registration.",
    }
  }

  return { ok: true as const }
}

export async function ensureEnrollmentChargeAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const programId = String(formData.get("program_id") || "")

  if (!enrollmentId) {
    return { ok: false, error: "Missing enrollment" }
  }

  const supabase = await createClient()
  const editable = await assertEnrollmentChargesEditable(
    supabase,
    organizationId,
    enrollmentId
  )
  if (!editable.ok) {
    return editable
  }

  const { data, error } = await supabase.rpc("staff_ensure_enrollment_charge", {
    p_organization_id: organizationId,
    p_enrollment_id: enrollmentId,
  })

  if (error) {
    return { ok: false, error: mapRpcError(error) }
  }

  revalidateRegistration(enrollmentId, programId || undefined)

  return { ok: true, chargeId: data as string }
}

/** Backfill charge ledger rows for enrollments that pre-date migration 023. */
export async function backfillEnrollmentChargesAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const programId = String(formData.get("program_id") || "")
  const limit = Number(formData.get("limit") || 200)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("staff_backfill_enrollment_charges", {
    p_organization_id: organizationId,
    p_limit: limit,
  })

  if (error) {
    return { ok: false, error: mapRpcError(error) }
  }

  revalidatePath("/programs/registrations")
  if (programId) {
    revalidatePath(`/programs/${programId}/billing`)
  }

  return { ok: true, created: (data as { created?: number })?.created ?? 0 }
}

export async function voidChargeLineAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const lineId = String(formData.get("line_id") || "")
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const programId = String(formData.get("program_id") || "")
  const reason = String(formData.get("reason") || "")

  if (!lineId) {
    return { ok: false, error: "Missing line item" }
  }

  const supabase = await createClient()
  const editable = await assertEnrollmentChargesEditable(
    supabase,
    organizationId,
    enrollmentId
  )
  if (!editable.ok) {
    return editable
  }

  const { error } = await supabase.rpc("void_program_charge_line", {
    p_organization_id: organizationId,
    p_line_id: lineId,
    p_reason: reason || null,
  })

  if (error) {
    return { ok: false, error: mapRpcError(error) }
  }

  revalidateRegistration(enrollmentId, programId || undefined)

  return { ok: true }
}

export async function adjustChargeLineAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const lineId = String(formData.get("line_id") || "")
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const programId = String(formData.get("program_id") || "")
  const unitAmount = Number(formData.get("unit_amount") || 0)
  const quantity = Number(formData.get("quantity") || 1)
  const reason = String(formData.get("reason") || "")

  if (!lineId) {
    return { ok: false, error: "Missing line item" }
  }

  const supabase = await createClient()
  const editable = await assertEnrollmentChargesEditable(
    supabase,
    organizationId,
    enrollmentId
  )
  if (!editable.ok) {
    return editable
  }

  const { error } = await supabase.rpc("adjust_program_charge_line", {
    p_organization_id: organizationId,
    p_line_id: lineId,
    p_unit_amount: unitAmount,
    p_quantity: quantity,
    p_amount: null,
    p_reason: reason || null,
  })

  if (error) {
    return { ok: false, error: mapRpcError(error) }
  }

  revalidateRegistration(enrollmentId, programId || undefined)

  return { ok: true }
}

export async function addChargeLineAction(formData: FormData) {
  const organizationId = await requireOrganizationId()
  const chargeId = String(formData.get("charge_id") || "")
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const programId = String(formData.get("program_id") || "")
  const lineType = String(formData.get("line_type") || "custom")
  const label = String(formData.get("label") || "")
  const unitAmount = Number(formData.get("unit_amount") || 0)
  const quantity = Number(formData.get("quantity") || 1)
  const reason = String(formData.get("reason") || "")

  if (!chargeId || !label) {
    return { ok: false, error: "Charge and label are required" }
  }

  const supabase = await createClient()
  const editable = await assertEnrollmentChargesEditable(
    supabase,
    organizationId,
    enrollmentId
  )
  if (!editable.ok) {
    return editable
  }

  const { error } = await supabase.rpc("add_program_charge_line", {
    p_organization_id: organizationId,
    p_charge_id: chargeId,
    p_line_type: lineType,
    p_label: label,
    p_unit_amount: unitAmount,
    p_quantity: quantity,
    p_reason: reason || null,
  })

  if (error) {
    return { ok: false, error: mapRpcError(error) }
  }

  revalidateRegistration(enrollmentId, programId || undefined)

  return { ok: true }
}
