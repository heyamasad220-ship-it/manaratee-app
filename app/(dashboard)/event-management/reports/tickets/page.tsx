import { TicketingReportsClient } from "@/components/tickets/ticketing-reports-client"
import {
  getTicketingReports,
  parseTicketingReportRangeKey,
} from "@/lib/tickets/ticketing-reports-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementTicketReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAnyPermission(
    PERMISSIONS.TICKETING_VIEW,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  )

  const resolved = await searchParams
  const rangeParam = resolved?.range
  const rangeKey = parseTicketingReportRangeKey(
    Array.isArray(rangeParam) ? rangeParam[0] : rangeParam
  )
  const data = await getTicketingReports(rangeKey)

  return <TicketingReportsClient data={data} rangeKey={rangeKey} />
}
