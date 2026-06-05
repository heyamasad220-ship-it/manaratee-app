export function buildProgramRegistrationUrl(
  programId: string,
  origin: string
) {
  return `${origin}/customer/programs/${programId}/register`
}

export function buildProgramCustomerUrl(programId: string, origin: string) {
  return `${origin}/customer/programs/${programId}`
}
