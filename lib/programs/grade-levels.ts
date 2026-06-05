export const GRADE_LEVELS = [
  "Pre-K",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
] as const

export type GradeLevel = (typeof GRADE_LEVELS)[number]

export function sortGradeLevels(grades: string[]) {
  return [...grades].sort(
    (a, b) =>
      GRADE_LEVELS.indexOf(a as GradeLevel) -
      GRADE_LEVELS.indexOf(b as GradeLevel)
  )
}

export function getGradeRange(minGrade: string | null, maxGrade: string | null) {
  if (!minGrade || !maxGrade) return []

  const minIndex = GRADE_LEVELS.indexOf(minGrade as GradeLevel)
  const maxIndex = GRADE_LEVELS.indexOf(maxGrade as GradeLevel)

  if (minIndex === -1 || maxIndex === -1) return []
  if (minIndex > maxIndex) return []

  return GRADE_LEVELS.slice(minIndex, maxIndex + 1)
}

export function getMinMaxGradeFromLevels(gradeLevels: string[]) {
  if (gradeLevels.length === 0) {
    return { minGrade: null, maxGrade: null }
  }

  const indices = gradeLevels
    .map((grade) => GRADE_LEVELS.indexOf(grade as GradeLevel))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)

  if (indices.length === 0) {
    return { minGrade: null, maxGrade: null }
  }

  return {
    minGrade: GRADE_LEVELS[indices[0]],
    maxGrade: GRADE_LEVELS[indices[indices.length - 1]],
  }
}

const GRADE_NAME_ALIASES: Record<string, GradeLevel> = {
  pk: "Pre-K",
  "pre-k": "Pre-K",
  prek: "Pre-K",
  k: "Kindergarten",
  kg: "Kindergarten",
  kindergarten: "Kindergarten",
}

const GRADE_NAME_ABBREVIATIONS: Partial<Record<GradeLevel, string>> = {
  "Pre-K": "PK",
  Kindergarten: "KG",
}

function resolveGradeToken(token: string): GradeLevel | null {
  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }

  const alias = GRADE_NAME_ALIASES[trimmed.toLowerCase()]
  if (alias) {
    return alias
  }

  const exact = GRADE_LEVELS.find(
    (grade) => grade.toLowerCase() === trimmed.toLowerCase()
  )
  return exact ?? null
}

export function parseGradesFromGroupName(
  name: string,
  scopeGrades?: string[]
) {
  if (!name.trim()) {
    return []
  }

  const scope =
    scopeGrades && scopeGrades.length > 0
      ? new Set(scopeGrades)
      : new Set(GRADE_LEVELS)

  const resolved = name
    .split(/[/,&+]+/)
    .map((part) => resolveGradeToken(part))
    .filter((grade): grade is GradeLevel => grade !== null && scope.has(grade))

  return sortGradeLevels(Array.from(new Set(resolved)))
}

export function suggestCapacityGroupName(grades: string[]) {
  if (grades.length === 0) {
    return ""
  }

  return grades
    .map(
      (grade) =>
        GRADE_NAME_ABBREVIATIONS[grade as GradeLevel] ?? grade
    )
    .join("/")
}
