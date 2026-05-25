import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { email, organizationId, role = "member" } = await request.json()

    if (!email || !organizationId) {
      return NextResponse.json(
        { success: false, error: "Email and organizationId are required." },
        { status: 400 }
      )
    }

    const supabaseUser = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json(
        { success: false, error: membershipError.message },
        { status: 500 }
      )
    }

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only organization admins can invite users." },
        { status: 403 }
      )
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL

    if (!siteUrl) {
      return NextResponse.json(
        { success: false, error: "Missing NEXT_PUBLIC_SITE_URL." },
        { status: 500 }
      )
    }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback`,
      data: {
        role,
        organization_id: organizationId,
      },
    })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to invite user.",
      },
      { status: 500 }
    )
  }
}