export const PROGRAM_STATUSES = {
  draft: "draft",
  active: "active",
  paused: "paused",
  closed: "closed",
  archived: "archived",
} as const

export type ProgramStatus =
  (typeof PROGRAM_STATUSES)[keyof typeof PROGRAM_STATUSES]

export function getProgramStatusLabel(status: ProgramStatus): string {
  switch (status) {
    case "draft":
      return "Draft"
    case "active":
      return "Active"
    case "paused":
      return "Paused"
    case "closed":
      return "Closed"
    case "archived":
      return "Archived"
    default:
      return status
  }
}