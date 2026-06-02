import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { SET_PASSWORD_PATH } from "@/lib/auth/auth-redirect"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? SET_PASSWORD_PATH

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("Auth callback code exchange failed:", error.message)
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  const safeNext = next.startsWith("/") ? next : "/dashboard"
  return NextResponse.redirect(`${origin}${safeNext}`)
}
