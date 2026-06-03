const DEFAULT_POST_AUTH_PATH = "/dashboard"

export const SET_PASSWORD_PATH = "/auth/set-password"

function resolveBaseUrl(explicitBaseUrl?: string) {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "")
  }

  if (typeof window !== "undefined") {
    return window.location.origin
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  )
}

export function authCallbackUrl(nextPath: string = DEFAULT_POST_AUTH_PATH, baseUrl?: string) {
  const base = resolveBaseUrl(baseUrl)
  const params = new URLSearchParams()
  params.set("next", nextPath)
  return `${base}/auth/callback?${params.toString()}`
}

export function inviteAcceptRedirectUrl(baseUrl?: string) {
  return authCallbackUrl(SET_PASSWORD_PATH, baseUrl)
}

export function passwordResetRedirectUrl(baseUrl?: string) {
  return inviteAcceptRedirectUrl(baseUrl)
}

export function authConfirmUrl(nextPath: string = SET_PASSWORD_PATH, baseUrl?: string) {
  const base = resolveBaseUrl(baseUrl)
  const params = new URLSearchParams()
  params.set("next", nextPath)
  return `${base}/auth/confirm?${params.toString()}`
}
