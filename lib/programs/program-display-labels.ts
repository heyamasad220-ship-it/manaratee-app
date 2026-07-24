/**
 * Staff-facing names for the Programs hierarchy.
 * Database/code keep `programs` (year container) and `program_offerings` (sellable class).
 *
 * Department → Year/Season (programs row) → Program (offering row)
 */

export const YEAR_SEASON_LABEL = "Year/Season"
export const YEAR_SEASON_LABEL_PLURAL = "Years/Seasons"

/** What customers register for (DB: program_offerings). */
export const PROGRAM_LABEL = "Program"
export const PROGRAM_LABEL_PLURAL = "Programs"

export function yearSeasonNoun(count: number) {
  return count === 1 ? YEAR_SEASON_LABEL : YEAR_SEASON_LABEL_PLURAL
}

export function programNoun(count: number) {
  return count === 1 ? PROGRAM_LABEL : PROGRAM_LABEL_PLURAL
}

export function yearSeasonCountPhrase(count: number) {
  return `${count} ${yearSeasonNoun(count).toLowerCase()}`
}

export function programCountPhrase(count: number) {
  return `${count} ${programNoun(count).toLowerCase()}`
}
