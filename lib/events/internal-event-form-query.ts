import { isSafeReturnToPath } from "@/lib/navigation/return-to"
import type { InternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"

export type InternalEventFormQuery = {
  venueId?: string
  start?: string
  end?: string
  department?: string
  returnTo?: string
}

export function mergeInternalEventFormDefaults(
  defaults: InternalEventFormDefaults,
  departmentIdFromQuery?: string | null
): InternalEventFormDefaults {
  const departmentId = departmentIdFromQuery?.trim() || defaults.departmentId
  return {
    ...defaults,
    departmentId: departmentId || null,
  }
}

export function resolveInternalEventFormReturnTo(
  returnToFromQuery?: string | null
): string | null {
  return isSafeReturnToPath(returnToFromQuery) ? returnToFromQuery : null
}
