"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type ProgramFeeOptionInput = {
  id?: string
  organization_id: string
  program_id: string
  name: string
  description?: string | null
  fee_type: "required" | "optional"
  amount: number
  is_active: boolean
  sort_order: number
}

export async function replaceProgramFeeOptions({
  organization_id,
  program_id,
  fees,
}: {
  organization_id: string
  program_id: string
  fees: ProgramFeeOptionInput[]
}) {
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from("program_fee_options")
    .delete()
    .eq("organization_id", organization_id)
    .eq("program_id", program_id)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  const cleanFees = fees
    .filter((fee) => fee.name.trim())
    .map((fee, index) => ({
      organization_id,
      program_id,
      name: fee.name.trim(),
      description: fee.description || null,
      fee_type: fee.fee_type,
      amount: fee.amount || 0,
      is_active: fee.is_active,
      sort_order: index,
    }))

  if (cleanFees.length > 0) {
    const { error: insertError } = await supabase
      .from("program_fee_options")
      .insert(cleanFees)

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  revalidatePath(`/programs/${program_id}`)
  revalidatePath(`/programs/${program_id}/offerings`)
}