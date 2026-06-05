export function getAgeGroupLabelsFromMinMax(
  minAge: number | null | undefined,
  maxAge: number | null | undefined
): string[] {
  const min = minAge ?? null
  const max = maxAge ?? null

  if (min === null && max === null) return []
  if (min !== null && max !== null) return [`Ages ${min}-${max}`]
  if (min !== null) return [`Ages ${min}+`]
  if (max !== null) return [`Ages up to ${max}`]

  return []
}

/** Read min/max age from columns or legacy age_groups labels for edit forms. */
export function parseProgramAgeBounds(input: {
  age_groups?: string[] | null
  min_age?: number | null
  max_age?: number | null
}): { minAge: number | null; maxAge: number | null } {
  const minFromColumn = input.min_age ?? null
  const maxFromColumn = input.max_age ?? null

  if (minFromColumn !== null || maxFromColumn !== null) {
    return { minAge: minFromColumn, maxAge: maxFromColumn }
  }

  const label =
    (input.age_groups || []).find((group) => /^Ages\s+/i.test(group)) || null

  if (!label) {
    return { minAge: null, maxAge: null }
  }

  const rangeMatch = label.match(/^Ages\s+(\d+)\s*-\s*(\d+)$/i)
  if (rangeMatch) {
    return {
      minAge: Number(rangeMatch[1]),
      maxAge: Number(rangeMatch[2]),
    }
  }

  const minOnlyMatch = label.match(/^Ages\s+(\d+)\+$/i)
  if (minOnlyMatch) {
    return { minAge: Number(minOnlyMatch[1]), maxAge: null }
  }

  const maxOnlyMatch = label.match(/^Ages up to\s+(\d+)$/i)
  if (maxOnlyMatch) {
    return { minAge: null, maxAge: Number(maxOnlyMatch[1]) }
  }

  return { minAge: null, maxAge: null }
}

const GRADE_ORDER = [
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

const GRADE_SHORT_LABELS: Record<string, string> = {
  "Pre-K": "PK",
  Kindergarten: "K",
  "1st Grade": "1ST",
  "2nd Grade": "2ND",
  "3rd Grade": "3RD",
  "4th Grade": "4TH",
  "5th Grade": "5TH",
  "6th Grade": "6TH",
  "7th Grade": "7TH",
  "8th Grade": "8TH",
  "9th Grade": "9TH",
  "10th Grade": "10TH",
  "11th Grade": "11TH",
  "12th Grade": "12TH",
}

function sortGradeLevels(gradeLevels: string[]) {
  return [...gradeLevels].sort(
    (a, b) =>
      GRADE_ORDER.indexOf(a as (typeof GRADE_ORDER)[number]) -
      GRADE_ORDER.indexOf(b as (typeof GRADE_ORDER)[number])
  )
}

function shortGradeLabel(grade: string) {
  return GRADE_SHORT_LABELS[grade] || grade
}

/** Compact age range for summary cards, e.g. "4-14". */
export function formatProgramAgeRangeShort(input: {
  age_groups?: string[] | null
  min_age?: number | null
  max_age?: number | null
}): string {
  const min = input.min_age ?? null
  const max = input.max_age ?? null

  if (min !== null && max !== null) return `${min}-${max}`
  if (min !== null) return `${min}+`
  if (max !== null) return `Up to ${max}`

  const labels = getProgramAgeGroupLabels(input)
  if (labels.length === 0) return "All ages"

  const match = labels[0]?.match(/^Ages\s+(.+)$/i)
  return match?.[1] || labels[0]
}

/** Compact grade range for summary cards, e.g. "PK-8TH". */
export function formatProgramGradeRangeShort(
  gradeLevels: string[] | null | undefined
): string {
  const levels = (gradeLevels || []).filter(Boolean)
  if (levels.length === 0) return "All grades"

  const sorted = sortGradeLevels(levels)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  if (!min) return "All grades"
  if (min === max) return shortGradeLabel(min)

  return `${shortGradeLabel(min)}-${shortGradeLabel(max)}`
}

/** Prefer min_age/max_age (source of truth from admin), then stored age_groups. */
export function getProgramAgeGroupLabels(input: {
  age_groups?: string[] | null
  min_age?: number | null
  max_age?: number | null
}): string[] {
  const fromMinMax = getAgeGroupLabelsFromMinMax(input.min_age, input.max_age)
  if (fromMinMax.length > 0) {
    return fromMinMax
  }

  const storedGroups = (input.age_groups || []).filter(Boolean)
  if (storedGroups.length > 0) {
    return storedGroups
  }

  return []
}

export function formatProgramAgeEligibility(input: {
  age_groups?: string[] | null
  min_age?: number | null
  max_age?: number | null
}): string {
  const labels = getProgramAgeGroupLabels(input)
  return labels.length > 0 ? labels.join(", ") : "All ages"
}
