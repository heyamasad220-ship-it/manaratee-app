import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { loadOrganizationSidebarModules } from "@/lib/organizations/load-organization-sidebar-modules"
import { buildSidebarPermissionContext } from "@/lib/organizations/sidebar-nav-context"
import { resolveDepartmentHeadship } from "@/lib/departments/department-headship"
import { resolveProgramLeads } from "@/lib/programs/program-leadship"
import { isCurrentUserPlatformAdmin } from "@/lib/platform/is-platform-admin-user"
import { getPlatformAdminOrgAccessOrganizationId } from "@/lib/platform/platform-org-access"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { normalizeOrganizationProgramKinds } from "@/lib/programs/program-kind-policy"
import { fetchCachedDirectoryNavSummary } from "@/lib/directory/directory-nav-summary"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
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
    return NextResponse.json({
      modules: [],
      platformSupportMode: false,
      myDepartment: null,
      myPrograms: [],
      permissionContext: {
        isOwner: false,
        isSuperAdmin: false,
        enabledPermissions: [],
      },
    })
  }

  let membershipRole: string | null = null
  let membershipRoleId: string | null = null

  if (!platformSupportMode) {
    const { data: membership, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, role_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (error || !membership) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    membershipRole = (membership.role as string | null) ?? null
    membershipRoleId = (membership.role_id as string | null) ?? null
  }

  try {
    const admin = getServiceRoleClient()
    const [modules, permissionContext, headship, programLeads, organizationRow, directorySummary] =
      await Promise.all([
        loadOrganizationSidebarModules(admin, organizationId),
        buildSidebarPermissionContext({
          supabase,
          organizationId,
          userId: user.id,
          membershipRole,
          membershipRoleId,
          platformSupportMode,
        }),
        resolveDepartmentHeadship(supabase, organizationId, user.id),
        resolveProgramLeads(supabase, organizationId, user.id),
        admin.from("organizations").select("program_kinds").eq("id", organizationId).maybeSingle(),
        fetchCachedDirectoryNavSummary(organizationId).catch((error) => {
          console.warn("directory role counts unavailable:", error)
          return null
        }),
      ])

    const myDepartment = headship
      ? {
          id: headship.departmentId,
          name: headship.departmentName,
        }
      : null

    const myPrograms = programLeads.map((lead) => ({
      id: lead.programId,
      name: lead.programName,
    }))

    const canViewContacts =
      permissionContext.isOwner ||
      permissionContext.isSuperAdmin ||
      permissionContext.enabledPermissions.includes(PERMISSIONS.CONTACTS_VIEW) ||
      permissionContext.enabledPermissions.includes(PERMISSIONS.CONTACTS_MANAGE)

    const directoryRoleCounts = canViewContacts ? directorySummary?.roles || {} : {}

    let programKinds = normalizeOrganizationProgramKinds(null)
    const programKindsError = organizationRow && "error" in organizationRow ? organizationRow.error : null
    if (
      programKindsError &&
      !/program_kinds|does not exist/i.test(
        (programKindsError as { message?: string } | null)?.message || ""
      )
    ) {
      console.warn(
        "program kinds unavailable:",
        (programKindsError as { message?: string }).message
      )
    } else {
      programKinds = normalizeOrganizationProgramKinds(
        (organizationRow?.data as { program_kinds?: string | null } | null)?.program_kinds
      )
    }

    return NextResponse.json({
      modules,
      platformSupportMode,
      myDepartment,
      myPrograms,
      permissionContext,
      directoryRoleCounts,
      programKinds,
    })
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
