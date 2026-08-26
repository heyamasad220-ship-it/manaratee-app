export const REGISTRATION_COLUMN_IDS = [
  "participant",
  "email",
  "phone",
  "guardian",
  "dob",
  "age",
  "gender",
  "allergies",
  "photoConsent",
  "program",
  "offering",
  "teacher",
  "status",
  "registered",
  "actions",
] as const

export type RegistrationColumnId = (typeof REGISTRATION_COLUMN_IDS)[number]

export type RegistrationColumnGroup = "participant" | "registration"

export type RegistrationColumnDefinition = {
  id: RegistrationColumnId
  label: string
  group: RegistrationColumnGroup
  defaultVisible: boolean
}

export const REGISTRATION_COLUMN_DEFINITIONS: RegistrationColumnDefinition[] = [
  { id: "participant", label: "Participant name", group: "participant", defaultVisible: true },
  { id: "email", label: "Email", group: "participant", defaultVisible: false },
  { id: "phone", label: "Phone", group: "participant", defaultVisible: false },
  { id: "guardian", label: "Parent / Guardian", group: "participant", defaultVisible: true },
  { id: "dob", label: "Date of Birth", group: "participant", defaultVisible: false },
  { id: "age", label: "Age", group: "participant", defaultVisible: false },
  { id: "gender", label: "Gender", group: "participant", defaultVisible: false },
  { id: "allergies", label: "Allergies", group: "participant", defaultVisible: false },
  { id: "photoConsent", label: "Photo Consent", group: "participant", defaultVisible: false },
  { id: "program", label: "Program", group: "registration", defaultVisible: false },
  { id: "offering", label: "Offering", group: "registration", defaultVisible: true },
  { id: "teacher", label: "Teacher", group: "registration", defaultVisible: true },
  { id: "status", label: "Enrollment / Registration Status", group: "registration", defaultVisible: true },
  { id: "registered", label: "Registration Date", group: "registration", defaultVisible: true },
  { id: "actions", label: "Actions", group: "registration", defaultVisible: true },
]

export const DEFAULT_REGISTRATION_COLUMNS: RegistrationColumnId[] =
  REGISTRATION_COLUMN_DEFINITIONS.filter((column) => column.defaultVisible).map(
    (column) => column.id
  )

export const LOCKED_REGISTRATION_COLUMNS: RegistrationColumnId[] = [
  "participant",
  "actions",
]

export function toggleRegistrationColumn(
  current: RegistrationColumnId[],
  id: RegistrationColumnId,
  visible: boolean
): RegistrationColumnId[] {
  if (!visible && LOCKED_REGISTRATION_COLUMNS.includes(id)) {
    return normalizeRegistrationColumns(current)
  }
  const selected = new Set(normalizeRegistrationColumns(current))
  if (visible) selected.add(id)
  else selected.delete(id)
  const next = REGISTRATION_COLUMN_IDS.filter((column) => selected.has(column))
  return next.length > 0 ? next : [...DEFAULT_REGISTRATION_COLUMNS]
}

export const REGISTRATION_COLUMNS_STORAGE_KEY =
  "manaratee:program-registrations-columns:v1"

export function isRegistrationColumnId(
  value: string
): value is RegistrationColumnId {
  return (REGISTRATION_COLUMN_IDS as readonly string[]).includes(value)
}

export function normalizeRegistrationColumns(
  value: unknown
): RegistrationColumnId[] {
  if (!Array.isArray(value)) return [...DEFAULT_REGISTRATION_COLUMNS]
  const selected = new Set(
    value.filter(
      (item): item is RegistrationColumnId =>
        typeof item === "string" && isRegistrationColumnId(item)
    )
  )
  if (selected.size === 0) return [...DEFAULT_REGISTRATION_COLUMNS]
  for (const locked of LOCKED_REGISTRATION_COLUMNS) selected.add(locked)
  return REGISTRATION_COLUMN_IDS.filter((column) => selected.has(column))
}

export function loadRegistrationColumns(): RegistrationColumnId[] {
  if (typeof window === "undefined") return [...DEFAULT_REGISTRATION_COLUMNS]
  try {
    const raw = window.localStorage.getItem(REGISTRATION_COLUMNS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_REGISTRATION_COLUMNS]
    return normalizeRegistrationColumns(JSON.parse(raw))
  } catch {
    return [...DEFAULT_REGISTRATION_COLUMNS]
  }
}

export function saveRegistrationColumns(columns: RegistrationColumnId[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      REGISTRATION_COLUMNS_STORAGE_KEY,
      JSON.stringify(normalizeRegistrationColumns(columns))
    )
  } catch {
    // Ignore quota / private mode
  }
}

export const FULL_REGISTRATION_EXPORT_COLUMNS: RegistrationColumnId[] = [
  "participant",
  "guardian",
  "email",
  "phone",
  "dob",
  "age",
  "gender",
  "allergies",
  "photoConsent",
  "program",
  "offering",
  "teacher",
  "status",
  "registered",
]
