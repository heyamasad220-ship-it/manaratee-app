"use server"

import { createClient } from "@/lib/supabase/server"
import type { ProgramOfferingType } from "@/lib/programs/program-offering-types"

type CreateDefaultOfferingInput = {
  organizationId: string
  programId: string
  programName: string
  startDate?: string | null
  endDate?: string | null
  enrollmentOpenDate?: string | null
  enrollmentCloseDate?: string | null
  programStatus?: string | null
}

export async function createDefaultOffering(input: CreateDefaultOfferingInput) {
  const supabase = await createClient()

  const offeringStatus =
    input.programStatus === "draft" ? "draft" : "active"

  const { data, error } = await supabase
    .from("program_offerings")
    .insert({
      organization_id: input.organizationId,
      program_id: input.programId,
      name: `${input.programName} — Default Offering`,
      is_default: true,
      offering_type: "standard" satisfies ProgramOfferingType,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      enrollment_open_date: input.enrollmentOpenDate ?? null,
      enrollment_close_date: input.enrollmentCloseDate ?? null,
      status: offeringStatus,
    })
    .select("id")
    .single()

  if (error) {
    console.error("createDefaultOffering:", error)
    throw new Error("Failed to create default program offering")
  }

  return data.id as string
}

export async function syncDefaultOfferingDates(input: {
  organizationId: string
  programId: string
  programName: string
  startDate?: string | null
  endDate?: string | null
  enrollmentOpenDate?: string | null
  enrollmentCloseDate?: string | null
  programStatus?: string | null
}) {
  const supabase = await createClient()

  const offeringStatus =
    input.programStatus === "draft" ? "draft" : "active"

  const { error } = await supabase
    .from("program_offerings")
    .update({
      name: `${input.programName} — Default Offering`,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      enrollment_open_date: input.enrollmentOpenDate ?? null,
      enrollment_close_date: input.enrollmentCloseDate ?? null,
      status: offeringStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("is_default", true)

  if (error) {
    console.error("syncDefaultOfferingDates:", error)
    throw new Error("Failed to sync default offering")
  }
}

export async function ensureDefaultOffering(input: CreateDefaultOfferingInput) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("program_offerings")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("is_default", true)
    .maybeSingle()

  if (existing?.id) {
    await syncDefaultOfferingDates(input)
    return existing.id as string
  }

  return createDefaultOffering(input)
}
