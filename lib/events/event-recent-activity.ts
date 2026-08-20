export type EventRecentActivityItem = {
  id: string
  when: string
  label: string
}

export function buildEventRecentActivity(input: {
  attendees: Array<{
    id: string
    attendeeName: string | null
    ticketTypeName: string
    status: string
    checkedInAt: string | null
    createdAt: string
  }>
  staffParticipations: Array<{
    id: string
    contact_name: string
    participation_type: string
    status: string
    updated_at?: string | null
    created_at: string
  }>
  limit?: number
}): EventRecentActivityItem[] {
  const items: EventRecentActivityItem[] = []

  for (const row of input.attendees) {
    if (row.checkedInAt) {
      items.push({
        id: `checkin-${row.id}`,
        when: row.checkedInAt,
        label: `${row.attendeeName || "Attendee"} checked in (${row.ticketTypeName})`,
      })
    } else if (row.status === "valid" || row.status === "waitlisted") {
      items.push({
        id: `reg-${row.id}`,
        when: row.createdAt,
        label: `${row.attendeeName || "Attendee"} registered (${row.ticketTypeName})`,
      })
    }
  }

  for (const row of input.staffParticipations) {
    if (row.status === "confirmed") {
      items.push({
        id: `staff-${row.id}`,
        when: row.updated_at || row.created_at,
        label: `${row.contact_name} confirmed as ${row.participation_type}`,
      })
    }
  }

  return items
    .filter((item) => item.when)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, input.limit ?? 12)
}

export function formatActivityWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
