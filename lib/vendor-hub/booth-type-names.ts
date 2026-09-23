/** Eventbrite ticket names mapped onto org default booth types. */
export const BOOTH_TYPE_ALIASES: Record<string, string> = {
  "regular booth - main prayer hall": "Regular table",
  "booth on the stage": "Stage table",
  "corner booth - main prayer hall": "Corner table",
  "booth in the entrance (lobby)": "Lobby table",
  coffee: "Coffee (lobby or truck)",
  "food vendors between the two buildings (hot meal)": "Hot meal (Outdoor)",
  "hot meal (between buildings)": "Hot meal (Outdoor)",
  "general merchandise (between buildings)": "General merchandise (Outdoor)",
  "mocktail/ smoothie (outside)": "Mocktail / smoothie (truck or cart)",
}

export function canonicalBoothTypeName(name: string, defaultNames?: Set<string>) {
  const trimmed = name.trim() || "Booth"
  if (defaultNames?.has(trimmed)) return trimmed
  const alias = BOOTH_TYPE_ALIASES[trimmed.toLowerCase()]
  if (alias) return alias
  return trimmed
}
