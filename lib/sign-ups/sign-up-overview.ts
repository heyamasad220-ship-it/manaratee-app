import { eventHasEnded } from "@/lib/events/internal-event-format"
import { parseServiceRequirements } from "@/lib/events/event-service-requirements"
import { INTERNAL_EVENT_SOURCE_MODULE } from "@/lib/events/internal-event-source"
import { volunteerOpeningsFromConfig } from "@/lib/events/volunteer-windows"

export type SignUpOverviewSource = "event-management" | "vendor-hub"

export type SignUpOverviewWhen = "upcoming" | "past" | "all"

export type SignUpOverviewEvent = {
  id: string
  name: string
  source: SignUpOverviewSource
  href: string
  startAt: string | null
  endAt: string | null
  location: string | null
  status: string
  volunteersFilled: number
  volunteersNeeded: number | null
}

const HIDDEN_STATUSES = new Set(["cancelled", "declined"])

export function isSignUpOverviewStatusVisible(status: string | null | undefined) {
  return !HIDDEN_STATUSES.has((status || "").trim().toLowerCase())
}

export function signUpOverviewSource(sourceModule: string | null | undefined): SignUpOverviewSource {
  return sourceModule === INTERNAL_EVENT_SOURCE_MODULE.vendorHub
    ? "vendor-hub"
    : "event-management"
}

/** Open volunteer slots across every time window. */
export function volunteerSlotsNeeded(value: unknown): number | null {
  return volunteerOpeningsFromConfig(parseServiceRequirements(value).volunteers)
}

export function signUpOverviewWhenMatches(
  event: { startAt: string | null; endAt: string | null },
  when: SignUpOverviewWhen,
  now = new Date()
) {
  if (when === "all") return true
  const ended = eventHasEnded(
    { start_at: event.startAt, end_at: event.endAt },
    now
  )
  return when === "past" ? ended : !ended
}

export function formatVolunteerCoverage(filled: number, needed: number | null) {
  if (needed == null) {
    return filled === 0 ? "Needed" : `${filled} assigned`
  }
  return `${filled} / ${needed}`
}

export function signUpOverviewSourceLabel(source: SignUpOverviewSource) {
  return source === "vendor-hub" ? "Vendor Hub" : "Event Management"
}
