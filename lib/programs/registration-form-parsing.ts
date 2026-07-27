export type ParticipantRegistrationSelection = {
  /** Preferred for youth: person under the parent Contact (no CRM contact required). */
  participantPersonId: string | null
  /** Adult self-registration or legacy family members who already have a contact. */
  participantContactId: string | null
  lunchOptionId: string | null
  beforeCare: boolean
  afterCare: boolean
}

function readAddonFields(
  formData: FormData,
  key: string
): Pick<
  ParticipantRegistrationSelection,
  "lunchOptionId" | "beforeCare" | "afterCare"
> {
  return {
    lunchOptionId:
      String(formData.get(`participant_${key}_lunch_option_id`) || "").trim() ||
      null,
    beforeCare: formData.get(`participant_${key}_before_care`) === "on",
    afterCare: formData.get(`participant_${key}_after_care`) === "on",
  }
}

export function readParticipantSelections(
  formData: FormData
): ParticipantRegistrationSelection[] {
  const personIds = formData
    .getAll("participant_person_ids")
    .map((value) => String(value).trim())
    .filter(Boolean)

  if (personIds.length > 0) {
    return personIds.map((participantPersonId) => ({
      participantPersonId,
      participantContactId:
        String(
          formData.get(`participant_${participantPersonId}_contact_id`) || ""
        ).trim() || null,
      ...readAddonFields(formData, participantPersonId),
    }))
  }

  // Adult self-registration still posts contact ids for lunch / care options.
  return formData
    .getAll("participant_contact_ids")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((participantContactId) => ({
      participantPersonId: null,
      participantContactId,
      ...readAddonFields(formData, participantContactId),
    }))
}
