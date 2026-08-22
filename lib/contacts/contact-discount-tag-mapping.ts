import {
  type ContactRoleValue,
  ROLE_VALUE_TO_LABEL,
  filterContactRoles,
} from "@/lib/contacts/contact-constants"

export type DiscountTagRecord = {
  id: string
  name: string
  active?: boolean
}

function normalizeTagName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/** Role values → normalized discount tag names that should match. */
const ROLE_DISCOUNT_TAG_ALIASES: Record<ContactRoleValue, string[]> = {
  donor: ["donor"],
  customer: ["customer"],
  program_participant: ["programs", "program participant", "program_participant"],
  volunteer: ["volunteer"],
  employee: ["employee", "staff"],
  member: ["member"],
  vendor: ["vendor"],
  childcare_provider: ["child care provider", "childcare provider", "childcare"],
  service_provider: ["service provider"],
  sponsor: ["sponsor"],
}

function aliasesForRole(role: ContactRoleValue): Set<string> {
  const label = ROLE_VALUE_TO_LABEL[role]
  const aliases = ROLE_DISCOUNT_TAG_ALIASES[role] || []
  return new Set([normalizeTagName(label), ...aliases.map(normalizeTagName)])
}

export function matchDiscountTagsForRoles(
  roles: ContactRoleValue[],
  tags: DiscountTagRecord[]
): DiscountTagRecord[] {
  const sanitizedRoles = filterContactRoles(roles)
  const activeTags = tags.filter((tag) => tag.active !== false)
  const matched = new Map<string, DiscountTagRecord>()

  for (const role of sanitizedRoles) {
    const aliasSet = aliasesForRole(role)

    for (const tag of activeTags) {
      const tagNorm = normalizeTagName(tag.name)
      if (aliasSet.has(tagNorm)) {
        matched.set(tag.id, tag)
      }
    }
  }

  return Array.from(matched.values()).sort((a, b) => a.name.localeCompare(b.name))
}
