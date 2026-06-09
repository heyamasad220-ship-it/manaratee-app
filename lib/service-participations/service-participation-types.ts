import type { EventServiceRequirements } from "@/lib/events/event-service-requirements"

export type ServiceParticipationSourceType = "internal_event" | "program"

export type ServiceParticipationType =
  | "volunteer"
  | "childcare_provider"
  | "vendor"

export type ServiceParticipationStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"

export type ServiceParticipation = {
  id: string
  organization_id: string
  source_type: ServiceParticipationSourceType
  source_id: string
  contact_id: string
  participation_type: ServiceParticipationType
  volunteer_role: string | null
  notes: string | null
  status: ServiceParticipationStatus
  created_at: string
  updated_at: string
}

export type ServiceParticipationWithContact = ServiceParticipation & {
  contact_name: string
  contact_email: string | null
}

export type ServiceOpportunity = {
  sourceType: ServiceParticipationSourceType
  sourceId: string
  title: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  locationLabel: string | null
  requiresVolunteers: boolean
  requiresChildcare: boolean
  requiresVendors: boolean
  serviceRequirements: EventServiceRequirements
  /** Participation types the current user may sign up for on this opportunity */
  eligibleParticipationTypes: ServiceParticipationType[]
  /** Types the user already signed up for (pending or confirmed) */
  myParticipationTypes: ServiceParticipationType[]
  childcareEventId: string | null
}

export const SERVICE_PARTICIPATION_TYPE_LABELS: Record<ServiceParticipationType, string> = {
  volunteer: "Volunteer",
  childcare_provider: "Childcare provider",
  vendor: "Vendor",
}

export const SERVICE_PARTICIPATION_STATUS_LABELS: Record<ServiceParticipationStatus, string> = {
  pending: "Pending approval",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
}
