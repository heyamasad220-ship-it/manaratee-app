export type ParticipantRegistrationSelection = {
  participantContactId: string
  lunchOptionId: string | null
  beforeCare: boolean
  afterCare: boolean
}

export function readParticipantSelections(
  formData: FormData
): ParticipantRegistrationSelection[] {
  return formData
    .getAll("participant_contact_ids")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((participantContactId) => ({
      participantContactId,
      lunchOptionId:
        String(
          formData.get(`participant_${participantContactId}_lunch_option_id`) ||
            ""
        ).trim() || null,
      beforeCare:
        formData.get(`participant_${participantContactId}_before_care`) === "on",
      afterCare:
        formData.get(`participant_${participantContactId}_after_care`) === "on",
    }))
}
