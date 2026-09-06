"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { assertCanManageProgram } from "@/lib/programs/program-access"

export async function createProgramDiscount(formData: FormData) {
  const supabase = await createClient()

  const programId = String(formData.get("program_id"))
  await assertCanManageProgram(programId)
  const organizationId = String(formData.get("organization_id"))
  const discountTagId = String(formData.get("discount_tag_id"))
  const discountType =
  String(formData.get("discount_type")) === "fixed_amount"
    ? "fixed_amount"
    : "percent"
  const amount = Number(formData.get("amount"))

  const { error } = await supabase.from("program_discounts").insert({
    program_id: programId,
    organization_id: organizationId,
    discount_tag_id: discountTagId,
    discount_type: discountType,
    amount,
    name: "Program Discount",
    applies_to: "program",
    is_active: true,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/programs/${programId}`)
}