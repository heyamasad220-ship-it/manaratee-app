import Link from "next/link"
import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { EventManagementDashboardPanels } from "@/components/events/event-management-dashboard-panels"
import {
  getEventManagementDashboard,
  parseDashboardTimePeriod,
} from "@/lib/events/internal-event-dashboard-queries"
import { getInternalEvents } from "@/lib/events/internal-event-queries"
import { requireEventWorkspaceViewPermission } from "@/lib/events/event-access"
import {
  hasAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function EventManagementOverviewContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireEventWorkspaceViewPermission()

  const resolvedSearchParams = await searchParams
  const period = parseDashboardTimePeriod(getValue(resolvedSearchParams?.period))

  const [events, canManage] = await Promise.all([
    getInternalEvents(),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])
  const dashboard = await getEventManagementDashboard(period, events)

  return (
    <>
      <Header title="Overview" />

      <div className="flex flex-col gap-6 p-6">
        <EventManagementDashboardPanels
          data={dashboard}
          period={period}
          canManage={canManage}
        />
      </div>
    </>
  )
}

export default function EventManagementOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={null}>
      <EventManagementOverviewContent searchParams={searchParams} />
    </Suspense>
  )
}
