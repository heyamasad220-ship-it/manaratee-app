import { normalizeModuleSlug } from "@/lib/modules/module-catalog"

export type ContactProfileModuleFlags = {
  donations: boolean
  bookings: boolean
  workforce: boolean
  vendorHub: boolean
  programs: boolean
  membership: boolean
  applications: boolean
}

export function buildEnabledModuleSlugSet(slugs: Iterable<string>): Set<string> {
  return new Set(Array.from(slugs, (slug) => normalizeModuleSlug(slug)))
}

export function isModuleEnabled(
  enabledSlugs: Set<string>,
  moduleSlug: string
): boolean {
  return enabledSlugs.has(normalizeModuleSlug(moduleSlug))
}

export function getContactProfileModuleFlags(
  enabledSlugs: Iterable<string>
): ContactProfileModuleFlags {
  const slugs = buildEnabledModuleSlugSet(enabledSlugs)

  return {
    donations: slugs.has("donations"),
    bookings: slugs.has("bookings"),
    workforce: slugs.has("workforce"),
    vendorHub: slugs.has("vendor-hub"),
    programs: slugs.has("programs"),
    membership: slugs.has("membership"),
    applications: slugs.has("applications"),
  }
}
