import { redirect } from "next/navigation"

import { isSafeReturnToPath } from "@/lib/navigation/return-to"
import { getDepartmentHeadshipForCurrentUser } from "@/lib/departments/department-access"
import {
  hasAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"

/**
 * Legacy create route — event creation stays on Event Management (or returnTo).
 */
export default async function CreateInternalEventRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{
    department?: string
    returnTo?: string
    venueId?: string
    start?: string
    end?: string
  }>
}) {
  const canCreate =
    (await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )) || Boolean(await getDepartmentHeadshipForCurrentUser())
  if (!canCreate) {
    redirect("/unauthorized")
  }

  const params = await searchParams
  const returnTo = isSafeReturnToPath(params?.returnTo) ? params?.returnTo : null
  if (returnTo) {
    redirect(returnTo)
  }

  redirect("/event-management/events?create=1")
}
