import { formatPhoneDisplay } from "@/lib/ui/format-phone"
import type { EventParticipatingVendorRow } from "@/lib/vendor-hub/event-participating-vendors-queries"

export type BoothOrderColumnId =
  | "event"
  | "vendor"
  | "contact"
  | "email"
  | "phone"
  | "type"
  | "boothType"
  | "booth"
  | "status"
  | "boothFee"
  | "paid"
  | "paidDate"

export type BoothOrderColumnDefinition = {
  id: BoothOrderColumnId
  label: string
  defaultVisible: boolean
  align?: "left" | "right"
}

export type BoothOrdersColumnScope = "reports" | "event"

export type BoothOrderRow = {
  id: string
  eventId: string
  eventName: string
  eventDate: string | null
  contactId: string
  vendorName: string
  contactName: string
  email: string | null
  phone: string | null
  vendorType: string | null
  vendorTypeId: string | null
  boothType: string | null
  boothNumber: string | null
  boothId: string | null
  assignmentId: string | null
  participantId: string | null
  status: string | null
  boothFee: number
  paid: number
  paymentCount: number
  paidAt: string | null
  notes: string | null
  profileHref: string
}

export type VendorTypeCatalogEntry = {
  name: string
  slug?: string | null
}

export const BOOTH_ORDER_COLUMN_IDS: BoothOrderColumnId[] = [
  "event",
  "vendor",
  "contact",
  "email",
  "phone",
  "type",
  "boothType",
  "booth",
  "status",
  "boothFee",
  "paid",
  "paidDate",
]

export const BOOTH_ORDER_COLUMN_DEFINITIONS: BoothOrderColumnDefinition[] = [
  { id: "event", label: "Event", defaultVisible: true },
  { id: "vendor", label: "Vendor", defaultVisible: true },
  { id: "contact", label: "Contact", defaultVisible: true },
  { id: "email", label: "Email", defaultVisible: true },
  { id: "phone", label: "Phone", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "boothType", label: "Booth type", defaultVisible: true },
  { id: "booth", label: "Booth", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "boothFee", label: "Booth fee", defaultVisible: true, align: "right" },
  { id: "paid", label: "Paid", defaultVisible: true, align: "right" },
  { id: "paidDate", label: "Paid date", defaultVisible: false },
]

export const LOCKED_BOOTH_ORDER_COLUMNS: BoothOrderColumnId[] = ["vendor"]

const STORAGE_KEYS: Record<BoothOrdersColumnScope, string> = {
  reports: "manaratee:vendor-hub-booth-orders-columns:reports:v1",
  event: "manaratee:vendor-hub-booth-orders-columns:event:v1",
}

const NOTES_VENDOR_TYPE_ALIASES: Record<string, string> = {
  coffee: "Coffee",
  "food vendors between the two buildings (hot meal)": "Hot Food",
  "hot meal (between buildings)": "Hot Food",
  "hot meal (outdoor)": "Hot Food",
  "mocktail/ smoothie (outside)": "Juice / Smoothies",
  "mocktail / smoothie (truck or cart)": "Juice / Smoothies",
  "ice cream truck": "Food Truck",
}

function isColumnId(value: string): value is BoothOrderColumnId {
  return (BOOTH_ORDER_COLUMN_IDS as readonly string[]).includes(value)
}

export function defaultBoothOrderColumns(
  scope: BoothOrdersColumnScope = "reports"
): BoothOrderColumnId[] {
  return BOOTH_ORDER_COLUMN_DEFINITIONS.filter((column) => {
    if (column.id === "event" && scope === "event") return false
    return column.defaultVisible
  }).map((column) => column.id)
}

export function normalizeBoothOrderColumns(
  value: unknown,
  scope: BoothOrdersColumnScope = "reports"
): BoothOrderColumnId[] {
  const fallback = defaultBoothOrderColumns(scope)
  if (!Array.isArray(value)) return fallback

  const selected = new Set(
    value.filter(
      (item): item is BoothOrderColumnId => typeof item === "string" && isColumnId(item)
    )
  )
  if (selected.size === 0) return fallback
  for (const locked of LOCKED_BOOTH_ORDER_COLUMNS) {
    selected.add(locked)
  }
  return BOOTH_ORDER_COLUMN_IDS.filter((id) => selected.has(id))
}

export function toggleBoothOrderColumn(
  current: BoothOrderColumnId[],
  id: BoothOrderColumnId,
  visible: boolean,
  scope: BoothOrdersColumnScope = "reports"
): BoothOrderColumnId[] {
  if (!visible && LOCKED_BOOTH_ORDER_COLUMNS.includes(id)) {
    return normalizeBoothOrderColumns(current, scope)
  }
  const selected = new Set(normalizeBoothOrderColumns(current, scope))
  if (visible) selected.add(id)
  else selected.delete(id)
  return normalizeBoothOrderColumns([...selected], scope)
}

export function loadBoothOrderColumns(
  scope: BoothOrdersColumnScope = "reports"
): BoothOrderColumnId[] {
  if (typeof window === "undefined") return defaultBoothOrderColumns(scope)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[scope])
    if (!raw) return defaultBoothOrderColumns(scope)
    return normalizeBoothOrderColumns(JSON.parse(raw), scope)
  } catch {
    return defaultBoothOrderColumns(scope)
  }
}

export function saveBoothOrderColumns(
  columns: BoothOrderColumnId[],
  scope: BoothOrdersColumnScope = "reports"
) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      STORAGE_KEYS[scope],
      JSON.stringify(normalizeBoothOrderColumns(columns, scope))
    )
  } catch {
    // Ignore quota / private mode
  }
}

export function matchCatalogVendorType(
  value: string | null | undefined,
  catalog: VendorTypeCatalogEntry[]
): string | null {
  const trimmed = (value || "").trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const exact = catalog.find((entry) => entry.name.toLowerCase() === lower)
  if (exact) return exact.name
  const bySlug = catalog.find((entry) => (entry.slug || "").toLowerCase() === lower)
  if (bySlug) return bySlug.name
  return null
}

/** Selling category (coffee, clothing) — never the physical booth layout. */
export function resolveVendorTypeName(options: {
  catalogName?: string | null
  notesCategory?: string | null
  catalog: VendorTypeCatalogEntry[]
}): string | null {
  const fromCatalog = (options.catalogName || "").trim()
  if (fromCatalog) return fromCatalog

  const notes = (options.notesCategory || "").trim()
  if (!notes) return null

  const direct = matchCatalogVendorType(notes, options.catalog)
  if (direct) return direct

  const aliased = NOTES_VENDOR_TYPE_ALIASES[notes.toLowerCase()]
  if (aliased) {
    return matchCatalogVendorType(aliased, options.catalog) || aliased
  }

  const lower = notes.toLowerCase()
  if (/coffee/.test(lower)) return matchCatalogVendorType("Coffee", options.catalog)
  if (/hot meal|hot food/.test(lower)) return matchCatalogVendorType("Hot Food", options.catalog)
  if (/mocktail|smoothie|juice/.test(lower)) {
    return matchCatalogVendorType("Juice / Smoothies", options.catalog)
  }
  if (/ice cream|food truck/.test(lower)) {
    return matchCatalogVendorType("Food Truck", options.catalog)
  }
  if (/dessert|bakery/.test(lower)) {
    return matchCatalogVendorType("Bakery/Desserts", options.catalog)
  }
  if (/cloth|apparel/.test(lower)) {
    return matchCatalogVendorType("Clothin/ Apparel", options.catalog)
  }
  return null
}

export function resolveBoothOrderStatus(options: {
  paid: number
  boothFee: number
  assignmentStatus?: string | null
  lifecycleStatus?: string | null
}): string {
  const paid = Number(options.paid || 0)
  const fee = Number(options.boothFee || 0)
  if (paid > 0 && (fee <= 0 || paid + 0.009 >= fee)) return "paid"
  const assignment = (options.assignmentStatus || "").trim()
  if (assignment && assignment !== "cancelled") return assignment
  const lifecycle = (options.lifecycleStatus || "").trim()
  if (lifecycle) return lifecycle
  if (paid > 0) return "paid"
  return "reserved"
}

export function formatBoothOrderStatus(value: string | null | undefined) {
  if (!value) return "—"
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatBoothOrderMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

export function boothOrderCellValue(
  row: BoothOrderRow,
  columnId: BoothOrderColumnId
): string {
  switch (columnId) {
    case "event":
      return row.eventName
    case "vendor":
      return row.vendorName
    case "contact":
      return row.contactName
    case "email":
      return row.email || ""
    case "phone":
      return formatPhoneDisplay(row.phone)
    case "type":
      return row.vendorType || ""
    case "boothType":
      return row.boothType || ""
    case "booth":
      return row.boothNumber || ""
    case "status":
      return formatBoothOrderStatus(row.status)
    case "boothFee":
      return String(row.boothFee)
    case "paid":
      return String(row.paid)
    case "paidDate":
      return row.paidAt || ""
  }
}

export function boothOrdersToCsv(rows: BoothOrderRow[]): string {
  const header = BOOTH_ORDER_COLUMN_DEFINITIONS.map((column) => column.label)
  const body = rows.map((row) =>
    BOOTH_ORDER_COLUMN_IDS.map((id) => boothOrderCellValue(row, id))
  )
  return [header, ...body]
    .map((line) =>
      line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")
}

export function downloadBoothOrdersCsv(rows: BoothOrderRow[], filename: string) {
  if (typeof window === "undefined") return
  const csv = boothOrdersToCsv(rows)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function boothOrderMatchesQuery(row: BoothOrderRow, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return BOOTH_ORDER_COLUMN_IDS.some((id) =>
    boothOrderCellValue(row, id).toLowerCase().includes(q)
  )
}

export function boothOrderToParticipatingVendor(
  row: BoothOrderRow
): EventParticipatingVendorRow {
  return {
    contactId: row.contactId,
    businessName: row.vendorName,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    lifecycleStatus: row.status,
    boothType: row.boothType,
    boothId: row.boothId,
    boothNumber: row.boothNumber,
    assignmentId: row.assignmentId,
    participantId: row.participantId,
    vendorTypeId: row.vendorTypeId,
    amountPaid: row.paid,
    paymentCount: row.paymentCount,
    notes: row.notes,
    profileHref: row.profileHref,
  }
}
