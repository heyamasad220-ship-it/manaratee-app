export const RETURN_TO_QUERY_PARAM = "returnTo"
export const LAST_DASHBOARD_PATH_KEY = "app.lastDashboardPath"

const CONTACT_PROFILE_PATH =
  /^\/contacts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/|\?|$)/i

export function isContactProfilePath(pathname: string): boolean {
  return CONTACT_PROFILE_PATH.test(pathname)
}

/** Only allow same-origin relative dashboard paths (no open redirects). */
export function isSafeReturnToPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== "string") return false
  const trimmed = path.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false
  if (trimmed.includes("://")) return false
  if (trimmed.includes("\\")) return false
  return true
}

export function buildCurrentPath(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname
}

export function getReturnToLabel(path: string): string {
  const pathname = path.split("?")[0] || path

  if (pathname === "/donations/campaigns") return "Campaigns"
  if (pathname.startsWith("/donations/campaigns/pledges")) return "Pledges"
  if (pathname.startsWith("/donations/campaigns/")) return "Campaign"
  if (pathname.startsWith("/donations/pledges")) return "Pledges"
  if (pathname.startsWith("/donations/reports/donors")) return "Donors"
  if (pathname.startsWith("/donations/reports")) return "Reports"
  if (pathname.startsWith("/donations/payments")) return "Reports"
  if (pathname.startsWith("/donations/donors")) return "Donors"
  if (pathname.startsWith("/donations")) return "Donations"
  if (pathname.startsWith("/contacts/people")) return "People"
  if (pathname.startsWith("/contacts/organizations")) return "Organizations"
  if (pathname.startsWith("/contacts/groups")) return "Group Giving"
  if (pathname.startsWith("/membership/groups")) return "Groups"
  if (pathname.startsWith("/contacts/families")) return "Families"
  if (pathname.startsWith("/contacts/settings")) return "Contact Settings"
  if (pathname.startsWith("/bookings")) return "Bookings"
  if (pathname.startsWith("/programs")) return "Programs"
  if (pathname.startsWith("/workforce")) return "HR"
  if (pathname.startsWith("/memberships")) return "Memberships"

  const segments = pathname.split("/").filter(Boolean)
  const last = segments[segments.length - 1]
  if (last && last.length < 48 && !/^[0-9a-f-]{36}$/i.test(last)) {
    return last
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  return "Previous Page"
}

export function formatReturnToBackLabel(path: string): string {
  return `Back to ${getReturnToLabel(path)}`
}

export function readStoredReturnToPath(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = sessionStorage.getItem(LAST_DASHBOARD_PATH_KEY)
    return stored && isSafeReturnToPath(stored) ? stored : null
  } catch {
    return null
  }
}

export function writeStoredReturnToPath(path: string) {
  if (typeof window === "undefined" || !isSafeReturnToPath(path)) return
  try {
    sessionStorage.setItem(LAST_DASHBOARD_PATH_KEY, path)
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}
