import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { SET_PASSWORD_PATH } from "@/lib/auth/auth-redirect"
import { createClient } from "@/lib/supabase/server"

export function safeAuthNextPath(next: string | null) {
  const path = next ?? SET_PASSWORD_PATH
  return path.startsWith("/") ? path : SET_PASSWORD_PATH
}

export function authAcceptErrorRedirect(origin: string, message: string) {
  const params = new URLSearchParams()
  params.set("error", message)
  return NextResponse.redirect(`${origin}/auth/accept?${params.toString()}`)
}

/**
 * Exchange Supabase invite/OAuth codes or email OTP tokens on the server.
 * Required for PKCE — the code verifier lives in HTTP cookies via @supabase/ssr.
 */
export async function completeAuthFromSearchParams(
  searchParams: URLSearchParams,
  origin: string
) {
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  if (error || errorDescription) {
    const message = decodeURIComponent(
      (errorDescription ?? error ?? "Authentication failed").replace(/\+/g, " ")
    )
    return authAcceptErrorRedirect(origin, message)
  }

  const safeNext = safeAuthNextPath(searchParams.get("next"))
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  const supabase = await createClient()

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return authAcceptErrorRedirect(origin, exchangeError.message)
    }
    return NextResponse.redirect(`${origin}${safeNext}`)
  }

  if (tokenHash && type) {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (verifyError) {
      return authAcceptErrorRedirect(origin, verifyError.message)
    }

    // Recovery fires PASSWORD_RECOVERY; ensure session cookies are persisted (supabase/ssr).
    if (type === "recovery" && data.session) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (sessionError) {
        return authAcceptErrorRedirect(origin, sessionError.message)
      }
    }

    return NextResponse.redirect(`${origin}${safeNext}`)
  }

  return null
}
