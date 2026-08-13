import { redirect } from "next/navigation"

import { eventManagementMasterCalendarHref } from "@/lib/events/event-management-section-path"

/** Former Departments Master Calendar — now under Events. */
export default async function DepartmentsMasterCalendarRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    department?: string
    returnTo?: string
  }>
}) {
  const params = await searchParams
  redirect(
    eventManagementMasterCalendarHref({
      month: params.month,
      departmentId: params.department,
      returnTo: params.returnTo,
    })
  )
}
