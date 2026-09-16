/**
 * Staff-facing names for the Programs hierarchy.
 * Database/code keep `programs` (program container) and `program_offerings` (sellable class).
 *
 * Prefer `getHierarchyLabels(kind)` when the program mode is known.
 * Globals below are for mixed lists (All kinds) — intentional generic wording.
 */

import {
  getProgramKindTerminology,
  type ProgramKindTerminology,
} from "@/lib/programs/program-kind-policy"
import type { ProgramKind } from "@/lib/programs/program-kind"

export type HierarchyLabels = {
  modeLabel: string
  /** Year / Season */
  containerSingular: string
  containerPlural: string
  /** Offering (sellable unit) */
  offeringSingular: string
  offeringPlural: string
  /** Term / Session */
  sessionSingular: string
  sessionPlural: string
}

/** Mixed-context defaults (reports / org-wide lists spanning both kinds). */
export const YEAR_SEASON_LABEL = "Program"
export const YEAR_SEASON_LABEL_PLURAL = "Programs"

/** What customers register for (DB: program_offerings) — mixed-context default. */
export const PROGRAM_LABEL = "Offering"
export const PROGRAM_LABEL_PLURAL = "Offerings"

export function getHierarchyLabels(
  kind?: ProgramKind | string | null
): HierarchyLabels {
  const terminology: ProgramKindTerminology = getProgramKindTerminology(kind)
  return {
    modeLabel: terminology.modeLabel,
    containerSingular: terminology.containerSingular,
    containerPlural: terminology.containerPlural,
    offeringSingular: terminology.offeringSingular,
    offeringPlural: terminology.offeringPlural,
    sessionSingular: terminology.sessionSingular,
    sessionPlural: terminology.sessionPlural,
  }
}

/**
 * Labels for report filters when a kind preset is selected.
 * `null` / `"all"` → mixed Program / Offering wording.
 */
export function getReportHierarchyLabels(
  kindFilter: ProgramKind | "all" | null | undefined
): Pick<
  HierarchyLabels,
  "containerSingular" | "containerPlural" | "offeringSingular" | "offeringPlural"
> {
  if (kindFilter === "academic" || kindFilter === "seasonal") {
    const labels = getHierarchyLabels(kindFilter)
    return {
      containerSingular: labels.containerSingular,
      containerPlural: labels.containerPlural,
      offeringSingular: labels.offeringSingular,
      offeringPlural: labels.offeringPlural,
    }
  }
  return {
    containerSingular: YEAR_SEASON_LABEL,
    containerPlural: YEAR_SEASON_LABEL_PLURAL,
    offeringSingular: PROGRAM_LABEL,
    offeringPlural: PROGRAM_LABEL_PLURAL,
  }
}

export function yearSeasonNoun(count: number, kind?: ProgramKind | string | null) {
  if (kind != null) {
    const labels = getHierarchyLabels(kind)
    return count === 1 ? labels.containerSingular : labels.containerPlural
  }
  return count === 1 ? YEAR_SEASON_LABEL : YEAR_SEASON_LABEL_PLURAL
}

export function programNoun(count: number, kind?: ProgramKind | string | null) {
  if (kind != null) {
    const labels = getHierarchyLabels(kind)
    return count === 1 ? labels.offeringSingular : labels.offeringPlural
  }
  return count === 1 ? PROGRAM_LABEL : PROGRAM_LABEL_PLURAL
}

export function yearSeasonCountPhrase(
  count: number,
  kind?: ProgramKind | string | null
) {
  return `${count} ${yearSeasonNoun(count, kind).toLowerCase()}`
}

export function programCountPhrase(
  count: number,
  kind?: ProgramKind | string | null
) {
  return `${count} ${programNoun(count, kind).toLowerCase()}`
}
