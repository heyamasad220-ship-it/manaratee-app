import { NextResponse } from "next/server"

import { SET_PASSWORD_PATH } from "@/lib/auth/auth-redirect"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get("next") ?? SET_PASSWORD_PATH

  const acceptParams = new URLSearchParams()
  acceptParams.set("next", next.startsWith("/") ? next : SET_PASSWORD_PATH)

  for (const key of ["code", "token_hash", "type", "error", "error_description"] as const) {
    const value = searchParams.get(key)
    if (value) acceptParams.set(key, value)
  }

  return NextResponse.redirect(`${origin}/auth/accept?${acceptParams.toString()}`)
}
