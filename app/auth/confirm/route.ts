import { NextResponse } from "next/server"
import {
  completeAuthFromSearchParams,
} from "@/lib/auth/complete-auth-request"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const completed = await completeAuthFromSearchParams(searchParams, origin)
  if (completed) {
    return completed
  }

  const errorParams = new URLSearchParams()
  errorParams.set("error", "Missing confirmation token.")
  return NextResponse.redirect(`${origin}/auth/error?${errorParams.toString()}`)
}
