export type ChildcareRegistrationStatus =
  | "confirmed"
  | "pending"
  | "waitlisted"
  | "cancelled"

export interface ChildcareEvent {
  id: string
  organization_id: string
  name: string
  event_date: string
  start_time: string | null
  end_time: string | null
  capacity: number
  notes: string | null
  is_active: boolean
  assigned_provider_contact_id: string | null
}

export interface ChildcareEventSummary extends ChildcareEvent {
  registered_count: number
  assigned_provider_name: string | null
}

export interface ChildcareRegistration {
  id: string
  organization_id: string
  childcare_event_id: string
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  status: ChildcareRegistrationStatus
  allergies: string | null
  notes: string | null
  event_name: string
  event_date: string
  start_time: string | null
  end_time: string | null
}

export interface ChildcareRegistrationStats {
  total: number
  confirmed: number
  waitlisted: number
  pending: number
}

export const CHILDCARE_REGISTRATION_STATUS_LABELS: Record<
  ChildcareRegistrationStatus,
  string
> = {
  confirmed: "Confirmed",
  pending: "Pending",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
}

export type ChildcareRegistrationInput = {
  childcare_event_id: string
  child_name: string
  child_age?: number | null
  parent_name?: string | null
  parent_email?: string | null
  parent_phone?: string | null
  status?: ChildcareRegistrationStatus
  allergies?: string | null
  notes?: string | null
}

export type ChildcareEventInput = {
  name: string
  event_date: string
  start_time?: string | null
  end_time?: string | null
  capacity?: number
  notes?: string | null
}
