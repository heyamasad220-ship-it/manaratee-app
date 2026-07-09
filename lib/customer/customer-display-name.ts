export function resolveCustomerDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined
) {
  const trimmed = fullName?.trim()
  if (trimmed) return trimmed
  if (email) return email.split("@")[0] || "Customer"
  return "Customer"
}

export function resolveCustomerInitials(
  fullName: string,
  email: string | null | undefined
) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase()
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (email?.slice(0, 2) || "CU").toUpperCase()
}
