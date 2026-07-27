"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { getBrowserAuthUser } from "@/lib/supabase/browser-auth-user"
import { getCurrentOrganizationContext, clearSelectedOrganizationIdCache } from "@/lib/current-organization"
import { isOrganizationSystemAdmin } from "@/lib/organizations/organization-system-admin"
import {
  isFacilitiesOnlyAccess,
  isFacilitiesRoute,
} from "@/lib/permissions/facilities-access"

const ALLOWED_NON_FACILITIES_PATHS = ["/unauthorized", "/profile"]

export function DashboardAccessGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function enforceFacilitiesScope() {
      clearSelectedOrganizationIdCache()
      const supabase = createClient()
      const user = await getBrowserAuthUser(supabase)

      if (!user) {
        if (!cancelled) setChecked(true)
        return
      }

      const { organizationId, platformSupportMode } = await getCurrentOrganizationContext()
      if (!organizationId) {
        if (!cancelled) setChecked(true)
        return
      }

      if (platformSupportMode) {
        if (!cancelled) setChecked(true)
        return
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id, role, role_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle()

      if (!membership) {
        if (!cancelled) setChecked(true)
        return
      }

      let enabledPermissions = new Set<string>()

      if (membership.role_id) {
        const { data: permissionRows } = await supabase
          .from("role_permissions")
          .select("permission_key")
          .eq("organization_id", membership.organization_id)
          .eq("role_id", membership.role_id)
          .eq("enabled", true)

        enabledPermissions = new Set(
          (permissionRows || []).map((row) => row.permission_key)
        )
      }

      const facilitiesOnly = isFacilitiesOnlyAccess({
        isOwner: isOrganizationSystemAdmin(membership.role),
        enabledPermissions,
      })

      if (
        facilitiesOnly &&
        !isFacilitiesRoute(pathname) &&
        !ALLOWED_NON_FACILITIES_PATHS.some((path) => pathname.startsWith(path))
      ) {
        router.replace("/facilities/overview")
        return
      }

      if (!cancelled) {
        setChecked(true)
      }
    }

    enforceFacilitiesScope()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (!checked) {
    return null
  }

  return null
}
