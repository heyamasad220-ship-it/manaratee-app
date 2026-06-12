export const OPERATIONAL_BRIEF_SOURCE_TYPES = {
  internalEvent: "internal_event",
  venueRental: "venue_rental",
  program: "program",
  maintenance: "maintenance",
} as const

export type OperationalBriefSourceType =
  (typeof OPERATIONAL_BRIEF_SOURCE_TYPES)[keyof typeof OPERATIONAL_BRIEF_SOURCE_TYPES]

export const OPERATIONAL_BRIEF_SETUP_STATUSES = {
  notStarted: "not_started",
  needsReview: "needs_review",
  readyForSetup: "ready_for_setup",
  setupInProgress: "setup_in_progress",
  setupComplete: "setup_complete",
  issueReported: "issue_reported",
  closed: "closed",
} as const

export type OperationalBriefSetupStatus =
  (typeof OPERATIONAL_BRIEF_SETUP_STATUSES)[keyof typeof OPERATIONAL_BRIEF_SETUP_STATUSES]

export const OPERATIONAL_BRIEF_SETUP_STATUS_LABELS: Record<
  OperationalBriefSetupStatus,
  string
> = {
  not_started: "Not started",
  needs_review: "Needs review",
  ready_for_setup: "Ready for setup",
  setup_in_progress: "Setup in progress",
  setup_complete: "Setup complete",
  issue_reported: "Issue reported",
  closed: "Closed",
}

export interface OperationalBriefRecord {
  id: string
  organization_id: string
  source_type: OperationalBriefSourceType
  source_id: string | null
  reservation_id: string | null
  title: string
  event_date: string | null
  start_time: string | null
  end_time: string | null
  primary_contact_person_id: string | null
  primary_contact_name: string | null
  primary_contact_phone: string | null
  internal_coordinator_person_id: string | null
  internal_coordinator_name: string | null
  internal_coordinator_phone: string | null
  internal_coordinator_email: string | null
  expected_attendance: number | null
  setup_style: string | null
  room_setup_notes: string | null
  equipment_notes: string | null
  food_beverage_notes: string | null
  table_linen_notes: string | null
  cleanup_notes: string | null
  accessibility_notes: string | null
  special_requests: string | null
  facility_notes: string | null
  setup_status: OperationalBriefSetupStatus
  source_status: string | null
  visibility_level: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type OperationalBriefUpsertInput = {
  organization_id: string
  source_type: OperationalBriefSourceType
  source_id?: string | null
  reservation_id?: string | null
  title: string
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  primary_contact_person_id?: string | null
  primary_contact_name?: string | null
  primary_contact_phone?: string | null
  internal_coordinator_person_id?: string | null
  internal_coordinator_name?: string | null
  internal_coordinator_phone?: string | null
  internal_coordinator_email?: string | null
  expected_attendance?: number | null
  setup_style?: string | null
  room_setup_notes?: string | null
  equipment_notes?: string | null
  food_beverage_notes?: string | null
  table_linen_notes?: string | null
  cleanup_notes?: string | null
  accessibility_notes?: string | null
  special_requests?: string | null
  facility_notes?: string | null
  setup_status?: OperationalBriefSetupStatus
  source_status?: string | null
  created_by?: string | null
  updated_by?: string | null
}

export type OperationalBriefView = {
  id: string
  sourceType: OperationalBriefSourceType
  sourceTypeLabel: string
  title: string
  eventDate: string | null
  startTime: string | null
  endTime: string | null
  spacesLabel: string | null
  expectedAttendance: number | null
  setupStyle: string | null
  roomSetupNotes: string | null
  equipmentNotes: string | null
  foodBeverageNotes: string | null
  tableLinenNotes: string | null
  cleanupNotes: string | null
  accessibilityNotes: string | null
  specialRequests: string | null
  facilityNotes: string | null
  primaryContactName: string | null
  primaryContactPhone: string | null
  internalCoordinatorName: string | null
  internalCoordinatorPhone: string | null
  internalCoordinatorEmail: string | null
  setupStatus: OperationalBriefSetupStatus
  setupStatusLabel: string
  sourceStatus: string | null
  sourceRecordHref: string | null
  canOpenSourceRecord: boolean
  canEditSetupFields: boolean
  isFacilitiesOnly: boolean
}

export type OperationalBriefPermissionContext = {
  canOpenVenueRentalRecord: boolean
  canOpenInternalEventRecord: boolean
  canOpenProgramRecord: boolean
  canEditSetupFields: boolean
  isFacilitiesOnly: boolean
}
