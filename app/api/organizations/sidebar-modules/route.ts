import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { loadOrganizationSidebarModules } from "@/lib/organizations/load-organization-sidebar-modules"
import { isCurrentUserPlatformAdmin } from "@/lib/platform/is-platform-admin-user"
import { getPlatformAdminOrgAccessOrganizationId } from "@/lib/platform/platform-org-access"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function resolveOrganizationId() {
  const cookieStore = await cookies()
  const supportOrgId = await getPlatformAdminOrgAccessOrganizationId()
  const selectedOrganizationId =
    cookieStore.get("selected_organization_id")?.value?.trim() || null

  if (supportOrgId && (await isCurrentUserPlatformAdmin())) {
    return { organizationId: supportOrgId, platformSupportMode: true }
  }

  return {
    organizationId: selectedOrganizationId,
    platformSupportMode: false,
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { organizationId, platformSupportMode } = await resolveOrganizationId()

  if (!organizationId) {
    return NextResponse.json({ modules: [], platformSupportMode: false })
  }

  if (!platformSupportMode) {
    const { data: membership, error } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (error || !membership) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
  }

  try {
    const admin = getServiceRoleClient()
    const modules = await loadOrganizationSidebarModules(admin, organizationId)

    return NextResponse.json({ modules, platformSupportMode })
  } catch (error) {
    console.error("sidebar-modules GET failed:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load sidebar modules.",
      },
      { status: 500 }
    )
  }
}
