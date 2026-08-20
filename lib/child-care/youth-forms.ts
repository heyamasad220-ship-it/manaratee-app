import type { EventServiceRequirements } from "@/lib/events/event-service-requirements"

export type YouthFormRegistration = {
  status?: string | null
  allergies?: string | null
  photo_consent?: boolean | null
  photoConsent?: boolean | null
  waiver_signed_at?: string | null
  waiverSignedAt?: string | null
}

export function eventYouthQuestionsEnabled(
  config?: EventServiceRequirements["childcare"] | null
) {
  const groups = config?.groups
  if (!groups?.length) return true
  return groups.every((group) => group.includeYouthQuestions !== false)
}

export function eventYouthWaiverRequired(
  config?: EventServiceRequirements["childcare"] | null
) {
  return config?.requireWaiver === true
}

export function missingYouthFormReasons(
  registration: YouthFormRegistration,
  config?: EventServiceRequirements["childcare"] | null
): string[] {
  const reasons: string[] = []
  const questionsOn = eventYouthQuestionsEnabled(config)
  const allergies = (registration.allergies || "").trim()
  const photoConsent =
    registration.photoConsent ?? registration.photo_consent ?? null
  const waiverSignedAt =
    registration.waiverSignedAt ?? registration.waiver_signed_at ?? null

  if (questionsOn && !allergies) {
    reasons.push("Allergies / medical notes")
  }
  if (questionsOn && photoConsent !== true) {
    reasons.push("Photo consent")
  }
  if (eventYouthWaiverRequired(config) && !waiverSignedAt) {
    reasons.push("Liability waiver")
  }
  return reasons
}

export function hasMissingYouthForms(
  registration: YouthFormRegistration,
  config?: EventServiceRequirements["childcare"] | null
) {
  return missingYouthFormReasons(registration, config).length > 0
}

export function youthFormsStatusLabel(
  registration: YouthFormRegistration,
  config?: EventServiceRequirements["childcare"] | null
) {
  const reasons = missingYouthFormReasons(registration, config)
  if (reasons.length === 0) return "Complete"
  return `Missing: ${reasons.join(", ")}`
}
