import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { isCurrentUserPlatformAdmin } from "@/lib/platform/is-platform-admin-user"
import {
  getPlatformAdminOrgAccessOrganizationId,
  isPlatformAdminOrgSupportSession,
} from "@/lib/platform/platform-org-access"

export const dynamic = "force-dynamic"

export async function GET() {
  const cookieStore = await cookies()
  const supportOrgId = await getPlatformAdminOrgAccessOrganizationId()
  const selectedOrganizationId =
    cookieStore.get("selected_organization_id")?.value?.trim() || null

  let organizationId = selectedOrganizationId
  let platformSupportMode = false

  if (supportOrgId && (await isCurrentUserPlatformAdmin())) {
    organizationId = supportOrgId
    platformSupportMode = true
  } else if (organizationId) {
    platformSupportMode = await isPlatformAdminOrgSupportSession(organizationId)
  }

  if (organizationId) {
    return NextResponse.json({ organizationId, platformSupportMode })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ organizationId: null, platformSupportMode: false })
  }

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)

  if (error) {
    console.error("Selected organization fallback error:", error)
    return NextResponse.json({ organizationId: null, platformSupportMode: false })
  }

  const fallbackOrganizationId = memberships?.[0]?.organization_id ?? null

  return NextResponse.json({
    organizationId: fallbackOrganizationId,
    platformSupportMode: false,
  })
}
