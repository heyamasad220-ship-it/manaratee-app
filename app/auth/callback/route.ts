import { NextResponse } from "next/server"
import {
  completeAuthFromSearchParams,
  safeAuthNextPath,
} from "@/lib/auth/complete-auth-request"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const completed = await completeAuthFromSearchParams(searchParams, origin)
  if (completed) {
    return completed
  }

  const safeNext = safeAuthNextPath(searchParams.get("next"))
  const acceptParams = new URLSearchParams()
  acceptParams.set("next", safeNext)

  return NextResponse.redirect(`${origin}/auth/accept?${acceptParams.toString()}`)
}
