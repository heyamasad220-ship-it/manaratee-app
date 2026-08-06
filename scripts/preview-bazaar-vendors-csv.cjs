/**
 * Dry-run preview for historical BazaarVendors.csv → Vendor Hub shape.
 * Does NOT write to the database.
 *
 * Usage:
 *   node scripts/preview-bazaar-vendors-csv.mjs
 *   node scripts/preview-bazaar-vendors-csv.mjs --csv "C:/Users/danan/Downloads/BazaarVendors.csv"
 */
const fs = require("fs")
const path = require("path")

const args = process.argv.slice(2)
const csvArgIdx = args.indexOf("--csv")
const csvPath =
  (csvArgIdx >= 0 && args[csvArgIdx + 1]) ||
  "C:/Users/danan/Downloads/BazaarVendors.csv"

const BIZ_COLS = [
  "What is the name of your business?",
  "What is your business name?",
  "what is your business name?",
]
const SELLING_COLS = [
  "What Are you selling?",
  "What are you selling?",
  "What products are you selling?(details please)",
]
const SOCIAL_COLS = [
  "Do you have a website or/and social media for your business? please listed below?",
  "Do you have a website or social media for your business?",
  "Please share your social media addresses, e.g. Facebook, Instagram, etc.",
  "What is the link to your business if applicable?",
  "Do you have a website or social media account?",
]

function parseCSV(text) {
  const rows = []
  let row = []
  let cur = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const n = text[i + 1]
    if (q) {
      if (c === '"' && n === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        q = false
      } else {
        cur += c
      }
    } else if (c === '"') {
      q = true
    } else if (c === ",") {
      row.push(cur)
      cur = ""
    } else if (c === "\n" || (c === "\r" && n === "\n")) {
      if (c === "\r") i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ""
    } else if (c !== "\r") {
      cur += c
    }
  }
  if (cur.length || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

function firstNonEmpty(row, idx, names) {
  for (const name of names) {
    const v = (row[idx[name]] || "").trim()
    if (v) return v
  }
  return ""
}

function parseEventStart(label) {
  // e.g. "Sat Jun 8, 2019 3:00 PM"
  const d = new Date(label)
  if (Number.isNaN(d.getTime())) return { date: null, time: null }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}:00` }
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

const raw = fs.readFileSync(csvPath, "utf8")
const table = parseCSV(raw.replace(/^\uFEFF/, ""))
const header = table[0]
const idx = Object.fromEntries(header.map((h, i) => [h, i]))
const data = table.slice(1).filter((r) => r.some((c) => String(c).trim()))

const eventsByKey = new Map()
const contactsByEmail = new Map()
const participations = []

for (const row of data) {
  const get = (name) => (row[idx[name]] || "").trim()
  const email = normalizeEmail(get("Email"))
  const eventName = get("Event name") || "Untitled bazaar"
  const eventStartLabel = get("Event start")
  const eventEndLabel = get("Event end")
  const start = parseEventStart(eventStartLabel)
  const end = parseEventStart(eventEndLabel)
  const eventKey = `${eventName}::${start.date || eventStartLabel}`

  if (!eventsByKey.has(eventKey)) {
    eventsByKey.set(eventKey, {
      name: eventName,
      event_date: start.date,
      start_time: start.time,
      end_time: end.time,
      source_start_label: eventStartLabel,
      source_end_label: eventEndLabel,
      vendor_row_count: 0,
    })
  }
  eventsByKey.get(eventKey).vendor_row_count += 1

  const businessName = firstNonEmpty(row, idx, BIZ_COLS)
  const selling = firstNonEmpty(row, idx, SELLING_COLS)
  const social = firstNonEmpty(row, idx, SOCIAL_COLS)
  const boothCategory = get("Description") // e.g. Bazaar Vendors / Food vendors
  const amount = Number(get("Value") || 0)
  const paymentMethod = get("Payment method")
  const orderDate = get("Order date")

  if (email) {
    const existing = contactsByEmail.get(email)
    const next = {
      email,
      first_name: get("First Name") || null,
      last_name: get("Last Name") || null,
      full_name: get("Name") || null,
      phone: get("Mobile number") || null,
      company_name: businessName || existing?.company_name || null,
      address_line1: get("Address 1") || null,
      city: get("Address 2") || null,
      state: get("Address 3") || null,
      postal_code: get("Postcode / Zip") || null,
      event_count: (existing?.event_count || 0) + 1,
    }
    contactsByEmail.set(email, next)
  }

  participations.push({
    event_key: eventKey,
    event_name: eventName,
    event_date: start.date,
    contact_email: email || null,
    contact_name: get("Name") || null,
    company_name: businessName || null,
    booth_category: boothCategory || null,
    selling: selling || null,
    social: social || null,
    fee_amount: Number.isFinite(amount) ? amount : 0,
    payment_method: paymentMethod || null,
    paid_at: orderDate || null,
    proposed_lifecycle: amount > 0 ? "paid" : "assigned",
    maps_to: {
      contacts: "upsert by email",
      applications: "one approved org vendor application",
      vendor_hub_events: "upsert by name + date",
      vendor_hub_participant_status: "one row per event+contact",
      vendor_hub_payments: amount > 0 ? "payment row" : "skip",
    },
  })
}

const events = [...eventsByKey.values()].sort((a, b) =>
  String(b.event_date || "").localeCompare(String(a.event_date || ""))
)
const contacts = [...contactsByEmail.values()].sort((a, b) =>
  a.email.localeCompare(b.email)
)

const report = {
  source: csvPath,
  generated_at: new Date().toISOString(),
  dry_run: true,
  summary: {
    csv_rows: data.length,
    unique_events: events.length,
    unique_vendor_contacts: contacts.length,
    participation_rows: participations.length,
    payments_with_amount: participations.filter((p) => p.fee_amount > 0).length,
    notes: [
      "Repeated question columns are collapsed (first non-empty wins).",
      "Description column is treated as booth/ticket category (Food vendors vs Bazaar Vendors).",
      "No booth numbers in this CSV — assignments can be created later or as category-only notes.",
      "Import will NOT use legacy vendors table; CRM contacts are the identity.",
    ],
  },
  column_normalization: {
    business_name_from: BIZ_COLS,
    selling_from: SELLING_COLS,
    social_from: SOCIAL_COLS,
  },
  events_preview: events,
  contacts_preview_sample: contacts.slice(0, 15),
  participations_preview_sample: participations.slice(0, 20),
}

const outDir = path.join("scripts", "reports")
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, "bazaar-vendors-import-preview.json")
fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

console.log(`Wrote ${outPath}`)
console.log(
  JSON.stringify(
    {
      csv_rows: report.summary.csv_rows,
      unique_events: report.summary.unique_events,
      unique_vendor_contacts: report.summary.unique_vendor_contacts,
      participation_rows: report.summary.participation_rows,
      sample_events: events.slice(0, 5).map((e) => ({
        name: e.name,
        date: e.event_date,
        vendors: e.vendor_row_count,
      })),
      sample_rows: participations.slice(0, 5).map((p) => ({
        event: p.event_name,
        date: p.event_date,
        vendor: p.contact_name,
        business: p.company_name,
        fee: p.fee_amount,
        method: p.payment_method,
        lifecycle: p.proposed_lifecycle,
      })),
    },
    null,
    2
  )
)
