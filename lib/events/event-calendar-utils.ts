import { toDatetimeLocalValue } from "@/components/ui/datetime-input"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"

export type EventCalendarGridItem = {
  id: string
  title: string
  space: string
  eventDate: string
  startHour: number
  durationHours: number
  status: string
  booker?: string
}

function toLocalDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export type CalendarSlotSelection = {
  date: Date
  hour?: number
  spaceName?: string
  venueId?: string
}

export function internalEventsToGridItems(
  events: InternalEventWithRelations[]
): EventCalendarGridItem[] {
  return events
    .map((event) => {
      if (!event.start_at) return null

      const start = new Date(event.start_at)
      if (Number.isNaN(start.getTime())) return null

      const end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 60 * 60 * 1000)
      const durationMs = Math.max(end.getTime() - start.getTime(), 60 * 60 * 1000)

      return {
        id: event.id,
        title: event.name,
        space: event.venues?.name || event.location_label || "Unassigned",
        eventDate: toLocalDateKey(start),
        startHour: start.getHours(),
        durationHours: Math.max(1, Math.round(durationMs / (60 * 60 * 1000))),
        status: event.status,
        booker: event.departments?.name || undefined,
      }
    })
    .filter(Boolean) as EventCalendarGridItem[]
}

export function buildEventFormPathFromSlot(
  slot: CalendarSlotSelection,
  canManage: boolean
): string {
  const basePath = canManage ? "/event-management/create" : "/event-management/request"
  const params = new URLSearchParams()

  if (slot.venueId) {
    params.set("venueId", slot.venueId)
  }

  if (slot.hour != null) {
    const start = new Date(slot.date)
    start.setHours(slot.hour, 0, 0, 0)
    const end = new Date(start)
    end.setHours(start.getHours() + 1)

    params.set("start", toDatetimeLocalValue(start))
    params.set("end", toDatetimeLocalValue(end))
  } else {
    const start = new Date(slot.date)
    start.setHours(9, 0, 0, 0)
    const end = new Date(slot.date)
    end.setHours(10, 0, 0, 0)
    params.set("start", toDatetimeLocalValue(start))
    params.set("end", toDatetimeLocalValue(end))
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
