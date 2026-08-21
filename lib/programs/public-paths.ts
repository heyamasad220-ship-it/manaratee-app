import { getShareableAppBaseUrl } from "@/lib/app/get-app-base-url"
import { sanitizeCustomerPortalRedirectPath } from "@/lib/auth/sanitize-customer-redirect-path"

export function buildPublicProgramCatalogPath(orgSlug: string) {
  return `/o/${encodeURIComponent(orgSlug.trim().toLowerCase())}/programs`
}

export function buildPublicProgramCatalogUrl(orgSlug: string, baseUrl?: string) {
  const base = baseUrl ?? getShareableAppBaseUrl()
  return `${base}${buildPublicProgramCatalogPath(orgSlug)}`
}

export function buildPublicOfferingJoinHref(
  orgSlug: string,
  programId: string,
  offeringId: string
) {
  const next =
    sanitizeCustomerPortalRedirectPath(
      `/customer/programs/${programId}?offering=${offeringId}`
    ) || `/customer/programs/${programId}`
  const params = new URLSearchParams({ next })
  return `/join/${encodeURIComponent(orgSlug.trim().toLowerCase())}?${params.toString()}`
}
