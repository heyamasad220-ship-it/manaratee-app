import type { InternalEventStatus } from "./internal-event-status"
import type { EventServiceRequirements } from "./event-service-requirements"
import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"
import type { InternalEventLocationType } from "./internal-event-location"

export interface InternalEvent {
  id: string
  organization_id: string
  department_id: string
  event_type_id: string
  name: string
  description: string | null
  status: InternalEventStatus
  start_at: string | null
  end_at: string | null
  venue_id: string | null
  location_type?: InternalEventLocationType | null
  location_label: string | null
  location_address?: string | null
  /** Buffer before event start — occupied window on shared calendar. */
  setup_minutes?: number
  /** Buffer after event end — occupied window on shared calendar. */
  cleanup_minutes?: number
  timezone: string | null
  requires_volunteers?: boolean
  requires_childcare?: boolean
  requires_vendors?: boolean
  requires_ticketing?: boolean
  service_requirements?: EventServiceRequirements
  ticketing_config?: EventTicketingConfig
  /** Community Calendar visibility (private / community_visible / published). */
  community_calendar_status?: string | null
  submitted_at: string | null
  approved_at: string | null
  declined_at: string | null
  decline_reason: string | null
  recurrence_config: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InternalEventWithRelations extends InternalEvent {
  departments: { id: string; name: string; color: string } | null
  event_types: { id: string; name: string } | null
  venues: { id: string; name: string } | null
  internal_event_venues?: { venue_id: string }[] | null
  /** Convenience list of facility venue ids (from junction or primary venue). */
  venue_ids?: string[]
}
