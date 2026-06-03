import { getAppBaseUrl } from "@/lib/app/get-app-base-url"

export function buildOrganizationJoinUrl(orgSlug: string, baseUrl?: string) {
  const base = baseUrl ?? getAppBaseUrl()
  const slug = orgSlug.trim().toLowerCase()
  return `${base}/join/${encodeURIComponent(slug)}`
}
