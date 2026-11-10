export const PLEDGE_LEDGER_COLUMNS = [
  { id: "donor", label: "Donor Name", locked: true },
  { id: "pledged", label: "Amount Pledged", locked: false },
  { id: "paid", label: "Amount Paid", locked: false },
  { id: "balance", label: "Balance", locked: false },
  { id: "status", label: "Status", locked: false },
  { id: "campaign", label: "Campaign", locked: false },
  { id: "lastContact", label: "Last contact", locked: false },
  { id: "email", label: "Email", locked: false },
  { id: "phone", label: "Phone", locked: false },
  { id: "emailReminder", label: "Email reminder", locked: false },
  { id: "callText", label: "Call / text", locked: false },
  { id: "notes", label: "Notes", locked: false },
] as const

export type PledgeLedgerColumnId = (typeof PLEDGE_LEDGER_COLUMNS)[number]["id"]

const STORAGE_KEY = "manaratee.pledges.visibleColumns.v2"

export function pledgeLedgerColumnOptions(includeCampaign: boolean) {
  return PLEDGE_LEDGER_COLUMNS.filter((column) => includeCampaign || column.id !== "campaign")
}

const DEFAULT_PLEDGE_LEDGER_COLUMN_IDS: PledgeLedgerColumnId[] = [
  "donor",
  "pledged",
  "paid",
  "balance",
  "status",
  "campaign",
  "lastContact",
]

export function defaultPledgeLedgerColumns(includeCampaign: boolean): PledgeLedgerColumnId[] {
  return DEFAULT_PLEDGE_LEDGER_COLUMN_IDS.filter(
    (column) => includeCampaign || column !== "campaign"
  )
}

export function loadPledgeLedgerColumns(includeCampaign: boolean): PledgeLedgerColumnId[] {
  const defaults = defaultPledgeLedgerColumns(includeCampaign)
  const allowed = pledgeLedgerColumnOptions(includeCampaign).map((column) => column.id)
  if (typeof window === "undefined") return defaults
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaults
    const selected = new Set(parsed.filter((id) => allowed.includes(id as PledgeLedgerColumnId)))
    selected.add("donor")
    return allowed.filter((id) => selected.has(id))
  } catch {
    return defaults
  }
}

export function savePledgeLedgerColumns(columns: PledgeLedgerColumnId[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
}
