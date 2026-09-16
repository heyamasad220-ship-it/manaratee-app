import { redirect } from "next/navigation"

import { isSafeReturnToPath } from "@/lib/navigation/return-to"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

/**
 * Legacy request route — event creation stays on Event Management (or returnTo).
 */
export default async function RequestInternalEventRedirectPage({
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
  await requireAnyPermission(
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const params = await searchParams
  const returnTo = isSafeReturnToPath(params?.returnTo) ? params?.returnTo : null
  if (returnTo) {
    redirect(returnTo)
  }

  redirect("/event-management/events?create=1")
}
