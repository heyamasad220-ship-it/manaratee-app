import { parseEventStaffAssignmentMeta } from "@/lib/service-participations/service-participation-types"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

import { signUpOverviewSource } from "@/lib/sign-ups/sign-up-overview"

export type SignUpReportVolunteer = {
  id: string
  eventName: string
  eventHref: string
  volunteerName: string
  email: string | null
  phone: string | null
  slot: string | null
  time: string | null
}

export function signUpReportSlotAndTime(input: {
  volunteerRole: string | null
  assignmentMeta: unknown
}): { slot: string | null; time: string | null } {
  const meta = parseEventStaffAssignmentMeta(input.assignmentMeta)
  return {
    slot: input.volunteerRole?.trim() || null,
    time: meta.shiftLabel?.trim() || null,
  }
}

export function signUpReportEvent(input: {
  eventId: string
  eventName: string | null
  sourceModule: string | null
  bazaarId: string | null
  bazaarName: string | null
}): { eventName: string; eventHref: string } {
  const source = input.bazaarId
    ? "vendor-hub"
    : signUpOverviewSource(input.sourceModule)
  const eventName =
    (source === "vendor-hub" ? input.bazaarName : input.eventName)?.trim() ||
    input.eventName?.trim() ||
    "Untitled event"

  return {
    eventName,
    eventHref:
      source === "vendor-hub" && input.bazaarId
        ? VENDOR_HUB_ROUTES.events.detail(input.bazaarId)
        : `/event-management/${input.eventId}`,
  }
}
