export type CommunityCalendarVisibility =
  | "private"
  | "community_visible"
  | "published"

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
    value: "community_visible",
    label: "Community Visible",
    description: "Visible to organization members on the community calendar.",
  },
  {
    value: "published",
    label: "Public",
    description: "Publicly listed on the community calendar.",
  },
]

export const CALENDAR_VISIBILITY_LABELS: Record<string, string> = {
  private: "Private",
  not_published: "Private",
  ready_to_publish: "Private",
  community_visible: "Community Visible",
  published: "Public",
}

/** Map UI visibility to the value stored on event rows. */
export function calendarStatusFromVisibility(
  visibility: CommunityCalendarVisibility
): string {
  if (visibility === "private") {
    return "not_published"
  }
  return visibility
}

/** Map stored status back to UI visibility. */
export function visibilityFromCalendarStatus(
  status: string | null | undefined
): CommunityCalendarVisibility {
  if (status === "community_visible") {
    return "community_visible"
  }
  if (status === "published") {
    return "published"
  }
  return "private"
}

export function isVisibleOnCommunityCalendar(status: string | null | undefined) {
  return status === "community_visible" || status === "published"
}
