"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDefaultOfferingForProgram } from "@/lib/programs/program-offering-queries"
import type { ProgramSessionStatus } from "@/lib/programs/program-session-types"

type ProgramSessionFieldsInput = {
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  registration_open_date?: string | null
  registration_close_date?: string | null
  capacity?: number
  price?: number
  enable_waitlist?: boolean
  waitlist_capacity?: number | null
  status?: ProgramSessionStatus
}

type CreateProgramSessionInput = ProgramSessionFieldsInput & {
  program_id: string
  offering_id?: string | null
}

type UpdateProgramSessionInput = ProgramSessionFieldsInput & {
  session_id: string
  program_id: string
}

function revalidateProgramSessionPaths(programId: string) {
  revalidatePath(`/programs/${programId}/sessions`)
  revalidatePath(`/programs/${programId}/edit`)
  revalidatePath(`/programs/${programId}`)
}

export async function createProgramSession(
  input: CreateProgramSessionInput
) {
  const supabase = await createClient()

  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const defaultOffering = await getDefaultOfferingForProgram(input.program_id)
  const offeringId = input.offering_id ?? defaultOffering?.id ?? null

  if (input.offering_id) {
    const { data: offering, error: offeringError } = await supabase
      .from("program_offerings")
      .select("id")
      .eq("id", input.offering_id)
      .eq("program_id", input.program_id)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (offeringError || !offering) {
      throw new Error("Invalid offering for this program")
    }
  }

  const { error } = await supabase
    .from("program_sessions")
    .insert({
      organization_id: organizationId,
      program_id: input.program_id,
      offering_id: offeringId,

      name: input.name,
      description: input.description ?? null,

      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,

      registration_open_date:
        input.registration_open_date ?? null,

      registration_close_date:
        input.registration_close_date ?? null,

      capacity: input.capacity ?? 0,

      enrolled: 0,
      waitlist: 0,

      price: input.price ?? 0,

      enable_waitlist:
        input.enable_waitlist ?? true,

      waitlist_capacity:
        input.waitlist_capacity ?? null,

      status: "active",
    })

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidateProgramSessionPaths(input.program_id)
}

export async function updateProgramSession(input: UpdateProgramSessionInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Session name is required.")
  }

  const { error } = await supabase
    .from("program_sessions")
    .update({
      name,
      description: input.description ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      registration_open_date: input.registration_open_date ?? null,
      registration_close_date: input.registration_close_date ?? null,
      capacity: input.capacity ?? 0,
      price: input.price ?? 0,
      enable_waitlist: input.enable_waitlist ?? true,
      waitlist_capacity: input.waitlist_capacity ?? null,
      status: input.status ?? "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.session_id)
    .eq("program_id", input.program_id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidateProgramSessionPaths(input.program_id)
}