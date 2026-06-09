import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import {
  applySubscriptionBundleToOrganization,
  getOrganizationModuleAccess,
  setOrganizationModuleEnabled,
} from "@/lib/modules/organization-module-access"

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
    const access = await getOrganizationModuleAccess(organizationId)
    return NextResponse.json(access)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load module access"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const auth = await requirePlatformAdmin()
  if ("error" in auth && auth.error) return auth.error

  try {
    const { organizationId } = await params
    const body = await request.json()
    const bundleSlug = String(body?.bundleSlug ?? "").trim()

    if (!bundleSlug) {
      return NextResponse.json(
        { error: "bundleSlug is required." },
        { status: 400 }
      )
    }

    const access = await applySubscriptionBundleToOrganization(
      organizationId,
      bundleSlug
    )

    return NextResponse.json({ success: true, ...access })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply bundle"
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
    const moduleSlug = String(body?.moduleSlug ?? "").trim()
    const enabled = Boolean(body?.enabled)

    if (!moduleSlug) {
      return NextResponse.json(
        { error: "moduleSlug is required." },
        { status: 400 }
      )
    }

    const access = await setOrganizationModuleEnabled(
      organizationId,
      moduleSlug,
      enabled
    )

    return NextResponse.json({ success: true, ...access })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update module"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
