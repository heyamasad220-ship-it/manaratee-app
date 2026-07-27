/**
 * Household display names default to the children's last name, e.g. "Suleiman".
 * Falls back to the parent's last name, then "Household".
 */

export function lastNameFromFullName(fullName: string | null | undefined): string | null {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return null
  return parts[parts.length - 1] || null
}

/** Strip a trailing " Family" suffix from an auto-generated household name. */
export function stripHouseholdFamilySuffix(name: string | null | undefined): string {
  return String(name || "")
    .trim()
    .replace(/\s+Family$/i, "")
    .trim()
}

/** Most common non-empty last name; ties go to first seen. */
export function pickDominantLastName(
  lastNames: Array<string | null | undefined>
): string | null {
  const counts = new Map<string, number>()
  const order: string[] = []

  for (const raw of lastNames) {
    const last = String(raw || "").trim()
    if (!last) continue
    const key = last
    if (!counts.has(key)) {
      order.push(key)
      counts.set(key, 0)
    }
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  if (order.length === 0) return null

  let best = order[0]
  let bestCount = counts.get(best) || 0
  for (const name of order.slice(1)) {
    const count = counts.get(name) || 0
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}

export function deriveHouseholdFamilyName(input: {
  childLastNames?: Array<string | null | undefined>
  parentFullName?: string | null
  parentLastName?: string | null
}): string {
  const fromKids = pickDominantLastName(input.childLastNames || [])
  if (fromKids) return fromKids

  const fromParentLast = String(input.parentLastName || "").trim()
  if (fromParentLast) return fromParentLast

  const fromParentFull = lastNameFromFullName(input.parentFullName)
  if (fromParentFull) return fromParentFull

  return "Household"
}

/** True when the name looks auto-generated from a parent's full name (e.g. "Fadey Suleiman" or "Fadey Suleiman Family"). */
export function isParentFullNameFamilyName(
  familyName: string | null | undefined,
  parentFullName: string | null | undefined
): boolean {
  const name = String(familyName || "").trim()
  const parent = String(parentFullName || "").trim()
  if (!name || !parent) return false
  const lower = name.toLowerCase()
  const parentLower = parent.toLowerCase()
  return lower === parentLower || lower === `${parentLower} family`
}

/** True when the current name should be replaced by the derived household name. */
export function shouldReplaceAutoHouseholdName(
  currentName: string | null | undefined,
  derivedName: string,
  parentFullName?: string | null
): boolean {
  const current = String(currentName || "").trim()
  const derived = String(derivedName || "").trim()
  if (!current || !derived || current === derived) return false
  if (isParentFullNameFamilyName(current, parentFullName)) return true

  const withoutSuffix = stripHouseholdFamilySuffix(current)
  if (withoutSuffix.toLowerCase() === derived.toLowerCase()) return true

  const parent = String(parentFullName || "").trim()
  if (parent && withoutSuffix.toLowerCase() === parent.toLowerCase()) return true

  return false
}
