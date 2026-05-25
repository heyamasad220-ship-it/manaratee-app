import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const userId = body.userId
    const name = body.name?.trim()
    const contact_email = body.contact_email?.trim() || null
    const status = (body.status || "pending").toLowerCase()

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      )
    }

    const allowedStatuses = ["active", "pending", "suspended"]

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const slug = slugify(name)

    // 1) create organization
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name,
        slug,
        contact_email,
        status,
      })
      .select()
      .single()

    if (orgError || !organization) {
      console.error("Create organization error:", orgError)
      return NextResponse.json(
        { error: orgError?.message || "Failed to create organization" },
        { status: 500 }
      )
    }

    // 2) create membership for the current user
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        user_id: userId,
        organization_id: organization.id,
        role: "super_admin",
      })

    if (memberError) {
      console.error("Create membership error:", memberError)

      // rollback org if membership insert fails
      await supabase.from("organizations").delete().eq("id", organization.id)

      return NextResponse.json(
        {
          error:
            memberError.message || "Failed to create organization membership",
        },
        { status: 500 }
      )
    }

    // 3) set selected organization cookie
    const cookieStore = await cookies()

    cookieStore.set("selected_organization_id", organization.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return NextResponse.json({ organization }, { status: 201 })
  } catch (error) {
    console.error("Route error:", error)
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    )
  }
}