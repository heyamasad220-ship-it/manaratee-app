/** Staff participant profile (person-centric) routes. */

export const PARTICIPANT_PROFILE_BASE_PATH = "/programs/participants"

export function participantProfileHref(
  personId: string,
  options?: { returnTo?: string | null }
) {
  const base = `${PARTICIPANT_PROFILE_BASE_PATH}/${personId}`
  const returnTo = options?.returnTo?.trim()
  if (!returnTo) return base
  const params = new URLSearchParams()
  params.set("returnTo", returnTo)
  return `${base}?${params.toString()}`
}

/** Resolve the durable person id for an enrollment row. */
export function resolveEnrollmentParticipantPersonId(input: {
  childPersonId: string | null | undefined
  participantContactPersonId: string | null | undefined
}) {
  return input.childPersonId || input.participantContactPersonId || null
}
