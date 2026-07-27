/**
 * Offering enrollment path: apply/approve vs open register & pay.
 */

export function isOfferingApplicationRequired(
  offering: { application_required?: boolean | null } | null | undefined
): boolean {
  // Default true when unset (legacy / pre-migration rows).
  return offering?.application_required !== false
}

export function isOfferingOpenEnrollment(
  offering: { application_required?: boolean | null } | null | undefined
): boolean {
  return !isOfferingApplicationRequired(offering)
}
