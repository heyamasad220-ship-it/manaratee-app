import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // Use anon client for authentication
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log("SIGN IN DATA:", data)
    console.log("SIGN IN ERROR:", error)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      })
    }

    if (!data.user) {
      return NextResponse.json({
        success: false,
        error: "Login failed",
      })
    }

    // Use service role to check admin status
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", data.user.id)
      .single()

    if (profileError) {
      console.error("PROFILE ERROR:", profileError)

      return NextResponse.json({
        success: false,
        error: "Failed to verify admin status",
      })
    }

    if (!profile?.is_platform_admin) {
      return NextResponse.json({
        success: false,
        error: "Access denied. This account does not have platform admin privileges.",
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (error: any) {
    console.error("LOGIN ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "An unexpected error occurred",
      },
      { status: 500 }
    )
  }
}