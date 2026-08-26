export type OfferingScheduleColor = {
  key: string
  cardClassName: string
  borderClassName: string
}

/** Soft pastel accents for the weekly schedule board. Same offering ID → same color. */
export const OFFERING_SCHEDULE_PALETTE: OfferingScheduleColor[] = [
  {
    key: "amber",
    cardClassName: "bg-amber-50/80 dark:bg-amber-950/25",
    borderClassName: "border-l-amber-400 dark:border-l-amber-500",
  },
  {
    key: "blue",
    cardClassName: "bg-blue-50/80 dark:bg-blue-950/25",
    borderClassName: "border-l-blue-400 dark:border-l-blue-500",
  },
  {
    key: "violet",
    cardClassName: "bg-violet-50/80 dark:bg-violet-950/25",
    borderClassName: "border-l-violet-400 dark:border-l-violet-500",
  },
  {
    key: "emerald",
    cardClassName: "bg-emerald-50/80 dark:bg-emerald-950/25",
    borderClassName: "border-l-emerald-400 dark:border-l-emerald-500",
  },
  {
    key: "rose",
    cardClassName: "bg-rose-50/80 dark:bg-rose-950/25",
    borderClassName: "border-l-rose-400 dark:border-l-rose-500",
  },
  {
    key: "cyan",
    cardClassName: "bg-cyan-50/80 dark:bg-cyan-950/25",
    borderClassName: "border-l-cyan-400 dark:border-l-cyan-500",
  },
  {
    key: "orange",
    cardClassName: "bg-orange-50/80 dark:bg-orange-950/25",
    borderClassName: "border-l-orange-400 dark:border-l-orange-500",
  },
]

export const NEUTRAL_SCHEDULE_COLOR: OfferingScheduleColor = {
  key: "slate",
  cardClassName: "bg-slate-50/90 dark:bg-slate-900/40",
  borderClassName: "border-l-slate-400 dark:border-l-slate-500",
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getOfferingScheduleColor(
  offeringId: string | null | undefined
): OfferingScheduleColor {
  if (!offeringId) return NEUTRAL_SCHEDULE_COLOR
  const index = stableHash(offeringId) % OFFERING_SCHEDULE_PALETTE.length
  return OFFERING_SCHEDULE_PALETTE[index] || NEUTRAL_SCHEDULE_COLOR
}
