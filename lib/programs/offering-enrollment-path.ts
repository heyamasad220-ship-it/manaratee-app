/**
 * Offering enrollment path: apply/approve vs open register & pay.
 * Program.enrollment_process is the year/season setting; offering.application_required
 * stays the flag the customer apply/register pages already read.
 */

import { isApplicationBasedProgram } from "@/lib/programs/enrollment-process"

export function isOfferingApplicationRequired(
  offering: { application_required?: boolean | null } | null | undefined,
  program?: {
    enrollment_process?: string | null
    program_kind?: string | null
  } | null
): boolean {
  if (program && program.enrollment_process) {
    return isApplicationBasedProgram(program)
  }
  // Default true when unset (legacy / pre-migration rows).
  return offering?.application_required !== false
}

export function isOfferingOpenEnrollment(
  offering: { application_required?: boolean | null } | null | undefined,
  program?: {
    enrollment_process?: string | null
    program_kind?: string | null
  } | null
): boolean {
  return !isOfferingApplicationRequired(offering, program)
}
