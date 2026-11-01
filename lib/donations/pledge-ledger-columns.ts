export const PLEDGE_LEDGER_COLUMNS = [
  { id: "donor", label: "Donor Name", locked: true },
  { id: "email", label: "Email", locked: false },
  { id: "phone", label: "Phone", locked: false },
  { id: "pledged", label: "Amount Pledged", locked: false },
  { id: "paid", label: "Amount Paid", locked: false },
  { id: "balance", label: "Balance", locked: false },
  { id: "status", label: "Status", locked: false },
  { id: "campaign", label: "Campaign", locked: false },
  { id: "emailReminder", label: "Email reminder", locked: false },
  { id: "callText", label: "Call / text", locked: false },
  { id: "notes", label: "Notes", locked: false },
] as const

export type PledgeLedgerColumnId = (typeof PLEDGE_LEDGER_COLUMNS)[number]["id"]

const STORAGE_KEY = "manaratee.pledges.visibleColumns"

export function pledgeLedgerColumnOptions(includeCampaign: boolean) {
  return PLEDGE_LEDGER_COLUMNS.filter((column) => includeCampaign || column.id !== "campaign")
}

export function defaultPledgeLedgerColumns(includeCampaign: boolean): PledgeLedgerColumnId[] {
  return pledgeLedgerColumnOptions(includeCampaign).map((column) => column.id)
}

export function loadPledgeLedgerColumns(includeCampaign: boolean): PledgeLedgerColumnId[] {
  const allowed = defaultPledgeLedgerColumns(includeCampaign)
  if (typeof window === "undefined") return allowed
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return allowed
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return allowed
    const selected = new Set(parsed.filter((id) => allowed.includes(id as PledgeLedgerColumnId)))
    selected.add("donor")
    return allowed.filter((id) => selected.has(id))
  } catch {
    return allowed
  }
}

export function savePledgeLedgerColumns(columns: PledgeLedgerColumnId[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
}
