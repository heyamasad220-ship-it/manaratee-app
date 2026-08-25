/**
 * Remove QIL 2026–2027 Approved students who are not on QIApproved.xlsx
 * and not in QIPayments.csv. Leaves enrolled registrations alone.
 *
 * Usage:
 *   node scripts/prune-qil-approved-2026-2027.mjs
 *   node scripts/prune-qil-approved-2026-2027.mjs --execute
 */
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2026_27_PRUNE_APPROVED_V1"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "78616758-d6fc-4a48-a99c-f8ea24a34646"
const DEFAULT_XLSX = "C:/Users/danan/Downloads/QIApproved.xlsx"
const DEFAULT_CSV = "C:/Users/danan/Downloads/QIPayments.csv"
const AUTO_MATCH_MIN = 82

const NAME_ALIASES = {
  "nada saleh": "Nada Hasan",
  "fatema odeh": "Fatima Odeh",
  "heba hassan": "Hebatallah Hassan",
  "malak ahmed hmimy": "Malak Hamimi",
  "wafa yerrou": "Wafaa Yarro",
  "ola alkhousi": "Viola Mohamed Alkhousi",
  "ghadeer zarkani": "Ghadeer Zakani",
  "ghadeer iphone zarkani": "Ghadeer Zakani",
  "sarfraz amin": "Amin Sarfraz",
  "iman elghandour": "IMAN IBRAHIM ELGHANDOUR",
  "asmaa ali": "Asmaa Ali Ismail Mohamed",
  "soumia b bouhlal": "Soumia Bouhlal",
  "birlanti abdalhamid alsawfta": "Birlanti Alsawfta",
  "reda hussain elkomy": "Reda Elkomy",
  "marwa taissir elgamal": "Marwa Elgamal",
  "nooreleine abushaaban": "Noor Abushaaban",
  "narmeen alfahal": "Narmeen gamal Alfahal",
  "safa s siddiqui": "Safa siddiqui",
  "imene latreche": "Imene Latrehe",
  "abeer zoubi": "ABEER ZOUBI",
  "raddwa sayed abdalla": "Raddwa Abdalla",
  "anhar ahmed": "Anhar Ahmed",
  "israa alaomairi": "Israa Alaomairi",
  "iman ettabeq": "Iman Ettabaq",
  "summayya bohlal": "Soumia Bouhlal",
  "sanaa hamdan": "Sana Hamdan",
  "fameh hamdan": "Fatima Hamdan",
  "farah dabbourah": "Farah Dabbura",
  "maryam doumah": "Meriem Douma",
  "maha aburadi": "Maha Abouradi",
  "maha fakhri": "Maha Fakhry",
  "nahed mahmoud": "Nahid Mahmoud",
  "nermeen alfahl": "Narmeen gamal Alfahal",
  "nesreen almarie": "Nisreen Mohamed Almaraghi",
  "nuha abdellatif": "Noha Abdellatif",
  "asmaa mohammad": "Asmaa Ali Ismail Mohamed",
  "rula sabri": "Rula Hashim Sabri",
  "israa alemairi": "Israa Alaomairi",
  "iman alghandour": "IMAN IBRAHIM ELGHANDOUR",
  "inas alsaiegh": "Enas Elsaegh",
  "ayah waqqad": "Ayah Wakkad",
  "balqees ali": "Belqes Ali",
  "hanan dibajah": "Hanan Dabaja",
  "rawya tawfeeq": "Rawya Tawfig",
  "rihab althamri": "Rihab Alshamari",
  "rasha alzebn": "Rasha Alzaben",
  "reda elkoumi": "Reda Elkomy",
  "ruqayyah aljanabi": "Roqaiyah Sameer Janabee",
  "zainab irshid": "Zainab Irshaid",
  "ghada abu faraj": "Ghada Abofarag",
  "lina alkhateeb": "Lena Alkhateeb",
  "marwa aljamal": "Marwa Elgamal",
  "nemat malas": "Nimat Malas",
  "nuha alduqqa": "Nuha Aldaqqa",
  "heba hourani": "Hiba Ayed Hurani",
  "heba al maenawi": "Heba El Manawy",
  "iman alarja": "Eman Alarja",
  "madihah ahmad": "Madihah Ahmed",
}

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function foldName(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function canonicalizeMemberName(value) {
  return normalizeText(value)
    .replace(/\biphone\b/gi, " ")
    .replace(/\bipad\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const rows = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i
    for (let j = 1; j <= b.length; j += 1) {
      const cur = rows[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[j] = Math.min(rows[j] + 1, prev + 1, rows[j - 1] + cost)
      prev = cur
    }
    rows[0] = i
  }
  return rows[b.length]
}

function tokenSimilar(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) {
    return 0.92
  }
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - levenshtein(a, b) / max
}

function scoreNames(leftRaw, rightRaw) {
  const left = foldName(leftRaw).replace(/\s*\([^)]*\)\s*/g, " ").trim()
  const right = foldName(rightRaw).replace(/\s*\([^)]*\)\s*/g, " ").trim()
  if (!left || !right) return 0
  if (left === right) return 100
  const leftTokens = left.split(" ").filter(Boolean)
  const rightTokens = right.split(" ").filter(Boolean)
  if (!leftTokens.length || !rightTokens.length) return 0
  const first = tokenSimilar(leftTokens[0], rightTokens[0])
  if (first < 0.7) return 0
  const lastLeft = leftTokens[leftTokens.length - 1]
  const lastRightBest = Math.max(
    ...rightTokens.map((token) => tokenSimilar(lastLeft, token))
  )
  if (lastRightBest < 0.55) return 0
  return Math.round(45 * first + 55 * lastRightBest)
}

function aliasVariants(name) {
  const folded = foldName(name)
  const out = new Set([folded])
  if (NAME_ALIASES[folded]) out.add(foldName(NAME_ALIASES[folded]))
  for (const [from, to] of Object.entries(NAME_ALIASES)) {
    if (foldName(to) === folded) out.add(from)
  }
  return [...out].filter(Boolean)
}

function extractField(text, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Subscription Fees|Subscription Discount|Add-Ons Amount|Coupon Code|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
    "i"
  )
  const match = String(text || "").match(re)
  return match ? normalizeText(match[1]) : ""
}

function loadKeepLists(xlsxPath, csvPath) {
  const names = []
  const emails = new Set()

  if (!existsSync(xlsxPath)) throw new Error(`File not found: ${xlsxPath}`)
  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const approvedRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  })
  for (const row of approvedRows) {
    const studentName = canonicalizeMemberName(
      row["Student_ Name"] || row["Student Name"]
    )
    if (studentName) names.push({ name: studentName, source: "QIApproved.xlsx" })
  }

  if (!existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`)
  const { data } = Papa.parse(readFileSync(csvPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  })
  for (const row of data) {
    const customerName = canonicalizeMemberName(row["Customer Name"])
    const email = normalizeEmail(row["Customer Email"])
    if (email) emails.add(email)
    if (customerName) names.push({ name: customerName, source: "QIPayments.csv customer" })
    const membersRaw = extractField(row["Payment Remarks"], "Registered Members")
    const members = membersRaw
      ? membersRaw
          .split(",")
          .map((part) => canonicalizeMemberName(part))
          .filter(Boolean)
      : []
    for (const member of members) {
      names.push({ name: member, source: "QIPayments.csv members" })
    }
  }

  const folded = new Set()
  for (const row of names) {
    for (const variant of aliasVariants(row.name)) folded.add(variant)
  }
  return { names, emails, folded }
}

function bestKeepHit(candidateNames, keepNames) {
  let best = { score: 0, keepName: null, source: null }
  for (const candidate of candidateNames) {
    for (const variant of aliasVariants(candidate)) {
      if (keepNames.folded.has(variant)) {
        return { score: 100, keepName: candidate, source: "exact/alias" }
      }
    }
    for (const keep of keepNames.names) {
      const score = scoreNames(candidate, keep.name)
      if (score > best.score) {
        best = { score, keepName: keep.name, source: keep.source }
      }
    }
  }
  return best
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY-RUN"}`)

  const keep = loadKeepLists(DEFAULT_XLSX, DEFAULT_CSV)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: apps, error } = await sb
    .from("program_applications")
    .select(
      "id, status, enrollment_id, participant_name, participant_contact_id, evaluation_notes, offering_id, approved_offering_id"
    )
    .eq("organization_id", ORG_ID)
    .eq("program_id", PROGRAM_ID)
    .eq("status", "approved")
    .is("enrollment_id", null)
  if (error) throw new Error(`load applications: ${error.message}`)

  const offeringIds = [
    ...new Set(
      (apps || []).flatMap((row) => [row.offering_id, row.approved_offering_id]).filter(Boolean)
    ),
  ]
  const contactIds = [
    ...new Set((apps || []).map((row) => row.participant_contact_id).filter(Boolean)),
  ]
  const offeringsById = new Map()
  const contactsById = new Map()
  if (offeringIds.length) {
    const { data, error: offeringError } = await sb
      .from("program_offerings")
      .select("id, name")
      .in("id", offeringIds)
    if (offeringError) throw new Error(offeringError.message)
    for (const row of data || []) offeringsById.set(row.id, row.name)
  }
  if (contactIds.length) {
    const { data, error: contactError } = await sb
      .from("contacts")
      .select("id, full_name, email")
      .eq("organization_id", ORG_ID)
      .in("id", contactIds)
    if (contactError) throw new Error(contactError.message)
    for (const row of data || []) contactsById.set(row.id, row)
  }

  const keepRows = []
  const removeRows = []
  for (const app of apps || []) {
    const contact = contactsById.get(app.participant_contact_id) || {}
    const offering =
      offeringsById.get(app.approved_offering_id) ||
      offeringsById.get(app.offering_id) ||
      ""
    const email = normalizeEmail(contact.email)
    const emailKeep = Boolean(email && keep.emails.has(email))
    const hit = bestKeepHit(
      [app.participant_name, contact.full_name].filter(Boolean),
      keep
    )
    const row = {
      id: app.id,
      participantName: app.participant_name,
      contactName: contact.full_name || null,
      email: contact.email || null,
      offering,
      score: hit.score,
      matchedName: hit.keepName,
      matchedSource: emailKeep ? "QIPayments.csv email" : hit.source,
    }
    if (emailKeep || hit.score >= AUTO_MATCH_MIN) keepRows.push(row)
    else removeRows.push(row)
  }

  keepRows.sort((a, b) => String(a.contactName || a.participantName).localeCompare(b.contactName || b.participantName))
  removeRows.sort((a, b) => String(a.contactName || a.participantName).localeCompare(b.contactName || b.participantName))

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const mode = execute ? "execute" : "dry-run"
  const reportPath = resolve(reportDir, `qil-2026-2027-prune-approved-${mode}.json`)
  const report = {
    importTag: IMPORT_TAG,
    mode,
    generatedAt: new Date().toISOString(),
    keepFileNames: keep.names.length,
    keepEmails: keep.emails.size,
    approvedPending: (apps || []).length,
    keepCount: keepRows.length,
    removeCount: removeRows.length,
    keep: keepRows,
    remove: removeRows,
  }

  if (execute) {
    const note = `Not on QIApproved.xlsx / QIPayments.csv (${IMPORT_TAG})`
    const now = new Date().toISOString()
    for (const row of removeRows) {
      const existing = (apps || []).find((app) => app.id === row.id)
      const previous = normalizeText(existing?.evaluation_notes)
      const { error: updateError } = await sb
        .from("program_applications")
        .update({
          status: "not_approved",
          approved_offering_id: null,
          evaluated_at: now,
          updated_at: now,
          evaluation_notes: previous ? `${previous}\n${note}` : note,
        })
        .eq("id", row.id)
        .eq("organization_id", ORG_ID)
        .eq("status", "approved")
        .is("enrollment_id", null)
      if (updateError) throw new Error(`update ${row.participantName}: ${updateError.message}`)
    }
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`Approved pending: ${(apps || []).length}`)
  console.log(`Keep (in QIApproved or QIPayments): ${keepRows.length}`)
  console.log(`Remove from Approved: ${removeRows.length}`)
  console.log("\nREMOVE:")
  for (const row of removeRows) {
    console.log(`  - ${row.contactName || row.participantName} / ${row.offering}`)
  }
  console.log(`\nReport written: ${reportPath}`)
  if (!execute) console.log("Re-run with --execute to write to Supabase.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
