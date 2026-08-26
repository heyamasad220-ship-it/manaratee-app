import { customerProgramRegisterPath } from "@/lib/programs/enrollment-process"

export function buildProgramRegistrationUrl(
  programId: string,
  origin: string,
  offeringId?: string | null
) {
  return `${origin}${customerProgramRegisterPath(programId, offeringId)}`
}

export function buildProgramCustomerUrl(programId: string, origin: string) {
  return `${origin}/customer/programs/${programId}`
}
