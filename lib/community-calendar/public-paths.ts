import { getShareableAppBaseUrl } from "@/lib/app/get-app-base-url"

export function buildPublicCommunityCalendarPath(orgSlug: string) {
  return `/o/${encodeURIComponent(orgSlug.trim().toLowerCase())}/community-calendar`
}

export function buildPublicCommunityCalendarUrl(orgSlug: string, baseUrl?: string) {
  const base = baseUrl ?? getShareableAppBaseUrl()
  return `${base}${buildPublicCommunityCalendarPath(orgSlug)}`
}

export function buildPublicCommunityEventPath(orgSlug: string, eventId: string) {
  return `/o/${encodeURIComponent(orgSlug.trim().toLowerCase())}/events/${encodeURIComponent(eventId)}`
}

export function buildPublicCommunityEventUrl(
  orgSlug: string,
  eventId: string,
  baseUrl?: string
) {
  const base = baseUrl ?? getShareableAppBaseUrl()
  return `${base}${buildPublicCommunityEventPath(orgSlug, eventId)}`
}

export function buildPublicEventJoinHref(orgSlug: string, eventId: string) {
  const next = buildPublicCommunityEventPath(orgSlug, eventId)
  const params = new URLSearchParams({ next })
  return `/join/${encodeURIComponent(orgSlug.trim().toLowerCase())}?${params.toString()}`
}
