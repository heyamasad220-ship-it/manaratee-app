/** Canonical production URL — used for invite emails and auth redirects. */
export const CANONICAL_APP_URL = "https://app.manaratee.com"

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "")
}

function urlFromRequestHeaders(headers: Headers) {
  const origin = headers.get("origin") || headers.get("x-forwarded-host")
  if (!origin) return null
  return normalizeBaseUrl(origin.startsWith("http") ? origin : `https://${origin}`)
}

/**
 * Base URL for auth redirects and invite emails.
 * Production defaults to app.manaratee.com so invites never point at *.vercel.app.
 */
export function getAppBaseUrl(request?: { headers: Headers }) {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (fromEnv) {
    return normalizeBaseUrl(fromEnv)
  }

  if (process.env.NODE_ENV === "development") {
    const fromRequest = request ? urlFromRequestHeaders(request.headers) : null
    return fromRequest ?? "http://localhost:3000"
  }

  if (process.env.VERCEL_ENV === "production") {
    return CANONICAL_APP_URL
  }

  if (process.env.VERCEL_URL) {
    return normalizeBaseUrl(`https://${process.env.VERCEL_URL}`)
  }

  return CANONICAL_APP_URL
}
