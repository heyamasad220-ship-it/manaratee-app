"use client"

import { Flag, Home, User } from "lucide-react"

import { groupCalendarReservationsByDay } from "@/lib/reservations/calendar-list"
import { formatTimeRange } from "@/lib/reservations/reservation-time"
import type {
  CalendarReservation,
  ReservationSourceType,
} from "@/lib/reservations/reservation-types"
import { SOURCE_TYPE_LABELS } from "@/lib/reservations/reservation-types"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"
import { cn } from "@/lib/utils"

const LIST_DOT_COLORS: Record<ReservationSourceType, string> = {
  venue_rental: "bg-blue-600",
  internal_event: "bg-violet-600",
  program_facility: "bg-emerald-600",
  maintenance_block: "bg-slate-600",
  space_closure: "bg-red-600",
}

function spaceLabel(reservation: CalendarReservation) {
  return reservation.spaceLabel || reservation.venueName || "Unassigned space"
}

function holderPresentation(reservation: CalendarReservation) {
  if (reservation.contactName) {
    return {
      icon: "user" as const,
      label: reservation.holderLabel || SOURCE_TYPE_LABELS[reservation.sourceType],
    }
  }

  return {
    icon: "home" as const,
    label: reservation.holderLabel || "No holder",
  }
}

export function ReservationCalendarList({
  reservations,
  conflictIds,
  onSelectReservation,
}: {
  reservations: CalendarReservation[]
  conflictIds: Set<string>
  onSelectReservation: (reservation: CalendarReservation) => void
}) {
  const groups = groupCalendarReservationsByDay(reservations)

  if (groups.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        No reservations in this date range.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="border-b border-violet-100 bg-violet-50/70 px-4 py-2 text-sm font-semibold tracking-wide text-violet-700">
            {group.label}
          </h3>
          <ul>
            {group.reservations.map((reservation) => {
              const holder = holderPresentation(reservation)
              const phone = formatPhoneDisplay(reservation.contactPhone)
              const hasConflict = conflictIds.has(reservation.id)
              const HolderIcon = holder.icon === "user" ? User : Home

              return (
                <li key={reservation.id}>
                  <button
                    type="button"
                    onClick={() => onSelectReservation(reservation)}
                    className={cn(
                      "grid w-full grid-cols-1 gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(11rem,13rem)_minmax(8rem,14rem)_minmax(9rem,12rem)_minmax(0,1fr)] sm:items-center",
                      hasConflict && "bg-red-50 hover:bg-red-50"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium text-violet-800">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          LIST_DOT_COLORS[reservation.sourceType]
                        )}
                        aria-hidden
                      />
                      <span className="truncate">
                        {formatTimeRange(reservation.startAt, reservation.endAt)}
                      </span>
                    </span>
                    <span className="truncate text-muted-foreground">
                      {spaceLabel(reservation)}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                      <HolderIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">({holder.label})</span>
                    </span>
                    <span className="min-w-0 text-foreground">
                      <span className="font-medium">{reservation.title}</span>
                      {reservation.contactName ? (
                        <span className="text-muted-foreground">
                          {" | "}
                          <Flag className="mr-1 inline h-3.5 w-3.5 align-text-top" />
                          PoC: {reservation.contactName}
                          {phone ? ` ${phone}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
