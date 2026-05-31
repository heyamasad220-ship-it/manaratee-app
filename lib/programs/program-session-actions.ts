"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

type CreateProgramSessionInput = {
  program_id: string

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
}

export async function createProgramSession(
  input: CreateProgramSessionInput
) {
  const supabase = await createClient()

  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("program_sessions")
    .insert({
      organization_id: organizationId,
      program_id: input.program_id,

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

  revalidatePath(`/programs/${input.program_id}/sessions`)
  revalidatePath(`/programs/${input.program_id}/edit`)
  revalidatePath(`/programs/${input.program_id}`)
}