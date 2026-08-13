import { campLabelForSession } from "@/lib/programs/offering-session-enrollment-types"

export type SessionPackageRow = {
  id: string
  start_date?: string | null
  end_date?: string | null
  startDate?: string | null
  endDate?: string | null
}

function sessionStart(session: SessionPackageRow) {
  return session.start_date ?? session.startDate ?? null
}

function sessionEnd(session: SessionPackageRow) {
  return session.end_date ?? session.endDate ?? null
}

/** Group sessions into Camp 1 / Camp 2 / offering (unlabeled). */
export function groupSessionsByPackage(
  sessions: SessionPackageRow[]
): Map<string, string[]> {
  const byPackage = new Map<string, string[]>()
  for (const session of sessions) {
    const key =
      campLabelForSession(sessionStart(session), sessionEnd(session)) ??
      "offering"
    const ids = byPackage.get(key) ?? []
    ids.push(session.id)
    byPackage.set(key, ids)
  }
  return byPackage
}

/**
 * True when the selection is exactly one or more complete packages
 * (e.g. all Camp 1 weeks, all Camp 2 weeks, both camps, or all unlabeled weeks).
 */
export function isFullCampPackageSelection(
  selectedSessionIds: string[],
  sessions: SessionPackageRow[]
): boolean {
  if (selectedSessionIds.length === 0 || sessions.length === 0) return false

  const selected = new Set(selectedSessionIds)
  const byPackage = groupSessionsByPackage(sessions)

  const coveredKeys: string[] = []
  for (const [key, ids] of byPackage) {
    if (ids.length === 0) continue
    if (ids.every((id) => selected.has(id))) coveredKeys.push(key)
  }
  if (coveredKeys.length === 0) return false

  const allowed = new Set(
    coveredKeys.flatMap((key) => byPackage.get(key) || [])
  )
  return [...selected].every((id) => allowed.has(id))
}

/**
 * During priority phase (selected_sessions_open = false), partial week
 * selections and day passes go to waitlist; full camp packages enroll.
 */
export function shouldWaitlistForFullCampPriority(input: {
  selectedSessionsOpen: boolean
  optionType: string
  selectedSessionIds: string[]
  sessions: SessionPackageRow[]
}): boolean {
  if (input.selectedSessionsOpen) return false
  if (input.optionType === "full_program") return false
  if (
    input.optionType !== "selected_sessions" &&
    input.optionType !== "single_session" &&
    input.optionType !== "drop_in"
  ) {
    return false
  }
  return !isFullCampPackageSelection(
    input.selectedSessionIds,
    input.sessions
  )
}
