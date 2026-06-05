import {
  parseGradesFromGroupName,
  sortGradeLevels,
} from "@/lib/programs/grade-levels"

import type { ProgramCapacityGroupInput } from "./program-capacity-group-types"

export const ADULT_MIN_AGE = 18

export function sortGrades(grades: string[]) {
  return sortGradeLevels(grades)
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return []
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^"|"$/g, ""))
        .filter(Boolean)
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        return coerceStringArray(JSON.parse(trimmed))
      } catch {
        return []
      }
    }

    return [trimmed]
  }

  return []
}

function resolveGroupGradeLevels(
  group: Pick<ProgramCapacityGroupInput, "name" | "grade_levels">,
  eligibleGrades?: string[]
) {
  const explicit = sortGrades(coerceStringArray(group.grade_levels))
  if (explicit.length > 0) {
    return explicit
  }

  return parseGradesFromGroupName(group.name, eligibleGrades)
}

export function getEffectiveGroupGrades(
  group: Pick<ProgramCapacityGroupInput, "name" | "grade_levels">,
  eligibleGrades: string[] = []
) {
  return resolveGroupGradeLevels(group, eligibleGrades)
}

export function normalizeCapacityGroupInput(
  group: Partial<ProgramCapacityGroupInput> & {
    name?: string | null
    grade_levels?: unknown
    genders?: unknown
    capacity?: number | null
  },
  eligibleGrades?: string[]
): ProgramCapacityGroupInput {
  const name = String(group.name ?? "").trim()
  const grade_levels = resolveGroupGradeLevels(
    {
      name,
      grade_levels: coerceStringArray(group.grade_levels),
    },
    eligibleGrades
  )

  return {
    id: group.id,
    name,
    grade_levels,
    genders: coerceStringArray(group.genders),
    capacity: Number(group.capacity ?? 0),
  }
}

export function normalizeCapacityGroups(
  groups: Array<Partial<ProgramCapacityGroupInput>>,
  eligibleGrades?: string[]
) {
  return groups.map((group) =>
    normalizeCapacityGroupInput(group, eligibleGrades)
  )
}

export function getCapacityGroupGradeCatalog(
  eligibleGrades: string[],
  draftGrades: string[] = []
) {
  if (eligibleGrades.length === 0) {
    return []
  }

  return sortGrades(Array.from(new Set([...eligibleGrades, ...draftGrades])))
}

export function getGradeLevelsLabel(grades: string[], emptyLabel = "All grades") {
  if (grades.length === 0) {
    return emptyLabel
  }

  if (grades.length <= 3) {
    return grades.join(", ")
  }

  return `${grades.length} grades selected`
}

export function getUnassignedGradesWarning(
  groups: ProgramCapacityGroupInput[],
  eligibleGrades: string[]
) {
  if (eligibleGrades.length === 0 || groups.length === 0) {
    return []
  }

  const hasCatchAllGroup = groups.some((group) => {
    const effectiveGrades = getEffectiveGroupGrades(group, eligibleGrades)
    return effectiveGrades.length === 0
  })

  if (hasCatchAllGroup) {
    return []
  }

  const assignedGrades = new Set(
    groups.flatMap((group) => getEffectiveGroupGrades(group, eligibleGrades))
  )

  return sortGrades(
    eligibleGrades.filter((grade) => !assignedGrades.has(grade))
  )
}

export function isCapacityGroupPersistable(group: ProgramCapacityGroupInput) {
  return group.name.trim().length > 0 && Number(group.capacity) > 0
}

export function getPersistableCapacityGroups(
  groups: ProgramCapacityGroupInput[],
  eligibleGrades?: string[]
) {
  return normalizeCapacityGroups(groups, eligibleGrades).filter(
    isCapacityGroupPersistable
  )
}

export function buildCapacityGroupFromDraft(
  draft: Pick<
    ProgramCapacityGroupInput,
    "name" | "grade_levels" | "genders" | "capacity"
  >,
  eligibleGrades?: string[]
): ProgramCapacityGroupInput {
  return normalizeCapacityGroupInput(
    {
      name: draft.name,
      grade_levels: draft.grade_levels,
      genders: draft.genders,
      capacity: draft.capacity,
    },
    eligibleGrades
  )
}
