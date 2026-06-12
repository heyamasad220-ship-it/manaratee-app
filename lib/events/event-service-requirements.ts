export type EventVolunteerRole = {
  name: string
  slots: number
}

export type EventChildcareAgeGroup = {
  ageRange: string
  capacity: number
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

export type EventServiceRequirements = {
  volunteers?: {
    maxVolunteers?: number | null
    roles?: EventVolunteerRole[]
  }
  childcare?: {
    ageGroups?: EventChildcareAgeGroup[]
    /** @deprecated Use ageGroups */
    capacity?: number | null
    /** @deprecated Use ageGroups */
    ageRange?: string | null
    registrationDeadline?: string | null
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
  volunteerRoles: Array<{ id: string; name: string; slots: string }>
  childcareAgeGroups: ChildcareAgeGroupFormRow[]
  childcareDeadline: string
  vendorSlots: VendorSlotFormRow[]
  vendorDeadline: string
  vendorApprovalRequired: boolean
}

export const DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM: EventServiceRequirementsFormState = {
  requiresVolunteers: false,
  requiresChildcare: false,
  requiresVendors: false,
  maxVolunteers: "",
  volunteerRoles: [],
  childcareAgeGroups: [],
  childcareDeadline: "",
  vendorSlots: [],
  vendorDeadline: "",
  vendorApprovalRequired: true,
}

function childcareAgeGroupsFromConfig(
  config: EventServiceRequirements["childcare"]
): ChildcareAgeGroupFormRow[] {
  if (config?.ageGroups?.length) {
    return config.ageGroups.map((group, index) => ({
      id: `age-group-${index}`,
      ageRange: group.ageRange,
      capacity: String(group.capacity),
    }))
  }

  if (config?.ageRange || config?.capacity != null) {
    return [
      {
        id: "age-group-0",
        ageRange: config.ageRange || "",
        capacity: config.capacity != null ? String(config.capacity) : "",
      },
    ]
  }

  return []
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
    })),
    childcareAgeGroups: childcareAgeGroupsFromConfig(config.childcare),
    childcareDeadline: config.childcare?.registrationDeadline || "",
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

  if (form.requiresVolunteers) {
    service_requirements.volunteers = {
      maxVolunteers: form.maxVolunteers ? Number.parseInt(form.maxVolunteers, 10) : null,
      roles: form.volunteerRoles
        .map((role) => ({
          name: role.name.trim(),
          slots: Number.parseInt(role.slots, 10) || 1,
        }))
        .filter((role) => role.name.length > 0),
    }
  }

  if (form.requiresChildcare) {
    const ageGroups = form.childcareAgeGroups
      .filter((group) => group.ageRange.trim().length > 0)
      .map((group) => ({
        ageRange: group.ageRange,
        capacity: Number.parseInt(group.capacity, 10) || 0,
      }))
      .filter((group) => group.capacity > 0)

    service_requirements.childcare = {
      ageGroups,
      registrationDeadline: form.childcareDeadline || null,
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
