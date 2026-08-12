export type RegistrationQuestionType =
  | "yes_no"
  | "text"
  | "textarea"
  | "select"

export type ProgramOfferingRegistrationQuestion = {
  id: string
  organization_id: string
  offering_id: string
  prompt: string
  question_type: RegistrationQuestionType
  is_required: boolean
  sort_order: number
  is_active: boolean
  /** Drop-down choices when question_type is select. */
  options?: string[] | null
  created_at: string
  updated_at: string
}

export type RegistrationQuestionInput = {
  clientId: string
  id?: string
  prompt: string
  questionType: RegistrationQuestionType
  required: boolean
  /** Comma-separated or array; used when questionType is select. */
  options: string[]
}

/** Types shown in the Add / Edit question dialog. */
export const REGISTRATION_QUESTION_TYPE_LABELS: Record<
  Exclude<RegistrationQuestionType, "yes_no">,
  string
> = {
  text: "Text box",
  textarea: "Text area",
  select: "Drop-down",
}

export const ALL_REGISTRATION_QUESTION_TYPE_LABELS: Record<
  RegistrationQuestionType,
  string
> = {
  yes_no: "Yes / No",
  ...REGISTRATION_QUESTION_TYPE_LABELS,
}

export function createEmptyRegistrationQuestion(
  prompt = ""
): RegistrationQuestionInput {
  return {
    clientId: `draft-${Math.random().toString(36).slice(2, 10)}`,
    prompt,
    questionType: "text",
    required: false,
    options: [],
  }
}

export function parseOptionsFromCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

export function formatOptionsAsCsv(options: string[]): string {
  return options.join(", ")
}

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return normalizeOptions(parsed)
    } catch {
      return parseOptionsFromCsv(raw)
    }
  }
  return []
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
      options: normalizeOptions(row.options),
    }))
}
