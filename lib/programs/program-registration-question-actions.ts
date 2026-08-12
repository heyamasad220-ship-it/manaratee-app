"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type {
  ProgramOfferingRegistrationQuestion,
  RegistrationQuestionInput,
} from "@/lib/programs/program-registration-question-types"

export async function getRegistrationQuestionsForOffering(
  offeringId: string,
  organizationId?: string
): Promise<ProgramOfferingRegistrationQuestion[]> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return []

  const { data, error } = await supabase
    .from("program_offering_registration_questions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    // Table may not exist until migration 201 is applied.
    if (
      error.message?.includes("does not exist") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []) as ProgramOfferingRegistrationQuestion[]
}

export async function saveRegistrationQuestionsForOffering(input: {
  programId: string
  offeringId: string
  questions: RegistrationQuestionInput[]
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected.")
  }

  const { error: deleteError } = await supabase
    .from("program_offering_registration_questions")
    .delete()
    .eq("organization_id", organizationId)
    .eq("offering_id", input.offeringId)

  if (deleteError) {
    if (
      deleteError.message?.includes("does not exist") ||
      deleteError.code === "42P01" ||
      deleteError.code === "PGRST205"
    ) {
      throw new Error(
        "Registration questions table is missing. Run scripts/201_program_offering_registration_questions.sql."
      )
    }
    throw new Error(deleteError.message)
  }

  const rows = input.questions
    .map((question, index) => ({
      organization_id: organizationId,
      offering_id: input.offeringId,
      prompt: question.prompt.trim(),
      question_type: question.questionType,
      is_required: question.required,
      sort_order: index * 10,
      is_active: true,
      options:
        question.questionType === "select"
          ? question.options.map((option) => option.trim()).filter(Boolean)
          : [],
    }))
    .filter((row) => row.prompt.length > 0)

  if (rows.length === 0) {
    return
  }

  const { error: insertError } = await supabase
    .from("program_offering_registration_questions")
    .insert(rows)

  if (insertError) {
    if (
      insertError.message?.includes("options") ||
      insertError.message?.includes("select")
    ) {
      throw new Error(
        "Registration question options are missing. Run scripts/239_registration_question_select_options.sql."
      )
    }
    throw new Error(insertError.message)
  }
}
