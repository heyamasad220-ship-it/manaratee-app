import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { updateOrganizationProgramKindsAsPlatformAdmin } from "@/lib/programs/organization-program-kinds"
import {
  normalizeOrganizationProgramKinds,
  type OrganizationProgramKindsEntitlement,
} from "@/lib/programs/program-kind-policy"

async function requirePlatformAdmin() {
  const supabaseUser = await createServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser()

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: platformAdmin, error: adminCheckError } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (adminCheckError) {
    return {
      error: NextResponse.json({ error: adminCheckError.message }, { status: 500 }),
    }
  }

  if (!platformAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { admin }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const auth = await requirePlatformAdmin()
  if ("error" in auth && auth.error) return auth.error

  try {
    const { organizationId } = await params
    const { data, error } = await auth.admin
      .from("organizations")
      .select("program_kinds")
      .eq("id", organizationId)
      .maybeSingle()

    if (error) {
      if (/program_kinds|does not exist/i.test(error.message || "")) {
        return NextResponse.json({ success: true, programKinds: "both" })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      programKinds: normalizeOrganizationProgramKinds(
        (data as { program_kinds?: string | null } | null)?.program_kinds
      ),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load program modes"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const auth = await requirePlatformAdmin()
  if ("error" in auth && auth.error) return auth.error

  try {
    const { organizationId } = await params
    const body = await request.json()
    const programKinds = normalizeOrganizationProgramKinds(
      body?.programKinds as string | null | undefined
    ) as OrganizationProgramKindsEntitlement

    const result = await updateOrganizationProgramKindsAsPlatformAdmin(
      organizationId,
      programKinds
    )
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      programKinds: result.programKinds,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update program modes"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
