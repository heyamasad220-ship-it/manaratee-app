import { redirect } from "next/navigation"

import { buildFacilitiesBookSpaceHref } from "@/lib/events/facility-event-request-href"
import { isSafeReturnToPath } from "@/lib/navigation/return-to"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

/**
 * Legacy create route — event creation now opens from Facilities calendar.
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
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const params = await searchParams
  const returnTo = isSafeReturnToPath(params?.returnTo) ? params?.returnTo : null

  redirect(
    buildFacilitiesBookSpaceHref({
      departmentId: params?.department || null,
      returnTo,
      openNew: true,
      venueId: params?.venueId || null,
      start: params?.start || null,
      end: params?.end || null,
    })
  )
}
