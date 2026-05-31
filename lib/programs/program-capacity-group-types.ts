export const GENDER_CAPACITY_VALUES = ["Male", "Female"] as const

export type GenderCapacityValue = (typeof GENDER_CAPACITY_VALUES)[number]

export type ProgramCapacityGroup = {
  id: string
  organization_id: string
  program_id: string
  name: string
  grade_levels: string[]
  genders: string[]
  capacity: number
  enrolled: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type ProgramCapacityGroupInput = {
  id?: string
  name: string
  grade_levels: string[]
  genders: string[]
  capacity: number
}

export function getTotalCapacityFromGroups(
  groups: Pick<ProgramCapacityGroupInput, "capacity">[]
) {
  return groups.reduce((sum, group) => sum + Number(group.capacity || 0), 0)
}

export function getGroupGenderLabel(genders: string[]) {
  if (genders.length === 0) {
    return "Any gender"
  }

  if (genders.length === 1) {
    return genders[0]
  }

  return genders.join(", ")
}
