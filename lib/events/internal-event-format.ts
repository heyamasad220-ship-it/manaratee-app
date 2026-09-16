export function formatEventDate(value: string | null) {
  if (!value) {
    return "TBD"
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatEventDateTime(value: string | null) {
  if (!value) {
    return "TBD"
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatEventTimeRange(start: string | null, end: string | null) {
  if (!start) {
    return "TBD"
  }

  const startDate = new Date(start)
  const startTime = startDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  if (!end) {
    return startTime
  }

  const endTime = new Date(end).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${startTime} – ${endTime}`
}

export function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function daysUntil(date: Date, from = new Date()) {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export function eventHasEnded(
  event: { start_at: string | null; end_at: string | null },
  now = new Date()
) {
  if (event.end_at) {
    return new Date(event.end_at) < now
  }
  if (event.start_at) {
    return new Date(event.start_at) < now
  }
  return false
}
