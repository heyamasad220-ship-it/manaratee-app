import type { ApplicationStatus } from "@/lib/applications/application-types"

export type ApplicationStatusTabId =
  | "all"
  | "pending_review"
  | "approved"
  | "rejected"
  | "draft"
  | "submitted"
  | "withdrawn"

export type ApplicationStatusTab = {
  id: ApplicationStatusTabId
  label: string
  /** null = no status filter (show all) */
  statuses: ApplicationStatus[] | null
}

/** Primary list tabs shown on module Applications pages. Extend here for new statuses. */
export const APPLICATION_LIST_STATUS_TABS: ApplicationStatusTab[] = [
  { id: "all", label: "All", statuses: null },
  {
    id: "pending_review",
    label: "Pending Review",
    statuses: ["submitted", "pending_review"],
  },
  { id: "approved", label: "Approved", statuses: ["approved"] },
  { id: "rejected", label: "Rejected", statuses: ["rejected"] },
]

/** Optional tabs for future use (not shown by default). */
export const APPLICATION_EXTENDED_STATUS_TABS: ApplicationStatusTab[] = [
  { id: "draft", label: "Draft", statuses: ["draft"] },
  { id: "submitted", label: "Submitted", statuses: ["submitted"] },
  { id: "withdrawn", label: "Withdrawn", statuses: ["withdrawn"] },
]

export function getApplicationStatusTab(id: string | null | undefined): ApplicationStatusTab {
  const match =
    APPLICATION_LIST_STATUS_TABS.find((tab) => tab.id === id) ??
    APPLICATION_EXTENDED_STATUS_TABS.find((tab) => tab.id === id)
  return match ?? APPLICATION_LIST_STATUS_TABS[0]
}

export function statusTabIdFromQueryParam(
  value: string | null | undefined
): ApplicationStatusTabId {
  if (!value || value === "all") return "all"
  const tab = getApplicationStatusTab(value)
  return tab.id
}

export function statusesForTab(tabId: ApplicationStatusTabId): ApplicationStatus[] | null {
  return getApplicationStatusTab(tabId).statuses
}

export function statusFilterValueForTab(tabId: ApplicationStatusTabId): string {
  const statuses = statusesForTab(tabId)
  if (!statuses || statuses.length === 0) return "all"
  return statuses.join(",")
}

export function tabIdFromStatusFilter(filter: string): ApplicationStatusTabId {
  if (filter === "all") return "all"
  const match = APPLICATION_LIST_STATUS_TABS.find((tab) => {
    if (!tab.statuses) return false
    return tab.statuses.join(",") === filter
  })
  return match?.id ?? "all"
}

export type ApplicationDashboardCardId =
  | "total"
  | "pending_review"
  | "approved"
  | "rejected"

export function dashboardCardToTabId(cardId: ApplicationDashboardCardId): ApplicationStatusTabId {
  if (cardId === "total") return "all"
  return cardId
}
