export type DepartmentDeleteUsage = {
  programs: number
  offerings: number
  employees: number
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function joinEnglish(parts: string[]) {
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
}

/** Null when the department has no programs, offerings, or employees. */
export function departmentDeleteBlockedReason(
  usage: DepartmentDeleteUsage
): string | null {
  const parts: string[] = []
  if (usage.programs > 0) {
    parts.push(countLabel(usage.programs, "program", "programs"))
  }
  if (usage.offerings > 0) {
    parts.push(countLabel(usage.offerings, "offering", "offerings"))
  }
  if (usage.employees > 0) {
    parts.push(countLabel(usage.employees, "employee", "employees"))
  }
  if (parts.length === 0) return null
  return `This department still has ${joinEnglish(parts)}. Move or remove them first.`
}
