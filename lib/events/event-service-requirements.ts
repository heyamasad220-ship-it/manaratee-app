export type EventVolunteerShift = {
  id: string
  /** HH:mm or datetime-local fragment */
  start: string
  end: string
  location?: string | null
}

export type EventVolunteerRole = {
  name: string
  slots: number
  description?: string | null
  staffAllowed?: boolean
  volunteerAllowed?: boolean
  shifts?: EventVolunteerShift[]
}

export type EventChildcareAgeGroup = {
  ageRange: string
  capacity: number
}

export type EventYouthOffering = "childcare" | "field_trip"

export type EventYouthGender = "all" | "male" | "female"

/** Youth group — source of truth for ages/capacity/questions. */
export type EventYouthGroup = {
  id: string
  offering: EventYouthOffering
  ageMin?: number
  ageMax?: number
  /** Derived label e.g. "1-4" for legacy ageGroups sync */
  ageRange: string
  gender: EventYouthGender
  capacity: number
  registrationDeadline?: string | null
  /** Field trip only */
  venueName?: string | null
  venueAddress?: string | null
  /** @deprecated Use venueName */
  fieldTripName?: string | null
  /** @deprecated Use venueAddress */
  fieldTripLocation?: string | null
  /** @deprecated Derived from offering */
  locationMode?: "same_as_event" | "field_trip"
  ticketTypeId?: string | null
  includeYouthQuestions?: boolean
}

export type EventVendorSlot = {
  vendorTypeId: string
  vendorTypeName: string
  quantity: number
  fee: number | null
}

export const CHILDCARE_AGE_RANGE_OPTIONS = [
  { value: "0-2", label: "0–2 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "6-10", label: "6–10 years" },
  { value: "0-10", label: "All ages (0–10)" },
] as const

export const YOUTH_OFFERING_OPTIONS: Array<{
  value: EventYouthOffering
  label: string
}> = [
  { value: "childcare", label: "Childcare" },
  { value: "field_trip", label: "Field trip" },
]

export const YOUTH_GENDER_OPTIONS: Array<{
  value: EventYouthGender
  label: string
}> = [
  { value: "all", label: "All genders" },
  { value: "male", label: "Boys" },
  { value: "female", label: "Girls" },
]

export type EventServiceRequirements = {
  volunteers?: {
    maxVolunteers?: number | null
    roles?: EventVolunteerRole[]
  }
  childcare?: {
    /** Preferred: childcare / field trip groups */
    groups?: EventYouthGroup[]
    ageGroups?: EventChildcareAgeGroup[]
    /** @deprecated Use groups / ageGroups */
    capacity?: number | null
    /** @deprecated Use groups / ageGroups */
    ageRange?: string | null
    registrationDeadline?: string | null
    /** When true, guardians must sign a liability waiver before check-in. */
    requireWaiver?: boolean
  }
  vendors?: {
    slots?: EventVendorSlot[]
    /** @deprecated Use slots */
    maxVendors?: number | null
    applicationDeadline?: string | null
    /** @deprecated Use slots */
    fee?: number | null
    approvalRequired?: boolean
  }
}

export type YouthGroupFormRow = {
  id: string
  offering: EventYouthOffering
  ageMin: string
  ageMax: string
  gender: EventYouthGender
  capacity: string
  registrationDeadline: string
  venueName: string
  venueAddress: string
  ticketTypeId: string
  includeYouthQuestions: boolean
}

/** @deprecated Prefer YouthGroupFormRow */
export type ChildcareAgeGroupFormRow = {
  id: string
  ageRange: string
  capacity: string
}

export type VendorSlotFormRow = {
  id: string
  vendorTypeId: string
  vendorTypeName: string
  quantity: string
  fee: string
}

export type EventServiceRequirementsFormState = {
  requiresVolunteers: boolean
  requiresChildcare: boolean
  requiresVendors: boolean
  maxVolunteers: string
  volunteerRoles: Array<{
    id: string
    name: string
    slots: string
    description: string
    staffAllowed: boolean
    volunteerAllowed: boolean
    shifts: Array<{
      id: string
      start: string
      end: string
      location: string
    }>
  }>
  youthGroups: YouthGroupFormRow[]
  /** @deprecated Synced from youthGroups for older callers */
  childcareAgeGroups: ChildcareAgeGroupFormRow[]
  childcareDeadline: string
  requireYouthWaiver: boolean
  vendorSlots: VendorSlotFormRow[]
  vendorDeadline: string
  vendorApprovalRequired: boolean
}

export function createEmptyVolunteerShift(partial?: {
  id?: string
  start?: string
  end?: string
  location?: string
}) {
  return {
    id: partial?.id || `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    start: partial?.start || "",
    end: partial?.end || "",
    location: partial?.location || "",
  }
}

export function createEmptyVolunteerRole(partial?: {
  id?: string
  name?: string
  slots?: string
}) {
  return {
    id: partial?.id || `role-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: partial?.name || "",
    slots: partial?.slots || "1",
    description: "",
    staffAllowed: true,
    volunteerAllowed: true,
    shifts: [] as Array<{
      id: string
      start: string
      end: string
      location: string
    }>,
  }
}

export function createEmptyYouthGroup(
  partial?: Partial<YouthGroupFormRow>
): YouthGroupFormRow {
  return {
    id: `youth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    offering: "childcare",
    ageMin: "",
    ageMax: "",
    gender: "all",
    capacity: "",
    registrationDeadline: "",
    venueName: "",
    venueAddress: "",
    ticketTypeId: "",
    includeYouthQuestions: true,
    ...partial,
  }
}

export const DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM: EventServiceRequirementsFormState = {
  requiresVolunteers: false,
  requiresChildcare: false,
  requiresVendors: false,
  maxVolunteers: "",
  volunteerRoles: [],
  youthGroups: [],
  childcareAgeGroups: [],
  childcareDeadline: "",
  requireYouthWaiver: false,
  vendorSlots: [],
  vendorDeadline: "",
  vendorApprovalRequired: true,
}

function normalizeYouthOffering(
  value: unknown,
  locationMode?: unknown
): EventYouthOffering {
  if (value === "field_trip") return "field_trip"
  if (value === "childcare" || value === "babysitting") return "childcare"
  if (value === "kids_program") {
    return locationMode === "field_trip" ? "field_trip" : "childcare"
  }
  return "childcare"
}

function isYouthGender(value: unknown): value is EventYouthGender {
  return value === "all" || value === "male" || value === "female"
}

function parseAgeBounds(ageRange: string | null | undefined): {
  ageMin: string
  ageMax: string
} {
  const trimmed = (ageRange || "").trim()
  const match = /^(\d+)\s*[-–]\s*(\d+)/.exec(trimmed)
  if (match) {
    return { ageMin: match[1], ageMax: match[2] }
  }
  const single = /^(\d+)/.exec(trimmed)
  if (single) {
    return { ageMin: single[1], ageMax: single[1] }
  }
  return { ageMin: "", ageMax: "" }
}

export function formatAgeRangeFromBounds(ageMin: string | number, ageMax: string | number) {
  const min = String(ageMin).trim()
  const max = String(ageMax).trim()
  if (min && max) return `${min}-${max}`
  return min || max || ""
}

function youthGroupsFromConfig(
  config: EventServiceRequirements["childcare"]
): YouthGroupFormRow[] {
  if (config?.groups?.length) {
    return config.groups.map((group, index) => {
      const offering = normalizeYouthOffering(group.offering, group.locationMode)
      const bounds =
        group.ageMin != null && group.ageMax != null
          ? { ageMin: String(group.ageMin), ageMax: String(group.ageMax) }
          : parseAgeBounds(group.ageRange)

      return {
        id: group.id || `youth-${index}`,
        offering,
        ageMin: bounds.ageMin,
        ageMax: bounds.ageMax,
        gender: isYouthGender(group.gender) ? group.gender : "all",
        capacity: group.capacity != null ? String(group.capacity) : "",
        registrationDeadline:
          group.registrationDeadline || config.registrationDeadline || "",
        venueName: group.venueName || group.fieldTripName || "",
        venueAddress: group.venueAddress || group.fieldTripLocation || "",
        ticketTypeId: group.ticketTypeId || "",
        includeYouthQuestions: group.includeYouthQuestions !== false,
      }
    })
  }

  if (config?.ageGroups?.length) {
    return config.ageGroups.map((group, index) => {
      const bounds = parseAgeBounds(group.ageRange)
      return createEmptyYouthGroup({
        id: `youth-legacy-${index}`,
        offering: "childcare",
        ageMin: bounds.ageMin,
        ageMax: bounds.ageMax,
        capacity: String(group.capacity),
        registrationDeadline: config.registrationDeadline || "",
      })
    })
  }

  if (config?.ageRange || config?.capacity != null) {
    const bounds = parseAgeBounds(config.ageRange)
    return [
      createEmptyYouthGroup({
        id: "youth-legacy-0",
        offering: "childcare",
        ageMin: bounds.ageMin,
        ageMax: bounds.ageMax,
        capacity: config.capacity != null ? String(config.capacity) : "",
        registrationDeadline: config.registrationDeadline || "",
      }),
    ]
  }

  return []
}

function childcareAgeGroupsFromYouth(groups: YouthGroupFormRow[]): ChildcareAgeGroupFormRow[] {
  return groups.map((group) => ({
    id: group.id,
    ageRange: formatAgeRangeFromBounds(group.ageMin, group.ageMax),
    capacity: group.capacity,
  }))
}

export function formatChildcareAgeGroupLabel(ageRange: string): string {
  const trimmed = ageRange.trim()
  if (!trimmed) return ""

  const preset = CHILDCARE_AGE_RANGE_OPTIONS.find((option) => option.value === trimmed)
  if (preset) return preset.label

  if (/year/i.test(trimmed)) return trimmed

  if (/^\d+\s*[-–]\s*\d+$/.test(trimmed)) {
    return `${trimmed.replace(/\s*-\s*/, "–")} years`
  }

  return trimmed
}

export function formatYouthOfferingLabel(offering: EventYouthOffering): string {
  return (
    YOUTH_OFFERING_OPTIONS.find((option) => option.value === offering)?.label ||
    offering
  )
}

export function formatYouthGenderLabel(gender: EventYouthGender): string {
  return YOUTH_GENDER_OPTIONS.find((option) => option.value === gender)?.label || gender
}

export function formatYouthGroupSummary(group: EventYouthGroup | YouthGroupFormRow): string {
  const offering = formatYouthOfferingLabel(normalizeYouthOffering(group.offering))
  const ageRange =
    formatAgeRangeFromBounds(
      group.ageMin != null ? String(group.ageMin) : "",
      group.ageMax != null ? String(group.ageMax) : ""
    ) ||
    ("ageRange" in group ? group.ageRange : "") ||
    ""
  const ages = formatChildcareAgeGroupLabel(ageRange) || ageRange || "Ages TBD"
  const gender =
    group.gender && group.gender !== "all"
      ? ` · ${formatYouthGenderLabel(group.gender as EventYouthGender)}`
      : ""
  const capacity =
    typeof group.capacity === "number"
      ? group.capacity
      : Number.parseInt(String(group.capacity), 10) || 0
  const venueName =
    ("venueName" in group && group.venueName) ||
    ("fieldTripName" in group && group.fieldTripName) ||
    ""
  const trip =
    normalizeYouthOffering(group.offering) === "field_trip" && venueName
      ? ` · ${venueName}`
      : ""
  return `${offering}: ${ages}${gender} (cap ${capacity || "—"})${trip}`
}

function vendorSlotsFromConfig(
  config: EventServiceRequirements["vendors"]
): VendorSlotFormRow[] {
  if (config?.slots?.length) {
    return config.slots.map((slot, index) => ({
      id: `vendor-slot-${index}`,
      vendorTypeId: slot.vendorTypeId,
      vendorTypeName: slot.vendorTypeName,
      quantity: String(slot.quantity),
      fee: slot.fee != null ? String(slot.fee) : "",
    }))
  }

  if (config?.maxVendors || config?.fee != null) {
    return [
      {
        id: "vendor-slot-0",
        vendorTypeId: "",
        vendorTypeName: "",
        quantity: config.maxVendors ? String(config.maxVendors) : "1",
        fee: config.fee != null ? String(config.fee) : "",
      },
    ]
  }

  return []
}

export function formatVendorSlotLabel(slot: EventVendorSlot): string {
  const fee =
    slot.fee != null && slot.fee > 0
      ? ` — $${slot.fee.toFixed(2)} each`
      : ""
  return `${slot.quantity}× ${slot.vendorTypeName}${fee}`
}

export function summarizeVendorRequirements(
  vendors: EventServiceRequirements["vendors"]
): string[] {
  if (!vendors) return []

  if (vendors.slots?.length) {
    return vendors.slots.map(formatVendorSlotLabel)
  }

  const legacy: string[] = []
  if (vendors.maxVendors) {
    legacy.push(`Up to ${vendors.maxVendors} vendors`)
  }
  if (vendors.fee != null) {
    legacy.push(`Fee $${vendors.fee}`)
  }
  return legacy
}

export function parseServiceRequirements(value: unknown): EventServiceRequirements {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value as EventServiceRequirements
}

export function serviceRequirementsFormFromEvent(input: {
  requires_volunteers?: boolean | null
  requires_childcare?: boolean | null
  requires_vendors?: boolean | null
  service_requirements?: unknown
}): EventServiceRequirementsFormState {
  const config = parseServiceRequirements(input.service_requirements)
  const youthGroups = youthGroupsFromConfig(config.childcare)

  return {
    requiresVolunteers: input.requires_volunteers === true,
    requiresChildcare: input.requires_childcare === true,
    requiresVendors: input.requires_vendors === true,
    maxVolunteers:
      config.volunteers?.maxVolunteers != null ? String(config.volunteers.maxVolunteers) : "",
    volunteerRoles: (config.volunteers?.roles || []).map((role, index) => ({
      id: `role-${index}`,
      name: role.name,
      slots: String(role.slots),
      description: role.description || "",
      staffAllowed: role.staffAllowed !== false,
      volunteerAllowed: role.volunteerAllowed !== false,
      shifts: (role.shifts || []).map((shift, shiftIndex) => ({
        id: shift.id || `shift-${index}-${shiftIndex}`,
        start: shift.start || "",
        end: shift.end || "",
        location: shift.location || "",
      })),
    })),
    youthGroups,
    childcareAgeGroups: childcareAgeGroupsFromYouth(youthGroups),
    childcareDeadline:
      config.childcare?.registrationDeadline ||
      youthGroups.find((group) => group.registrationDeadline)?.registrationDeadline ||
      "",
    requireYouthWaiver: config.childcare?.requireWaiver === true,
    vendorSlots: vendorSlotsFromConfig(config.vendors),
    vendorDeadline: config.vendors?.applicationDeadline || "",
    vendorApprovalRequired: config.vendors?.approvalRequired !== false,
  }
}

export function buildServiceRequirementsPayload(
  form: EventServiceRequirementsFormState
): {
  requires_volunteers: boolean
  requires_childcare: boolean
  requires_vendors: boolean
  service_requirements: EventServiceRequirements
} {
  const service_requirements: EventServiceRequirements = {}

  if (form.requiresVolunteers || form.volunteerRoles.some((role) => role.name.trim())) {
    service_requirements.volunteers = {
      maxVolunteers: form.requiresVolunteers
        ? form.maxVolunteers
          ? Number.parseInt(form.maxVolunteers, 10)
          : null
        : null,
      roles: form.volunteerRoles
        .map((role) => ({
          name: role.name.trim(),
          slots: Number.parseInt(role.slots, 10) || 1,
          description: role.description.trim() || null,
          staffAllowed: role.staffAllowed !== false,
          volunteerAllowed: role.volunteerAllowed !== false,
          shifts: role.shifts
            .filter((shift) => shift.start.trim() && shift.end.trim())
            .map((shift) => ({
              id: shift.id,
              start: shift.start.trim(),
              end: shift.end.trim(),
              location: shift.location.trim() || null,
            })),
        }))
        .filter((role) => role.name.length > 0),
    }
  }

  if (form.requiresChildcare) {
    const sourceGroups =
      form.youthGroups.length > 0
        ? form.youthGroups
        : form.childcareAgeGroups.map((group) => {
            const bounds = parseAgeBounds(group.ageRange)
            return createEmptyYouthGroup({
              id: group.id,
              ageMin: bounds.ageMin,
              ageMax: bounds.ageMax,
              capacity: group.capacity,
              registrationDeadline: form.childcareDeadline,
            })
          })

    const groups: EventYouthGroup[] = sourceGroups
      .map((group) => {
        const ageMin = Number.parseInt(group.ageMin, 10)
        const ageMax = Number.parseInt(group.ageMax, 10)
        const ageRange = formatAgeRangeFromBounds(group.ageMin, group.ageMax)
        const capacity = Number.parseInt(group.capacity, 10) || 0
        const isFieldTrip = group.offering === "field_trip"
        const venueName = isFieldTrip ? group.venueName.trim() || null : null
        const venueAddress = isFieldTrip ? group.venueAddress.trim() || null : null
        return {
          id: group.id,
          offering: group.offering,
          ageMin: Number.isFinite(ageMin) ? ageMin : undefined,
          ageMax: Number.isFinite(ageMax) ? ageMax : undefined,
          ageRange,
          gender: group.gender,
          capacity,
          registrationDeadline:
            group.registrationDeadline || form.childcareDeadline || null,
          venueName,
          venueAddress,
          // Keep legacy keys in sync for older readers
          locationMode: isFieldTrip ? ("field_trip" as const) : ("same_as_event" as const),
          fieldTripName: venueName,
          fieldTripLocation: venueAddress,
          ticketTypeId: group.ticketTypeId.trim() || null,
          includeYouthQuestions: group.includeYouthQuestions !== false,
        }
      })
      .filter(
        (group) =>
          group.capacity > 0 &&
          group.ageRange.length > 0 &&
          group.ageMin != null &&
          group.ageMax != null
      )

    const ageGroups = groups.map((group) => ({
      ageRange: group.ageRange,
      capacity: group.capacity,
    }))

    const sharedDeadline =
      form.childcareDeadline ||
      groups.find((group) => group.registrationDeadline)?.registrationDeadline ||
      null

    service_requirements.childcare = {
      groups,
      ageGroups,
      registrationDeadline: sharedDeadline,
      requireWaiver: form.requireYouthWaiver === true,
    }
  }

  if (form.requiresVendors) {
    const slots = form.vendorSlots
      .filter((slot) => slot.vendorTypeId.trim().length > 0)
      .map((slot) => ({
        vendorTypeId: slot.vendorTypeId,
        vendorTypeName: slot.vendorTypeName.trim() || "Vendor",
        quantity: Number.parseInt(slot.quantity, 10) || 0,
        fee: slot.fee ? Number.parseFloat(slot.fee) : null,
      }))
      .filter((slot) => slot.quantity > 0)

    const totalQuantity = slots.reduce((sum, slot) => sum + slot.quantity, 0)

    service_requirements.vendors = {
      slots,
      maxVendors: totalQuantity > 0 ? totalQuantity : null,
      applicationDeadline: form.vendorDeadline || null,
      approvalRequired: form.vendorApprovalRequired,
    }
  }

  return {
    requires_volunteers: form.requiresVolunteers,
    requires_childcare: form.requiresChildcare,
    requires_vendors: form.requiresVendors,
    service_requirements,
  }
}
