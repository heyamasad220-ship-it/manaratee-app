/**
 * Vendor participation model (org once, event many):
 *
 * 1. Vendor submits ONE application per organization (documents + profile).
 * 2. Organizer approves → contact gets vendor affiliation (sticky).
 * 3. For each published bazaar, approved vendors reserve a booth and pay —
 *    no repeat application per event.
 *
 * Event-scoped state lives in vendor_hub_participant_status + booth assignments.
 * Org-scoped approval lives in applications + contact_roles.
 */

import { isVisibleOnCommunityCalendar } from "@/lib/vendor-hub/calendar-visibility"

export const VENDOR_ORG_APPLICATION_TYPE = "vendor" as const
export const VENDOR_ORG_APPLICATION_MODULE = "vendor_hub" as const

/** Whether a bazaar accepts self-serve booth reservations from approved org vendors. */
export function isBazaarOpenForVendorReservation(calendarStatus: string | null | undefined) {
  return isVisibleOnCommunityCalendar(calendarStatus)
}

export type ReservableBazaarEvent = {
  id: string
  organizationId: string
  organizationName: string
  name: string
  eventDate: string | null
  location: string | null
  calendarStatus: string | null
}

export type ReservableBooth = {
  id: string
  number: string
  location: string | null
  boothTypeId: string | null
  boothTypeName: string | null
  feeAmount: number
}
