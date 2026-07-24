"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first_name: "Provider", last_name: "" }
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" }
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

function parseHourlyRate(formData: Record<string, unknown> | null | undefined): number | null {
  if (!formData) return null
  const raw = formData.hourlyRateMin ?? formData.hourly_rate_min ?? formData.hourlyRate
  if (raw == null) return null
  const parsed = Number(String(raw).replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100) / 100
}

function looksLikeChildcareStaff(row: {
  staff_type?: string | null
  position?: string | null
}): boolean {
  const staffType = (row.staff_type || "").toLowerCase()
  if (staffType === "childcare" || staffType === "childcare_provider") return true
  return /child\s*care|babysit/.test((row.position || "").toLowerCase())
}

/**
 * Ensures an approved childcare provider has an active staff row so hours can
 * post to department payroll. Idempotent when staff already exists.
 */
export async function ensureChildcareStaffFromApprovedApplication(input: {
  supabase: SupabaseClient
  organizationId: string
  contactId: string
  applicantName: string
  applicantEmail?: string | null
  applicantPhone?: string | null
  formData?: Record<string, unknown> | null
}): Promise<{ staffId: string; created: boolean }> {
  const { supabase, organizationId, contactId } = input

  const { data: existingStaff, error: existingError } = await supabase
    .from("staff")
    .select("id, staff_type, position, status, hourly_rate, pay_basis")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(existingError.message || "Could not check existing staff.")
  }

  const hourlyRate = parseHourlyRate(input.formData)

  if (existingStaff?.id) {
    const patch: Record<string, unknown> = {}
    const status = ((existingStaff.status as string) || "").toLowerCase()
    if (status && status !== "active") {
      patch.status = "active"
    }

    if (!looksLikeChildcareStaff(existingStaff)) {
      // Keep employment staff_type (full_time, etc.); identify childcare via position
      // so hour logging / payroll still match this person.
      const currentPosition = ((existingStaff.position as string | null) || "").trim()
      patch.position = currentPosition
        ? `${currentPosition} / Childcare Provider`
        : "Childcare Provider"
    }

    if (
      hourlyRate != null &&
      (existingStaff.hourly_rate == null || Number(existingStaff.hourly_rate) <= 0)
    ) {
      patch.hourly_rate = hourlyRate
      patch.pay_basis = "hourly"
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase
        .from("staff")
        .update(patch)
        .eq("id", existingStaff.id)
        .eq("organization_id", organizationId)

      if (updateError) {
        // Retry without pay columns if migration not applied.
        if (/hourly_rate|pay_basis/i.test(updateError.message || "")) {
          delete patch.hourly_rate
          delete patch.pay_basis
          if (Object.keys(patch).length > 0) {
            const retry = await supabase
              .from("staff")
              .update(patch)
              .eq("id", existingStaff.id)
              .eq("organization_id", organizationId)
            if (retry.error) {
              throw new Error(retry.error.message)
            }
          }
        } else {
          throw new Error(updateError.message)
        }
      }
    }

    await syncContactAffiliations(contactId, organizationId, supabase)
    return { staffId: existingStaff.id as string, created: false }
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name, email, phone")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const displayName =
    contact?.full_name?.trim() ||
    input.applicantName.trim() ||
    "Childcare Provider"
  const { first_name, last_name } = splitFullName(displayName)

  const insertPayload: Record<string, unknown> = {
    organization_id: organizationId,
    contact_id: contactId,
    first_name,
    last_name,
    email:
      (contact?.email as string | null)?.trim() ||
      input.applicantEmail?.trim() ||
      null,
    phone:
      (contact?.phone as string | null)?.trim() ||
      input.applicantPhone?.trim() ||
      null,
    staff_type: "childcare",
    status: "active",
    position: "Childcare Provider",
    pay_basis: "hourly",
    hire_date: new Date().toISOString().slice(0, 10),
  }

  if (hourlyRate != null) {
    insertPayload.hourly_rate = hourlyRate
  }

  const { data: created, error: insertError } = await supabase
    .from("staff")
    .insert(insertPayload)
    .select("id")
    .single()

  if (insertError || !created) {
    if (
      insertError &&
      /hourly_rate|pay_basis/i.test(insertError.message || "")
    ) {
      delete insertPayload.hourly_rate
      delete insertPayload.pay_basis
      const retry = await supabase
        .from("staff")
        .insert(insertPayload)
        .select("id")
        .single()
      if (retry.error || !retry.data) {
        throw new Error(retry.error?.message || "Could not create childcare staff.")
      }
      await syncContactAffiliations(contactId, organizationId, supabase)
      revalidateChildcareStaffPaths(contactId)
      return { staffId: retry.data.id as string, created: true }
    }
    throw new Error(insertError?.message || "Could not create childcare staff.")
  }

  await syncContactAffiliations(contactId, organizationId, supabase)
  revalidateChildcareStaffPaths(contactId)
  return { staffId: created.id as string, created: true }
}

function revalidateChildcareStaffPaths(contactId: string) {
  revalidatePath("/workforce")
  revalidatePath("/workforce/employees")
  revalidatePath("/workforce")
  revalidatePath("/finance/payroll")
  revalidatePath(`/contacts/${contactId}`)
}
