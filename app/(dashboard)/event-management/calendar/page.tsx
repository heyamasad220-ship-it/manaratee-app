import { redirect } from "next/navigation"

import { departmentsMasterCalendarHref } from "@/lib/departments/departments-section-path"

/** Former Event Management Master Calendar — now under Departments. */
export default async function EventManagementCalendarRedirectPage({
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
    departmentsMasterCalendarHref({
      month: params.month,
      departmentId: params.department,
      returnTo: params.returnTo,
    })
  )
}
