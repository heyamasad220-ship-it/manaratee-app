export type EventVolunteerRole = {
  name: string
  slots: number
}

export type EventChildcareAgeGroup = {
  ageRange: string
  capacity: number
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
    maxVendors?: number | null
    applicationDeadline?: string | null
    fee?: number | null
    approvalRequired?: boolean
  }
}

export type ChildcareAgeGroupFormRow = {
  id: string
  ageRange: string
  capacity: string
}

export type EventServiceRequirementsFormState = {
  requiresVolunteers: boolean
  requiresChildcare: boolean
  requiresVendors: boolean
  maxVolunteers: string
  volunteerRoles: Array<{ id: string; name: string; slots: string }>
  childcareAgeGroups: ChildcareAgeGroupFormRow[]
  childcareDeadline: string
  maxVendors: string
  vendorDeadline: string
  vendorFee: string
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
  maxVendors: "",
  vendorDeadline: "",
  vendorFee: "",
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
  return CHILDCARE_AGE_RANGE_OPTIONS.find((option) => option.value === ageRange)?.label ?? ageRange
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
    maxVendors: config.vendors?.maxVendors != null ? String(config.vendors.maxVendors) : "",
    vendorDeadline: config.vendors?.applicationDeadline || "",
    vendorFee: config.vendors?.fee != null ? String(config.vendors.fee) : "",
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
    service_requirements.vendors = {
      maxVendors: form.maxVendors ? Number.parseInt(form.maxVendors, 10) : null,
      applicationDeadline: form.vendorDeadline || null,
      fee: form.vendorFee ? Number.parseFloat(form.vendorFee) : null,
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
