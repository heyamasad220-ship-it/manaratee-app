export type CommunityCalendarVisibility = "private" | "published"

export const COMMUNITY_CALENDAR_VISIBILITY_OPTIONS: {
  value: CommunityCalendarVisibility
  label: string
  description: string
}[] = [
  {
    value: "private",
    label: "Private",
    description: "Staff only — not shown on the community calendar.",
  },
  {
    value: "published",
    label: "Public",
    description: "Listed on the community calendar (staff and public page).",
  },
]

export const CALENDAR_VISIBILITY_LABELS: Record<string, string> = {
  private: "Private",
  not_published: "Private",
  ready_to_publish: "Private",
  /** Legacy middle tier — treated as Public in the UI. */
  community_visible: "Public",
  published: "Public",
}

/** Map UI visibility to the value stored on event rows. */
export function calendarStatusFromVisibility(
  visibility: CommunityCalendarVisibility
): string {
  if (visibility === "private") {
    return "not_published"
  }
  return "published"
}

/** Map stored status back to UI visibility. */
export function visibilityFromCalendarStatus(
  status: string | null | undefined
): CommunityCalendarVisibility {
  // Legacy `community_visible` maps to Public so existing listings stay editable as Public.
  if (status === "published" || status === "community_visible") {
    return "published"
  }
  return "private"
}

export function isVisibleOnCommunityCalendar(status: string | null | undefined) {
  return status === "community_visible" || status === "published"
}
