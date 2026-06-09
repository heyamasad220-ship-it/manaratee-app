import { getCalendarData } from "@/lib/reservations/reservation-queries"
import { computeReservationConflicts } from "@/lib/reservations/reservation-conflicts"
import { SOURCE_TYPE_LABELS } from "@/lib/reservations/reservation-types"
import type { ReservationSourceType } from "@/lib/reservations/reservation-types"

export type MasterCalendarConflictPreview = {
  conflictCount: number
  previews: Array<{
    id: string
    titleA: string
    titleB: string
    sourceTypeA: string
    sourceTypeB: string
    overlapLabel: string
  }>
}

export async function getMasterCalendarConflictSummary(): Promise<MasterCalendarConflictPreview> {
  const data = await getCalendarData("facilities", new Date(), "week")
  const conflicts = computeReservationConflicts(data.reservations, data.venues)

  const previews = conflicts.conflictPairs.slice(0, 5).map(({ a, b }) => ({
    id: `${a.id}-${b.id}`,
    titleA: a.title,
    titleB: b.title,
    sourceTypeA: SOURCE_TYPE_LABELS[a.sourceType as ReservationSourceType] ?? a.sourceType,
    sourceTypeB: SOURCE_TYPE_LABELS[b.sourceType as ReservationSourceType] ?? b.sourceType,
    overlapLabel: `${new Date(a.startAt).toLocaleString()} – ${new Date(a.endAt).toLocaleTimeString()}`,
  }))

  return {
    conflictCount: conflicts.conflictCount,
    previews,
  }
}
