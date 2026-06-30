import { getAppBaseUrl } from "@/lib/app/get-app-base-url"
import {
  CUSTOMER_DONATION_POST_JOIN_PATH,
  sanitizeCustomerPortalRedirectPath,
} from "@/lib/auth/sanitize-customer-redirect-path"

export function buildOrganizationJoinUrl(
  orgSlug: string,
  options?: { next?: string | null; baseUrl?: string }
) {
  const base = options?.baseUrl ?? getAppBaseUrl()
  const slug = orgSlug.trim().toLowerCase()
  const url = new URL(`${base}/join/${encodeURIComponent(slug)}`)

  const next = sanitizeCustomerPortalRedirectPath(options?.next)
  if (next) {
    url.searchParams.set("next", next)
  }

  return url.toString()
}

/** Join link that lands new donors on the customer donation page after signup. */
export function buildOrganizationDonationJoinUrl(orgSlug: string, baseUrl?: string) {
  return buildOrganizationJoinUrl(orgSlug, {
    next: CUSTOMER_DONATION_POST_JOIN_PATH,
    baseUrl,
  })
}
