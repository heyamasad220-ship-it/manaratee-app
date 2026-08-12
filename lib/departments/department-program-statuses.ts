/** Years visible in the department workspace (includes finished/closed years). */
export const DEPARTMENT_WORKSPACE_PROGRAM_STATUSES = [
  "draft",
  "active",
  "paused",
  "closed",
] as const

/**
 * Years still operating for catalog / new-enrollment surfaces.
 * Closed years stay in the department workspace but are not sold as open.
 */
export const DEPARTMENT_OPEN_PROGRAM_STATUSES = [
  "draft",
  "active",
  "paused",
] as const

export type DepartmentOpenProgramStatus =
  (typeof DEPARTMENT_OPEN_PROGRAM_STATUSES)[number]

export type DepartmentWorkspaceProgramStatus =
  (typeof DEPARTMENT_WORKSPACE_PROGRAM_STATUSES)[number]
