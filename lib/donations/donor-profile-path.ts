export function getDonorProfilePath(
  donorId: string,
  donorType?: string | null
) {
  const segment = donorType === "organization" ? "organizations" : "individuals"
  return `/donations/donors/${segment}/${donorId}`
}
