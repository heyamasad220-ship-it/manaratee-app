import { isContactsListSegment, type ContactsListSegment } from "@/lib/contacts/contact-module-label"
import { isDonationCampaignsOverviewPath } from "@/lib/donations/donation-campaign-paths"
import { getReturnToLabel } from "@/lib/navigation/return-to"

export function resolveContactProfileListSegment(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">
): ContactsListSegment | null {
  if (!isContactProfilePath(pathname)) return null
  const list = searchParams.get("list")
  return isContactsListSegment(list) ? list : null
}

export interface SubItem {
  label: string
  href: string
  matchPrefix: string
  alsoMatchPrefixes?: string[]
  /** Paths that must not count as a match for this item (more specific siblings). */
  excludeMatchPrefixes?: string[]
  contactListSegment?: ContactsListSegment
  permissionKey?: string
  permissionKeys?: string[]
  exact?: boolean
  children?: SubItem[]
  /** Render a compact divider above this item (Directory flyout sections). */
  dividerBefore?: boolean
  /** Advanced Facilities-only nav (inventory, reservation center, ops overview). */
  advancedFacilities?: boolean
}

export interface NavItem {
  label: string
  href: string
  icon: import("lucide-react").LucideIcon
  matchPrefix: string
  /** Extra path prefixes that keep this module selected (combined modules). */
  alsoMatchPrefixes?: string[]
  children?: SubItem[]
  group?: string | null
  permissionKey?: string
  /** Any of these permissions grants access (for shared/top-level items). */
  permissionKeys?: string[]
  moduleSlug?: string
  requiresSuperAdmin?: boolean
  /** Always shown last in the primary nav rail (e.g. Billing, org Settings). */
  pinToBottom?: boolean
}

const CONTACTS_LIST_SEGMENTS = new Set([
  "people",
  "families",
  "organizations",
  "groups",
  "settings",
  "members",
  "reports",
  "role",
])

export function isContactProfilePath(pathname: string) {
  const match = pathname.match(/^\/(?:contacts|directory)\/([^/]+)$/)
  if (!match) return false
  return !CONTACTS_LIST_SEGMENTS.has(match[1])
}

export type SearchParamReader = Pick<URLSearchParams, "get"> | null | undefined

function pathnameFromHref(href: string) {
  const queryIndex = href.indexOf("?")
  return queryIndex === -1 ? href : href.slice(0, queryIndex)
}

function hrefQueryMatches(
  href: string,
  searchParams: SearchParamReader
) {
  const queryIndex = href.indexOf("?")
  if (queryIndex === -1) return true
  if (!searchParams) return false

  const required = new URLSearchParams(href.slice(queryIndex + 1))
  for (const [key, value] of required.entries()) {
    if (searchParams.get(key) !== value) return false
  }
  return true
}

export function subItemMatchesPath(
  child: SubItem,
  pathname: string,
  profileListSegment: ContactsListSegment | null,
  searchParams?: SearchParamReader
) {
  const isExcluded = (pathnameToCheck: string) =>
    child.excludeMatchPrefixes?.some(
      (prefix) =>
        pathnameToCheck === prefix || pathnameToCheck.startsWith(`${prefix}/`)
    ) ?? false

  const hrefPath = pathnameFromHref(child.href)

  if (child.exact) {
    if (hrefPath === "/donations/campaigns") {
      return isDonationCampaignsOverviewPath(pathname)
    }
    if (pathname === hrefPath && hrefQueryMatches(child.href, searchParams)) {
      return true
    }
    return (
      child.alsoMatchPrefixes?.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      ) ?? false
    )
  }

  if (
    (pathname === hrefPath ||
      pathname === child.matchPrefix ||
      pathname.startsWith(`${child.matchPrefix}/`)) &&
    !isExcluded(pathname) &&
    hrefQueryMatches(child.href, searchParams)
  ) {
    return true
  }

  if (
    profileListSegment &&
    child.contactListSegment === profileListSegment &&
    isContactProfilePath(pathname)
  ) {
    return true
  }

  return child.alsoMatchPrefixes?.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function subItemHasActiveDescendant(
  child: SubItem,
  pathname: string,
  profileListSegment: ContactsListSegment | null,
  searchParams?: SearchParamReader
): boolean {
  if (subItemMatchesPath(child, pathname, profileListSegment, searchParams)) {
    return true
  }

  return (child.children ?? []).some((nested) =>
    subItemHasActiveDescendant(nested, pathname, profileListSegment, searchParams)
  )
}

export function isChildActive(
  child: SubItem,
  siblings: SubItem[],
  pathname: string,
  profileListSegment: ContactsListSegment | null,
  searchParams?: SearchParamReader
) {
  if (!subItemHasActiveDescendant(child, pathname, profileListSegment, searchParams)) {
    return false
  }

  const isChildOverridden = siblings.some(
    (other) =>
      other.label !== child.label &&
      subItemHasActiveDescendant(other, pathname, profileListSegment, searchParams) &&
      (other.matchPrefix.length > child.matchPrefix.length ||
        Boolean(other.exact) ||
        Boolean(other.alsoMatchPrefixes?.length) ||
        Boolean(other.children?.length))
  )

  return !isChildOverridden
}

export function isItemActive(
  item: NavItem,
  pathname: string,
  navItems: NavItem[],
  profileListSegment: ContactsListSegment | null,
  searchParams?: SearchParamReader
) {
  const matchesPrefix = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)

  const matchesSelf =
    matchesPrefix(item.matchPrefix) ||
    (item.alsoMatchPrefixes?.some(matchesPrefix) ?? false)
  const matchesChild =
    item.children?.some((child) =>
      subItemHasActiveDescendant(child, pathname, profileListSegment, searchParams)
    ) ?? false
  const isOverridden = navItems.some(
    (other) =>
      other.label !== item.label &&
      other.matchPrefix.startsWith(item.matchPrefix) &&
      other.matchPrefix.length > item.matchPrefix.length &&
      pathname.startsWith(other.matchPrefix)
  )
  return (matchesSelf && !isOverridden) || matchesChild
}

export function findActiveModuleWithChildren(
  navItems: NavItem[],
  pathname: string,
  profileListSegment: ContactsListSegment | null,
  searchParams?: SearchParamReader
): NavItem | null {
  // Prefer a module whose child matches the path (e.g. Administration →
  // Departments at /workforce/departments) over a broader module prefix match.
  for (const item of navItems) {
    if (
      item.children?.some((child) =>
        subItemHasActiveDescendant(child, pathname, profileListSegment, searchParams)
      )
    ) {
      return item
    }
  }

  for (const item of navItems) {
    if (
      item.children &&
      item.children.length > 0 &&
      isItemActive(item, pathname, navItems, profileListSegment, searchParams)
    ) {
      return item
    }
  }
  return null
}

type SubItemMatch = {
  chain: SubItem[]
  leaf: SubItem | null
}

function subItemPathMatchScore(
  item: SubItem,
  pathname: string,
  profileListSegment: ContactsListSegment | null,
  searchParams?: SearchParamReader
): number {
  if (!subItemMatchesPath(item, pathname, profileListSegment, searchParams)) {
    return -1
  }

  const hrefPath = pathnameFromHref(item.href)
  let score = 0
  if (
    pathname === hrefPath ||
    pathname === item.matchPrefix ||
    pathname.startsWith(`${item.matchPrefix}/`)
  ) {
    score = Math.max(score, item.matchPrefix.length)
  }
  for (const prefix of item.alsoMatchPrefixes ?? []) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      score = Math.max(score, prefix.length)
    }
  }
  // Exact href match without a longer prefix still counts.
  if (score === 0 && pathname === hrefPath) {
    score = hrefPath.length
  }
  return score
}

function findDeepestSubItemMatch(
  items: SubItem[],
  pathname: string,
  profileListSegment: ContactsListSegment | null,
  ancestors: SubItem[] = [],
  searchParams?: SearchParamReader
): SubItemMatch | null {
  let best: SubItemMatch | null = null
  let bestScore = -1

  for (const item of items) {
    const nextAncestors = [...ancestors, item]

    if (item.children?.length) {
      const nested = findDeepestSubItemMatch(
        item.children,
        pathname,
        profileListSegment,
        nextAncestors,
        searchParams
      )
      if (nested?.leaf) {
        const nestedScore = subItemPathMatchScore(
          nested.leaf,
          pathname,
          profileListSegment,
          searchParams
        )
        if (nestedScore > bestScore) {
          best = nested
          bestScore = nestedScore
        }
      }
      continue
    }

    const score = subItemPathMatchScore(
      item,
      pathname,
      profileListSegment,
      searchParams
    )
    if (score > bestScore) {
      best = { chain: ancestors, leaf: item }
      bestScore = score
    }
  }

  return best
}

export type NavigationTrailSegment = {
  label: string
  href?: string
  module?: NavItem
  expandKeys?: string[]
}

export function buildSubExpandKey(moduleLabel: string, ancestors: string[], label: string) {
  return [moduleLabel, ...ancestors, label].join("::")
}

export function buildNavigationTrail(
  pathname: string,
  navItems: NavItem[],
  profileListSegment: ContactsListSegment | null,
  trailingSegments: NavigationTrailSegment[] = [],
  searchParams?: SearchParamReader
): NavigationTrailSegment[] {
  const trail: NavigationTrailSegment[] = [{ label: "Dashboard", href: "/dashboard" }]

  if (pathname === "/dashboard") {
    return trailingSegments.length > 0 ? [...trail, ...trailingSegments] : trail
  }

  const activeModule =
    findActiveModuleWithChildren(
      navItems,
      pathname,
      profileListSegment,
      searchParams
    ) ??
    navItems.find((item) =>
      isItemActive(item, pathname, navItems, profileListSegment, searchParams)
    ) ??
    null

  if (!activeModule) {
    trail.push({ label: getReturnToLabel(pathname), href: pathname })
    if (trailingSegments.length > 0) {
      trail.push(...trailingSegments)
    }
    return trail
  }

  trail.push({
    label: activeModule.label,
    href: activeModule.href,
    module: activeModule,
  })

  if (!activeModule.children?.length) {
    if (trailingSegments.length > 0) {
      trail.push(...trailingSegments)
      return trail
    }
    const moduleHome = pathnameFromHref(activeModule.href)
    const pageLabel = getReturnToLabel(pathname)
    if (pathname !== moduleHome) {
      trail.push({ label: pageLabel })
    } else if (pageLabel !== activeModule.label) {
      trail.push({ label: pageLabel })
    }
    return trail
  }

  const match = findDeepestSubItemMatch(
    activeModule.children,
    pathname,
    profileListSegment,
    [],
    searchParams
  )
  if (!match?.leaf) {
    const pageLabel = getReturnToLabel(pathname)
    if (pageLabel !== activeModule.label) {
      trail.push({ label: pageLabel })
    }
    if (trailingSegments.length > 0) {
      trail.push(...trailingSegments)
    }
    return trail
  }

  const ancestorLabels: string[] = []

  for (const ancestor of match.chain) {
    ancestorLabels.push(ancestor.label)
    trail.push({
      label: ancestor.label,
      href: ancestor.href,
      module: activeModule,
      expandKeys: ancestorLabels.map((label, index) =>
        buildSubExpandKey(
          activeModule.label,
          ancestorLabels.slice(0, index),
          label
        )
      ),
    })
  }

  if (match.leaf) {
    const leafAncestors = [...ancestorLabels, match.leaf.label]
    const leafIsCurrentPage = subItemMatchesPath(
      match.leaf,
      pathname,
      profileListSegment,
      searchParams
    )
    const leafExpandKeys = leafAncestors.map((label, index) =>
      buildSubExpandKey(activeModule.label, leafAncestors.slice(0, index), label)
    )

    if (leafIsCurrentPage) {
      // Keep parent navigable when a page appends a deeper trail segment (e.g. department name).
      trail.push(
        trailingSegments.length > 0
          ? {
              label: match.leaf.label,
              href: match.leaf.href,
              module: activeModule,
              expandKeys: leafExpandKeys,
            }
          : { label: match.leaf.label }
      )
    } else {
      trail.push({
        label: match.leaf.label,
        href: match.leaf.href,
        module: activeModule,
        expandKeys: leafExpandKeys,
      })
      trail.push({ label: getReturnToLabel(pathname) })
    }
  }

  if (trailingSegments.length > 0) {
    trail.push(...trailingSegments)
  }

  return trail
}

export function filterSubItemsByPermission(
  items: SubItem[],
  canAccess: (permissionKey?: string, permissionKeys?: string[]) => boolean
): SubItem[] {
  return items
    .filter((child) => canAccess(child.permissionKey, child.permissionKeys))
    .map((child) => ({
      ...child,
      children: child.children
        ? filterSubItemsByPermission(child.children, canAccess)
        : undefined,
    }))
    .filter((child) => {
      // Drop empty folders after permission filtering (combined module groups).
      if (Array.isArray(child.children) && child.children.length === 0) {
        return false
      }
      return true
    })
}
