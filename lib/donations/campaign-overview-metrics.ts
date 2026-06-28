import type { CampaignSourceBreakdown } from "@/lib/donations/campaign-analytics"

/** Keys for rows on the campaign detail overview metrics table. */
export type CampaignOverviewMetricKey =
  | "cash"
  | "checks"
  | "square"
  | "one-time"
  | "recurring"
  | "ticket-sales"
  | "other"
  | "donors"
  | "largest-gift"
  | "pledges"

export type CampaignOverviewMetricDefinition = {
  key: CampaignOverviewMetricKey
  title: string
  description?: string
  group: "sources" | "insights"
}

export const CAMPAIGN_OVERVIEW_METRIC_CATALOG: CampaignOverviewMetricDefinition[] = [
  { key: "cash", title: "Cash", group: "sources" },
  { key: "checks", title: "Checks", group: "sources" },
  { key: "square", title: "Square", group: "sources" },
  { key: "one-time", title: "One-Time Donations", group: "sources" },
  { key: "recurring", title: "Recurring Donations", group: "sources" },
  { key: "ticket-sales", title: "Ticket Sales", group: "sources" },
  { key: "other", title: "Other", group: "sources", description: "Unclassified payment sources" },
  { key: "donors", title: "Donors", group: "insights" },
  { key: "largest-gift", title: "Largest Gift", group: "insights" },
  { key: "pledges", title: "Pledges", group: "insights" },
]

export const DEFAULT_CAMPAIGN_OVERVIEW_METRIC_KEYS: CampaignOverviewMetricKey[] =
  CAMPAIGN_OVERVIEW_METRIC_CATALOG.map((metric) => metric.key)

const VALID_KEYS = new Set<CampaignOverviewMetricKey>(
  CAMPAIGN_OVERVIEW_METRIC_CATALOG.map((metric) => metric.key)
)

const SOURCE_METRIC_KEYS = new Set<CampaignOverviewMetricKey>([
  "cash",
  "checks",
  "square",
  "one-time",
  "recurring",
  "ticket-sales",
  "other",
])

function sourceMetricAmount(
  key: CampaignOverviewMetricKey,
  breakdown: CampaignSourceBreakdown
): number {
  switch (key) {
    case "cash":
      return breakdown.cash
    case "checks":
      return breakdown.checks
    case "square":
      return breakdown.square
    case "one-time":
      return breakdown.ccOneTime
    case "recurring":
      return breakdown.ccRecurring
    case "ticket-sales":
      return breakdown.ticketSales
    case "other":
      return breakdown.other
    default:
      return 0
  }
}

export function isCampaignOverviewMetricKey(value: string): value is CampaignOverviewMetricKey {
  return VALID_KEYS.has(value as CampaignOverviewMetricKey)
}

export function parseCampaignOverviewMetricKeys(
  value: unknown
): CampaignOverviewMetricKey[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return null

  const parsed: CampaignOverviewMetricKey[] = []
  for (const entry of value) {
    if (typeof entry !== "string" || !isCampaignOverviewMetricKey(entry)) continue
    if (!parsed.includes(entry)) parsed.push(entry)
  }

  return parsed.length > 0 ? parsed : null
}

/** When no saved config exists, hide zero-value source rows but keep insight rows. */
export function resolveAutoCampaignOverviewMetricKeys(
  breakdown: CampaignSourceBreakdown
): CampaignOverviewMetricKey[] {
  const keys: CampaignOverviewMetricKey[] = []

  for (const metric of CAMPAIGN_OVERVIEW_METRIC_CATALOG) {
    if (metric.group === "insights") {
      keys.push(metric.key)
      continue
    }

    if (sourceMetricAmount(metric.key, breakdown) > 0) {
      keys.push(metric.key)
    }
  }

  return keys
}

export function resolveCampaignOverviewMetricKeys(input: {
  savedKeys: CampaignOverviewMetricKey[] | null | undefined
  breakdown: CampaignSourceBreakdown
}): CampaignOverviewMetricKey[] {
  if (input.savedKeys && input.savedKeys.length > 0) {
    return input.savedKeys.filter((key) => VALID_KEYS.has(key))
  }

  return resolveAutoCampaignOverviewMetricKeys(input.breakdown)
}

export function normalizeCampaignOverviewMetricKeys(
  keys: CampaignOverviewMetricKey[]
): CampaignOverviewMetricKey[] {
  const normalized: CampaignOverviewMetricKey[] = []

  for (const key of keys) {
    if (!VALID_KEYS.has(key) || normalized.includes(key)) continue
    normalized.push(key)
  }

  return normalized
}

export function isSourceOverviewMetricKey(key: CampaignOverviewMetricKey): boolean {
  return SOURCE_METRIC_KEYS.has(key)
}
