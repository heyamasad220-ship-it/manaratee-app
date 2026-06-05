import {
  getGradeRange,
  getMinMaxGradeFromLevels,
} from "@/lib/programs/grade-levels"
import type { Program } from "@/lib/programs/program-types"

export { getMinMaxGradeFromLevels }

export function getInitialGradeLevels(program: Program) {
  if (program.grade_levels?.length) {
    return program.grade_levels
  }

  return getGradeRange(program.min_grade || null, program.max_grade || null)
}

export function getNumberOrNull(value: FormDataEntryValue | null) {
  const stringValue = String(value || "")
  if (!stringValue) return null
  return Number(stringValue)
}

export function ageSelectValue(age: number | null) {
  return age === null ? "" : String(age)
}

export const AGE_OPTIONS = Array.from({ length: 100 }, (_, index) => index)

export const ADULT_MIN_AGE = 18

export function gradesApplyForMinAge(minAge: number | null) {
  return minAge === null || minAge < ADULT_MIN_AGE
}

export function getGradeLevelsDisplayLabel(minAge: number | null) {
  if (minAge !== null && minAge >= ADULT_MIN_AGE) {
    return "Adult"
  }

  return "N/A"
}

export function inferProgramTypeFromMinAge(
  minAge: number | null
): "adult" | "youth" {
  return minAge !== null && minAge >= ADULT_MIN_AGE ? "adult" : "youth"
}
