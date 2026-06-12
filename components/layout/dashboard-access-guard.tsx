"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
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
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setChecked(true)
        return
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id, role, role_id")
        .eq("user_id", user.id)
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
        isOwner: membership.role === "owner",
        enabledPermissions,
      })

      if (
        facilitiesOnly &&
        !isFacilitiesRoute(pathname) &&
        !ALLOWED_NON_FACILITIES_PATHS.some((path) => pathname.startsWith(path))
      ) {
        router.replace("/facilities/reservation-center")
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
