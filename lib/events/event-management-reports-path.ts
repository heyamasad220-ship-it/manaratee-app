export const EVENT_MANAGEMENT_REPORTS_PATH = "/event-management/reports"
export const EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH =
  "/event-management/reports/childcare"

export type EventManagementReportsTabId = "childcare"

export const EVENT_MANAGEMENT_REPORTS_TABS: Array<{
  id: EventManagementReportsTabId
  label: string
  href: string
}> = [
  {
    id: "childcare",
    label: "Childcare",
    href: EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH,
  },
]
