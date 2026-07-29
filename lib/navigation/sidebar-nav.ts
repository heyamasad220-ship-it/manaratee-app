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
  contactListSegment?: ContactsListSegment
  permissionKey?: string
  permissionKeys?: string[]
  exact?: boolean
  children?: SubItem[]
  /** Advanced Facilities-only nav (inventory, reservation center, ops overview). */
  advancedFacilities?: boolean
}

export interface NavItem {
  label: string
  href: string
  icon: import("lucide-react").LucideIcon
  matchPrefix: string
  children?: SubItem[]
  group?: string | null
  permissionKey?: string
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
])

export function isContactProfilePath(pathname: string) {
  const match = pathname.match(/^\/contacts\/([^/]+)$/)
  if (!match) return false
  return !CONTACTS_LIST_SEGMENTS.has(match[1])
}

export function subItemMatchesPath(
  child: SubItem,
  pathname: string,
  profileListSegment: ContactsListSegment | null
) {
  if (child.exact) {
    if (child.href === "/donations/campaigns") {
      return isDonationCampaignsOverviewPath(pathname)
    }
    return pathname === child.href
  }

  if (pathname === child.href || pathname.startsWith(`${child.matchPrefix}/`)) {
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
  profileListSegment: ContactsListSegment | null
): boolean {
  if (subItemMatchesPath(child, pathname, profileListSegment)) {
    return true
  }

  return (child.children ?? []).some((nested) =>
    subItemHasActiveDescendant(nested, pathname, profileListSegment)
  )
}

export function isChildActive(
  child: SubItem,
  siblings: SubItem[],
  pathname: string,
  profileListSegment: ContactsListSegment | null
) {
  if (!subItemHasActiveDescendant(child, pathname, profileListSegment)) {
    return false
  }

  const isChildOverridden = siblings.some(
    (other) =>
      other.label !== child.label &&
      subItemHasActiveDescendant(other, pathname, profileListSegment) &&
      (other.matchPrefix.length > child.matchPrefix.length ||
        Boolean(other.alsoMatchPrefixes?.length) ||
        Boolean(other.children?.length))
  )

  return !isChildOverridden
}

export function isItemActive(
  item: NavItem,
  pathname: string,
  navItems: NavItem[],
  profileListSegment: ContactsListSegment | null
) {
  const matchesSelf = pathname.startsWith(item.matchPrefix)
  const matchesChild =
    item.children?.some((child) =>
      subItemHasActiveDescendant(child, pathname, profileListSegment)
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
  profileListSegment: ContactsListSegment | null
): NavItem | null {
  // Prefer a module whose child matches the path (e.g. HR → Departments at
  // /workforce/departments) over a broader module prefix match.
  for (const item of navItems) {
    if (
      item.children?.some((child) =>
        subItemHasActiveDescendant(child, pathname, profileListSegment)
      )
    ) {
      return item
    }
  }

  for (const item of navItems) {
    if (
      item.children &&
      item.children.length > 0 &&
      isItemActive(item, pathname, navItems, profileListSegment)
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

function findDeepestSubItemMatch(
  items: SubItem[],
  pathname: string,
  profileListSegment: ContactsListSegment | null,
  ancestors: SubItem[] = []
): SubItemMatch | null {
  let best: SubItemMatch | null = null

  for (const item of items) {
    const nextAncestors = [...ancestors, item]

    if (item.children?.length) {
      const nested = findDeepestSubItemMatch(
        item.children,
        pathname,
        profileListSegment,
        nextAncestors
      )
      if (nested) {
        best = nested
      }
      continue
    }

    if (subItemMatchesPath(item, pathname, profileListSegment)) {
      best = { chain: ancestors, leaf: item }
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
  trailingSegments: NavigationTrailSegment[] = []
): NavigationTrailSegment[] {
  const trail: NavigationTrailSegment[] = [{ label: "Dashboard", href: "/dashboard" }]

  if (pathname === "/dashboard") {
    return trailingSegments.length > 0 ? [...trail, ...trailingSegments] : trail
  }

  const activeModule = findActiveModuleWithChildren(navItems, pathname, profileListSegment)

  if (!activeModule?.children?.length) {
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

  const match = findDeepestSubItemMatch(activeModule.children, pathname, profileListSegment)
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
    const leafIsCurrentPage = subItemMatchesPath(match.leaf, pathname, profileListSegment)
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
      if (child.children && child.children.length === 0 && !child.href) {
        return false
      }
      return true
    })
}
