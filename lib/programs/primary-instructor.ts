export type PrimaryInstructorAssignmentLike = {
  assignment_role?: string | null
  session_id?: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

function assignmentSortTime(row: PrimaryInstructorAssignmentLike) {
  return (
    Date.parse(row.updated_at || "") ||
    Date.parse(row.created_at || "") ||
    0
  )
}

function isOfferingLevel(row: PrimaryInstructorAssignmentLike) {
  return row.session_id == null
}

function isPrimaryRole(row: PrimaryInstructorAssignmentLike) {
  return String(row.assignment_role || "") === "primary_instructor"
}

function isInstructorRole(row: PrimaryInstructorAssignmentLike) {
  const role = String(row.assignment_role || "")
  return role === "assistant_instructor" || role === "instructor"
}

/** Latest offering-level primary instructor, then any instructor. */
export function pickPrimaryInstructorAssignment<
  T extends PrimaryInstructorAssignmentLike,
>(assignments: T[]): T | null {
  const active = assignments.filter((row) => row.is_active !== false)
  const offeringLevel = active.filter(isOfferingLevel)
  const pool = offeringLevel.length > 0 ? offeringLevel : active
  const primaries = pool.filter(isPrimaryRole)
  const candidates =
    primaries.length > 0 ? primaries : pool.filter(isInstructorRole)
  if (candidates.length === 0) return null
  return candidates.slice().sort((a, b) => {
    const byTime = assignmentSortTime(b) - assignmentSortTime(a)
    if (byTime !== 0) return byTime
    return 0
  })[0]
}

export function primaryInstructorNameByOffering<
  T extends PrimaryInstructorAssignmentLike & {
    offering_id?: string | null
    contact_name?: string | null
    contact?: { full_name?: string | null } | null
  },
>(rows: T[]): Map<string, string> {
  const byOffering = new Map<string, T[]>()
  for (const row of rows) {
    const offeringId = row.offering_id
    if (!offeringId) continue
    const list = byOffering.get(offeringId) || []
    list.push(row)
    byOffering.set(offeringId, list)
  }

  const names = new Map<string, string>()
  for (const [offeringId, list] of byOffering) {
    const chosen = pickPrimaryInstructorAssignment(list)
    const name = (
      chosen?.contact_name ||
      chosen?.contact?.full_name ||
      ""
    ).trim()
    if (name) names.set(offeringId, name)
  }
  return names
}
