type SortableSession = {
  start_date: string | null
  end_date: string | null
  name: string
  sort_order?: number
  created_at?: string
}

function compareNullableDates(
  left: string | null,
  right: string | null
): number {
  if (!left && !right) {
    return 0
  }

  if (!left) {
    return 1
  }

  if (!right) {
    return -1
  }

  return left.localeCompare(right)
}

export function sortProgramSessions<T extends SortableSession>(
  sessions: T[]
): T[] {
  return [...sessions].sort((left, right) => {
    const startCompare = compareNullableDates(left.start_date, right.start_date)
    if (startCompare !== 0) {
      return startCompare
    }

    const endCompare = compareNullableDates(left.end_date, right.end_date)
    if (endCompare !== 0) {
      return endCompare
    }

    const nameCompare = left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
    if (nameCompare !== 0) {
      return nameCompare
    }

    if ((left.sort_order ?? 0) !== (right.sort_order ?? 0)) {
      return (left.sort_order ?? 0) - (right.sort_order ?? 0)
    }

    return (left.created_at ?? "").localeCompare(right.created_at ?? "")
  })
}
