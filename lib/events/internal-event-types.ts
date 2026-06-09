import type { InternalEventStatus } from "./internal-event-status"
import type { EventServiceRequirements } from "./event-service-requirements"
import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"

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
  location_label: string | null
  timezone: string | null
  requires_volunteers?: boolean
  requires_childcare?: boolean
  requires_vendors?: boolean
  requires_ticketing?: boolean
  service_requirements?: EventServiceRequirements
  ticketing_config?: EventTicketingConfig
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
}
