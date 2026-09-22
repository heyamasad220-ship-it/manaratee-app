import { formatCalendarToolbarDate } from "./reservation-time"
import type { CalendarReservation } from "./reservation-types"

export type CalendarListDayGroup = {
  key: string
  label: string
  reservations: CalendarReservation[]
}

export function calendarDayKey(iso: string) {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function groupCalendarReservationsByDay(
  reservations: CalendarReservation[]
): CalendarListDayGroup[] {
  const groups = new Map<string, CalendarListDayGroup>()
  const order: string[] = []

  for (const reservation of reservations) {
    const key = calendarDayKey(reservation.startAt)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        label: formatCalendarToolbarDate(new Date(reservation.startAt)),
        reservations: [],
      }
      groups.set(key, group)
      order.push(key)
    }
    group.reservations.push(reservation)
  }

  return order
    .map((key) => groups.get(key))
    .filter((group): group is CalendarListDayGroup => Boolean(group))
}
