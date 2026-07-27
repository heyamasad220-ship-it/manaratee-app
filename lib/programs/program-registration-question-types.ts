export type RegistrationQuestionType = "yes_no" | "text" | "textarea"

export type ProgramOfferingRegistrationQuestion = {
  id: string
  organization_id: string
  offering_id: string
  prompt: string
  question_type: RegistrationQuestionType
  is_required: boolean
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RegistrationQuestionInput = {
  clientId: string
  id?: string
  prompt: string
  questionType: RegistrationQuestionType
  required: boolean
}

export const REGISTRATION_QUESTION_TYPE_LABELS: Record<
  RegistrationQuestionType,
  string
> = {
  yes_no: "Yes / No",
  text: "Short text",
  textarea: "Long text",
}

export function createEmptyRegistrationQuestion(
  prompt = ""
): RegistrationQuestionInput {
  return {
    clientId: `draft-${Math.random().toString(36).slice(2, 10)}`,
    prompt,
    questionType: "yes_no",
    required: false,
  }
}

export function parseRegistrationQuestions(
  rows: ProgramOfferingRegistrationQuestion[]
): RegistrationQuestionInput[] {
  return rows
    .filter((row) => row.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      clientId: row.id,
      id: row.id,
      prompt: row.prompt,
      questionType: row.question_type,
      required: row.is_required,
    }))
}
