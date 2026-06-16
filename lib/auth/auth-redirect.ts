import { getAppBaseUrl } from "@/lib/app/get-app-base-url"

const DEFAULT_POST_AUTH_PATH = "/dashboard"

export const SET_PASSWORD_PATH = "/auth/set-password"

function resolveBaseUrl(explicitBaseUrl?: string, request?: { headers: Headers }) {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "")
  }

  if (typeof window !== "undefined") {
    return window.location.origin
  }

  return getAppBaseUrl(request)
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

/** Password reset uses /auth/confirm + token_hash (PKCE callback breaks across devices). */
export function passwordResetRedirectUrl(baseUrl?: string) {
  return authConfirmUrl(SET_PASSWORD_PATH, baseUrl)
}

export function authConfirmUrl(nextPath: string = SET_PASSWORD_PATH, baseUrl?: string) {
  const base = resolveBaseUrl(baseUrl)
  const params = new URLSearchParams()
  params.set("next", nextPath)
  return `${base}/auth/confirm?${params.toString()}`
}
