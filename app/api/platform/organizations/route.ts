import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    // 1) Get the logged-in user from the normal server client
    const supabaseUser = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2) Use admin client to verify this user is a platform admin
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: platformAdmin, error: adminCheckError } = await admin
      .from("platform_admins")
      .select("user_id, role")
      .eq("user_id", user.id)
      .maybeSingle()

    if (adminCheckError) {
      return NextResponse.json(
        { error: adminCheckError.message },
        { status: 500 }
      )
    }

    if (!platformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 3) Fetch ALL organizations with admin client
    const { data: organizations, error } = await admin
      .from("organizations")
      .select(`
    id,
    name,
    status,
    created_at,
    contact_email,
    organization_members ( id )
  `)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (organizations || []).map((org: any) => ({
  ...org,
  members: org.organization_members?.length || 0,
}))

return NextResponse.json({ organizations: formatted })
  } catch (error) {
    console.error("Platform organizations route error:", error)
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    )
  }
}