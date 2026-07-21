export type GivingGroupKind = "membership_group" | "department" | "group_donation"

export const GIVING_GROUP_KIND_OPTIONS: Array<{
  value: GivingGroupKind
  label: string
  description: string
}> = [
  {
    value: "membership_group",
    label: "Membership Group",
    description: "Linked to a group under Membership → Groups",
  },
  {
    value: "department",
    label: "Department",
    description: "Linked to a department under HR → Departments",
  },
  {
    value: "group_donation",
    label: "Group Donation",
    description: "Giving collective only — not listed under Membership or Departments",
  },
]

export function normalizeGivingGroupKind(
  value: string | null | undefined
): GivingGroupKind {
  if (value === "membership_group" || value === "department") return value
  return "group_donation"
}

export function getGivingGroupKindLabel(
  value: string | null | undefined
): string {
  const kind = normalizeGivingGroupKind(value)
  return (
    GIVING_GROUP_KIND_OPTIONS.find((option) => option.value === kind)?.label ||
    "Group Donation"
  )
}
