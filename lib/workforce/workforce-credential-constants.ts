export const WORKFORCE_CREDENTIAL_TYPES = [
  "cpr",
  "first_aid",
  "background_check",
  "safeguarding",
  "other",
] as const

export type WorkforceCredentialType = (typeof WORKFORCE_CREDENTIAL_TYPES)[number]

export const WORKFORCE_CREDENTIAL_TYPE_LABELS: Record<WorkforceCredentialType, string> = {
  cpr: "CPR",
  first_aid: "First Aid",
  background_check: "Background Check",
  safeguarding: "Safeguarding",
  other: "Other",
}

export function isWorkforceCredentialType(value: string): value is WorkforceCredentialType {
  return (WORKFORCE_CREDENTIAL_TYPES as readonly string[]).includes(value)
}

export function formatCredentialType(value?: string | null) {
  if (value && isWorkforceCredentialType(value)) {
    return WORKFORCE_CREDENTIAL_TYPE_LABELS[value]
  }
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"
}
