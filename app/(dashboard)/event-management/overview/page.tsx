import { Suspense } from "react"

import { EventManagementOverviewClient } from "@/components/events/event-management-overview-client"
import {
  getEventManagementDashboard,
  parseDashboardTimePeriod,
} from "@/lib/events/internal-event-dashboard-queries"
import { getPendingInternalEventRequests } from "@/lib/events/internal-event-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key]
  return Array.isArray(value) ? value[0] : value
}

async function OverviewContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const resolvedSearchParams = await searchParams
  const period = parseDashboardTimePeriod(getSearchParam(resolvedSearchParams, "period"))

  const [data, canManage, requests] = await Promise.all([
    getEventManagementDashboard(period),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    getPendingInternalEventRequests(),
  ])

  return (
    <EventManagementOverviewClient
      data={data}
      period={period}
      canManage={canManage}
      pendingRequests={requests}
    />
  )
}

export default function EventManagementOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={null}>
      <OverviewContent searchParams={searchParams} />
    </Suspense>
  )
}
