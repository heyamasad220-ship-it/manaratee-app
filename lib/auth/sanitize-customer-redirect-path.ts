import { CUSTOMER_PORTAL_MODULE_BY_PATH_PREFIX } from "@/lib/customer/customer-portal-modules"

const ALWAYS_ALLOWED_CUSTOMER_PATHS = new Set([
  "/customer/dashboard",
  "/customer/profile",
])

const ALLOWED_CUSTOMER_PATH_PREFIXES = [
  ...ALWAYS_ALLOWED_CUSTOMER_PATHS,
  ...CUSTOMER_PORTAL_MODULE_BY_PATH_PREFIX.map((entry) => entry.prefix),
]

function isAllowedCustomerPathname(pathname: string) {
  return ALLOWED_CUSTOMER_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/** Public org pages under `/o/[orgSlug]/…` (community calendar, event tickets). */
function isAllowedPublicOrgPathname(pathname: string) {
  return /^\/o\/[a-z0-9-]+\/(community-calendar|events(?:\/[a-zA-Z0-9-]+)?)$/.test(
    pathname
  )
}

function sanitizeCustomerSearch(pathname: string, search: string) {
  if (!search) return ""

  const params = new URLSearchParams(search)

  if (pathname === "/customer/donation") {
    const give = params.get("give")
    if (give === "one-time" || give === "recurring") {
      return `?give=${give}`
    }
    return ""
  }

  return search.startsWith("?") ? search : `?${search}`
}

/**
 * Restrict post-join / post-auth redirects to same-origin customer portal paths
 * or public organization community pages.
 */
export function sanitizeCustomerPortalRedirectPath(
  path: string | null | undefined
): string | null {
  if (!path?.trim()) return null

  const trimmed = path.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null
  if (trimmed.includes("://")) return null

  let pathname: string
  let search = ""
  try {
    const url = new URL(trimmed, "http://localhost")
    pathname = url.pathname
    search = url.search
  } catch {
    return null
  }

  if (
    !isAllowedCustomerPathname(pathname) &&
    !isAllowedPublicOrgPathname(pathname)
  ) {
    return null
  }

  return `${pathname}${sanitizeCustomerSearch(pathname, search)}`
}

export const CUSTOMER_DONATION_POST_JOIN_PATH = "/customer/donation?give=one-time"
