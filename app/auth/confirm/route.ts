import { NextResponse } from "next/server"
import { SET_PASSWORD_PATH } from "@/lib/auth/auth-redirect"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get("next") ?? SET_PASSWORD_PATH

  const acceptParams = new URLSearchParams()
  acceptParams.set("next", next.startsWith("/") ? next : SET_PASSWORD_PATH)

  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (tokenHash) acceptParams.set("token_hash", tokenHash)
  if (type) acceptParams.set("type", type)
  if (code) acceptParams.set("code", code)
  if (error) acceptParams.set("error", error)
  if (errorDescription) acceptParams.set("error_description", errorDescription)

  if (!tokenHash && !type && !code && !error) {
    const errorParams = new URLSearchParams()
    errorParams.set("error", "Missing confirmation token.")
    return NextResponse.redirect(`${origin}/auth/error?${errorParams.toString()}`)
  }

  return NextResponse.redirect(`${origin}/auth/accept?${acceptParams.toString()}`)
}
