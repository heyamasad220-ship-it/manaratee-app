/**
 * Import the QIL 2026–2027 final roster + payments.
 *
 * - QI-FinalList.xlsx is the canonical enrolled roster (student + course + teacher)
 * - QI-Payments0915.csv overlays tuition / refunds on those seats
 * - Active enrollments whose student is not on the list are cancelled
 * - Does not create duplicate contacts or duplicate active enrollments
 *
 * Usage:
 *   node scripts/import-qil-final-2026-2027.mjs
 *   node scripts/import-qil-final-2026-2027.mjs --execute
 *   node scripts/import-qil-final-2026-2027.mjs --file "C:/Users/danan/OneDrive/QI-FinalList.xlsx" --csv "C:/Users/danan/OneDrive/QI-Payments0915.csv"
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */
import { createHash } from "node:crypto"
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

const IMPORT_TAG = "QIL_2026_27_FINAL_V1"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "78616758-d6fc-4a48-a99c-f8ea24a34646"
const DEPARTMENT_ID = "c5d6b286-0d48-431f-9b55-94a80d4821ef"
const PROGRAM_START = "2026-08-17"
const AUTO_MATCH_MIN = 82
const DEFAULT_PAID_TUITION = 450
const DEFAULT_XLSX = "C:/Users/danan/OneDrive/QI-FinalList.xlsx"
const DEFAULT_CSV = "C:/Users/danan/OneDrive/QI-Payments0915.csv"

const TEACHER_ALIASES = {
  "abeer abu kiwan": "Abeer Abukawan",
  "rajaa aljaber": "Rajaa Eljaber",
  "huda elsiesy": "Huda Elseisy",
}

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
  "asmaa mohammad": "Asmaa Ali Ismail Mohamed",
  "soumia b bouhlal": "Soumia Bouhlal",
  "summayya bohlal": "Soumia Bouhlal",
  "birlanti abdalhamid alsawfta": "Birlanti Alsawfta",
  "reda hussain elkomy": "Reda Elkomy",
  "reda elkoumi": "Reda Elkomy",
  "marwa taissir elgamal": "Marwa Elgamal",
  "marwa aljamal": "Marwa Elgamal",
  "nooreleine abushaaban": "NoorElaine Abushaaban",
  "noor abushaaban": "NoorElaine Abushaaban",
  "narmeen alfahal": "Narmeen gamal Alfahal",
  "nermeen alfahl": "Narmeen gamal Alfahal",
  "safa s siddiqui": "Safa siddiqui",
  "imene latreche": "Imene Latrehe",
  "abeer zoubi": "ABEER ZOUBI",
  "raddwa sayed abdalla": "Raddwa Abdalla",
  "anhar ahmed": "Anhar Ahmed",
  "israa alaomairi": "Israa Alaomairi",
  "israa alemairi": "Israa Alaomairi",
  "iman ettabeq": "Iman Ettabaq",
  "sanaa hamdan": "Sana Hamdan",
  "fameh hamdan": "Fatima Hamdan",
  "farah dabbourah": "Farah Dabbura",
  "maryam doumah": "Meriem Douma",
  "maha aburadi": "Maha Abouradi",
  "maha fakhri": "Maha Fakhry",
  "nahed mahmoud": "Nahid Mahmoud",
  "nesreen almarie": "Nisreen Mohamed Almaraghi",
  "nuha abdellatif": "Noha Abdellatif",
  "rula sabri": "Rula Hashim Sabri",
  "iman alghandour": "IMAN IBRAHIM ELGHANDOUR",
  "inas alsaiegh": "Enas Elsaegh",
  "ayah waqqad": "Ayah Wakkad",
  "balqees ali": "Belqes Ali",
  "hanan dibajah": "Hanan Dabaja",
  "rawya tawfeeq": "Rawya Tawfig",
  "rihab althamri": "Rihab Alshamari",
  "rasha alzebn": "Rasha Alzaben",
  "ruqayyah aljanabi": "Roqaiyah Sameer Janabee",
  "zainab irshid": "Zainab Irshaid",
  "ghada abu faraj": "Ghada Abofarag",
  "lina alkhateeb": "Lena Alkhateeb",
  "nemat malas": "Nimat Malas",
  "nuha alduqqa": "Nuha Aldaqqa",
  "heba hourani": "Hiba Ayed Hurani",
  "heba al maenawi": "Heba El Manawy",
  "iman alarja": "Eman Alarja",
  "madihah ahmad": "Madihah Ahmed",
  "madiha ahmad": "Madihah Ahmed",
  "malak hamimi": "Malak Ahmed Hmimy",
  "ruqayya samir aljenabi": "Roqaiyah Sameer Janabee",
  "ruqayyah aljanabi": "Roqaiyah Sameer Janabee",
  "bouthayna alyan": "Buthaynah Alian (Daglas)",
  "buthayna alyan": "Buthaynah Alian (Daglas)",
  "nesreen almaraghi": "Nisreen Mohamed Almaraghi",
  "rehab alshamri": "Rihab Alshamari",
  "aya waqqad": "Ayah Wakkad",
  "aya waqad": "Ayah Wakkad",
  "rasha sami alzeben": "Rasha Alzaben",
  "yusra aldameri": "Yousra Aldemeri",
  "suhair younus": "SUHAIR YOUNES",
  "zohour hawa": "Zuhoor Hawwa",
}

/** Excel listed the husband; the student is Israa. */
const ROSTER_STUDENT_OVERRIDES = {
  "sarfraz amin": {
    studentName: "Israa Alaomairi",
    payerName: "Sarfraz Amin",
  },
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

function parseArgs(argv) {
  const args = {
    file: DEFAULT_XLSX,
    csv: DEFAULT_CSV,
    execute: false,
    orgId: ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--file") args.file = argv[++i]
    else if (argv[i] === "--csv") args.csv = argv[++i]
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
  }
  return args
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

function last10(phone) {
  const digits = String(phone || "").replace(/\D/g, "")
  return digits.length >= 10 ? digits.slice(-10) : ""
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function parseMoney(value) {
  if (value == null || value === "") return 0
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? round2(n) : 0
}

function parseTxnDate(value) {
  const text = normalizeText(value).replace(
    /\s+(CDT|CST|EDT|EST|PDT|PST|MDT|MST)$/i,
    ""
  )
  if (!text) return { date: null, iso: null }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return { date: null, iso: null }
  return {
    date: parsed.toISOString().slice(0, 10),
    iso: parsed.toISOString(),
  }
}

function extractField(remarks, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Subscription Fees|Subscription Discount|Add-Ons Amount|Coupon Code|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
    "i"
  )
  const match = re.exec(remarks || "")
  return match ? normalizeText(match[1]) : ""
}

function parseRemarks(remarks) {
  const text = normalizeText(remarks)
  const membersRaw = extractField(text, "Registered Members")
  const members = membersRaw
    ? membersRaw
        .split(",")
        .map((item) => canonicalizeMemberName(item))
        .filter(Boolean)
    : []
  return {
    members,
    subscriptionFees: parseMoney(extractField(text, "Subscription Fees")),
    subscriptionDiscount: parseMoney(extractField(text, "Subscription Discount")),
    couponCode: normalizeText(extractField(text, "Coupon Code")).toUpperCase(),
    couponValue: parseMoney(extractField(text, "Subscription Coupon Value")),
    isFullPayment: /yes/i.test(extractField(text, "Is Full Payment Made")),
  }
}

function classifyCoupon(code) {
  const coupon = normalizeText(code).toUpperCase()
  if (!coupon) return { type: "none", code: "" }
  if (/^FA\b|^FA[-_]/i.test(coupon)) return { type: "financial_assistance", code: coupon }
  if (/^STAFF/i.test(coupon)) return { type: "staff_credit", code: coupon }
  return { type: "other_discount", code: coupon }
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
  const shorter = Math.min(a.length, b.length)
  const longer = Math.max(a.length, b.length)
  if (
    shorter >= 5 &&
    shorter / longer >= 0.6 &&
    (a.startsWith(b) || b.startsWith(a))
  ) {
    return 0.92
  }
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - levenshtein(a, b) / max
}

function scoreNames(leftName, rightName) {
  const left = foldName(leftName).replace(/\s*\([^)]*\)\s*/g, " ").trim()
  const right = foldName(rightName).replace(/\s*\([^)]*\)\s*/g, " ").trim()
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

function aliasName(name) {
  return NAME_ALIASES[foldName(name)] || TEACHER_ALIASES[foldName(name)] || name
}

function searchNamesFor(name) {
  const canonical = canonicalizeMemberName(name)
  const alias = aliasName(canonical)
  return [...new Set([canonical, alias].filter(Boolean))]
}

function courseFamily(raw) {
  const n = foldName(raw)
  if (!n) return null
  if (n.includes("ajjur") || n.includes("ajurrum")) return "ajurrum"
  if (n.includes("nour") || n.includes("noranea") || n.includes("qaeda")) {
    return "nouraniyyeh"
  }
  if (n.includes("ijaza")) return "ijaza"
  if (n.includes("baqara")) return "baqara"
  if (n.includes("oman") || n.includes("omran")) return "omran"
  if (n.includes("yusuf") || n.includes("yusif") || n.includes("annahl")) {
    return "yusif"
  }
  if (n.includes("level 1")) return "tajweed_l1"
  if (n.includes("level 2")) return "tajweed_l2"
  if (n.includes("advanced")) return "tajweed_adv"
  if (n.includes("beginner")) return "tajweed_beg"
  if (n.includes("osool")) return "tajweed_osool"
  if (n.includes("recitation")) return "recitation"
  if (n.includes("memorization 1") || n.includes("course 1")) return "yusif"
  return null
}

function offeringFamily(name) {
  return courseFamily(name)
}

function paymentBucket(family) {
  if (family === "ajurrum") return "free"
  if (family === "baqara" || family === "omran") return "mem_baqara_omran"
  if (family === "yusif") return "mem_course"
  if (
    family === "recitation" ||
    family === "tajweed_l1" ||
    family === "tajweed_l2" ||
    family === "tajweed_adv" ||
    family === "tajweed_beg" ||
    family === "tajweed_osool" ||
    family === "nouraniyyeh" ||
    family === "ijaza"
  ) {
    return "tajweed_recitation"
  }
  return "other"
}

function reasonBucket(reason) {
  const folded = foldName(reason)
  if (folded.includes("baqara") || folded.includes("omran") || folded.includes("aal imran")) {
    return "mem_baqara_omran"
  }
  if (folded.includes("course 1") || folded.includes("course 2")) return "mem_course"
  return "tajweed_recitation"
}

function deliveryHint(courseRaw) {
  const n = foldName(courseRaw)
  if (n.includes("center") || n.includes("in person")) return "in_person"
  if (n.includes("online")) return "online"
  return null
}

function splitMoneyAcross(total, count) {
  if (count <= 0) return []
  const cents = Math.round(round2(total) * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  return Array.from({ length: count }, (_, index) =>
    round2((base + (index < remainder ? 1 : 0)) / 100)
  )
}

function defaultTuition(family, offering) {
  if (family === "ajurrum") return 0
  if (offering?.tuition != null) return offering.tuition
  if (family === "baqara" || family === "omran") return 225
  return DEFAULT_PAID_TUITION
}

function loadRoster(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`)
  const wb = XLSX.readFile(path, { cellDates: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  })
  return rows
    .map((row, index) => {
      const listedName = canonicalizeMemberName(
        row["English Name"] || row["Student Name"] || row["Student_ Name"]
      )
      const override = ROSTER_STUDENT_OVERRIDES[foldName(listedName)]
      const studentName = override?.studentName || listedName
      const courseRaw = normalizeText(row.Course || row.Offering)
      const teacherRaw = normalizeText(row.Teacher)
      return {
        rowNumber: index + 2,
        studentName,
        listedName,
        payerName: override?.payerName || null,
        courseRaw,
        teacherRaw,
        email: normalizeEmail(row.Email),
        phone: normalizeText(row.Phone),
        family: courseFamily(courseRaw),
        deliveryHint: deliveryHint(courseRaw),
      }
    })
    .filter((row) => row.studentName)
}

function loadPayments(csvPath) {
  if (!existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`)
  const text = readFileSync(csvPath, "utf8")
  const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (errors?.length) console.warn(`CSV parse warnings: ${errors.length}`)
  return data.map((row, index) => {
    const remarks = parseRemarks(row["Payment Remarks"])
    const amount = parseMoney(row.Amount)
    const status = normalizeText(row.Status).toLowerCase()
    const txn = parseTxnDate(row["Transaction Date"])
    const customerName = canonicalizeMemberName(row["Customer Name"])
    const members = remarks.members.length
      ? remarks.members
      : customerName
        ? [customerName]
        : []
    return {
      rowNumber: index + 2,
      customerName,
      email: normalizeEmail(row["Customer Email"]),
      phone: normalizeText(row["Customer Phone"]),
      amount,
      status,
      recurringType: normalizeText(row["Recurring Type"]).toUpperCase(),
      reason: normalizeText(row["Payment / Donation Secondary Reason"]),
      bucket: reasonBucket(row["Payment / Donation Secondary Reason"]),
      transactionId: normalizeText(row["Transaction ID"]),
      refundReason: normalizeText(row["Refund Reason"]),
      date: txn.date,
      iso: txn.iso,
      members,
      ...remarks,
      couponClass: classifyCoupon(remarks.couponCode),
    }
  })
}

async function fetchAll(sb, table, select, apply) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = sb.from(table).select(select).range(from, from + pageSize - 1)
    if (apply) query = apply(query)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

function pickBestContact(name, contacts, minScore = AUTO_MATCH_MIN) {
  const names = searchNamesFor(name)
  const scored = contacts
    .map((contact) => ({
      contact,
      score: Math.max(...names.map((search) => scoreNames(search, contact.full_name))),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
  if (!scored.length) return { match: null, score: 0, ambiguous: [] }
  const best = scored[0]
  if (best.score === 100) return { match: best.contact, score: 100, ambiguous: [] }
  const close = scored.filter(
    (row) =>
      row.contact.id !== best.contact.id &&
      row.score >= minScore &&
      best.score - row.score < 8
  )
  if (best.score < minScore) return { match: null, score: best.score, ambiguous: [] }
  if (close.length) {
    return { match: null, score: best.score, ambiguous: [best, ...close].slice(0, 4) }
  }
  return { match: best.contact, score: best.score, ambiguous: [] }
}

function samePersonName(left, right) {
  return searchNamesFor(left).some((name) => foldName(name) === foldName(right) || scoreNames(name, right) >= AUTO_MATCH_MIN)
}

function resolveTeacher(name, ctx) {
  const staffIds = new Set([...ctx.primaryByOffering.values()])
  const staffContacts = ctx.contacts.filter((contact) => staffIds.has(contact.id))
  const names = searchNamesFor(name)
  for (const search of names) {
    const exact = staffContacts.filter(
      (contact) => foldName(contact.full_name) === foldName(search)
    )
    if (exact.length >= 1) {
      return { contact: exact[0], via: "staff:exact", score: 100, ambiguous: [] }
    }
  }
  const fuzzy = pickBestContact(aliasName(name), staffContacts)
  if (fuzzy.match) {
    return {
      contact: fuzzy.match,
      via: "staff:fuzzy",
      score: fuzzy.score,
      ambiguous: fuzzy.ambiguous,
    }
  }
  return resolveContact(name, null, null, ctx)
}

function resolveContact(name, email, phone, ctx) {
  const names = searchNamesFor(name)
  const emailContact = email ? ctx.contactsByEmail.get(email) : null
  const phoneKey = last10(phone)
  const phoneContact = phoneKey ? ctx.contactsByPhone.get(phoneKey) : null

  for (const search of names) {
    const exactMatches = ctx.preferredContacts.filter(
      (contact) => foldName(contact.full_name) === foldName(search)
    )
    if (exactMatches.length === 1) {
      return { contact: exactMatches[0], via: "preferred:exact", score: 100 }
    }
    if (exactMatches.length > 1) {
      const enrolled =
        exactMatches.find((contact) =>
          ctx.enrollments.some(
            (enroll) =>
              enroll.participant_contact_id === contact.id &&
              enroll.status !== "cancelled"
          )
        ) ||
        exactMatches.find((contact) =>
          ctx.enrollments.some((enroll) => enroll.participant_contact_id === contact.id)
        ) ||
        exactMatches[0]
      return { contact: enrolled, via: "preferred:exact-enrolled", score: 100 }
    }
  }

  if (emailContact && ctx.preferredContacts.some((c) => c.id === emailContact.id)) {
    return { contact: emailContact, via: "preferred:email", score: 100 }
  }
  if (emailContact) {
    const preferredTwin = ctx.preferredContacts.find((contact) =>
      samePersonName(name, contact.full_name)
    )
    if (preferredTwin) {
      return { contact: preferredTwin, via: "preferred:email-twin", score: 100 }
    }
  }

  const preferredFuzzy = pickBestContact(name, ctx.preferredContacts)
  if (preferredFuzzy.match) {
    return {
      contact: preferredFuzzy.match,
      via: "preferred:fuzzy",
      score: preferredFuzzy.score,
      ambiguous: preferredFuzzy.ambiguous,
    }
  }
  if (preferredFuzzy.ambiguous?.length) {
    return {
      contact: null,
      via: "ambiguous",
      score: preferredFuzzy.score,
      ambiguous: preferredFuzzy.ambiguous,
    }
  }

  if (phoneContact && ctx.preferredContacts.some((c) => c.id === phoneContact.id)) {
    return { contact: phoneContact, via: "preferred:phone", score: 100 }
  }
  if (emailContact) return { contact: emailContact, via: "email", score: 100 }
  if (phoneContact) return { contact: phoneContact, via: "phone", score: 100 }

  for (const search of names) {
    const exact = ctx.contacts.find((contact) => foldName(contact.full_name) === foldName(search))
    if (exact) return { contact: exact, via: "all:exact", score: 100 }
  }
  const anyFuzzy = pickBestContact(name, ctx.contacts)
  if (anyFuzzy.match) {
    return {
      contact: anyFuzzy.match,
      via: "all:fuzzy",
      score: anyFuzzy.score,
      ambiguous: anyFuzzy.ambiguous,
    }
  }
  if (anyFuzzy.ambiguous?.length) {
    return { contact: null, via: "ambiguous", score: anyFuzzy.score, ambiguous: anyFuzzy.ambiguous }
  }
  return { contact: null, via: null, score: 0, ambiguous: [] }
}

function pickOffering(family, teacherContactId, hint, ctx) {
  const pool = ctx.offerings.filter((offering) => offering.family === family)
  if (!pool.length) return null
  const byTeacher = pool.filter(
    (offering) => ctx.primaryByOffering.get(offering.id) === teacherContactId
  )
  if (byTeacher.length === 1) return byTeacher[0]
  if (byTeacher.length > 1) {
    const hinted = hint
      ? byTeacher.filter((offering) => offering.delivery_format === hint)
      : []
    return hinted[0] || byTeacher[0]
  }
  if (hint) {
    const hinted = pool.filter((offering) => offering.delivery_format === hint)
    if (hinted.length) return hinted[0]
  }
  return pool[0]
}

function indexContacts(contacts) {
  const contactsByEmail = new Map()
  const contactsByPhone = new Map()
  for (const contact of contacts) {
    if (contact.email) contactsByEmail.set(normalizeEmail(contact.email), contact)
    const phoneKey = last10(contact.phone)
    if (phoneKey) contactsByPhone.set(phoneKey, contact)
  }
  return { contactsByEmail, contactsByPhone }
}

async function loadContext(sb, orgId) {
  const offeringsRaw = await fetchAll(
    sb,
    "program_offerings",
    "id, name, delivery_format, status",
    (q) => q.eq("organization_id", orgId).eq("program_id", PROGRAM_ID)
  )
  const feePlans = await fetchAll(
    sb,
    "program_offering_fee_plans",
    "id, offering_id, name, plan_type, is_default",
    (q) => q.eq("organization_id", orgId).in("offering_id", offeringsRaw.map((o) => o.id))
  )
  const components = feePlans.length
    ? await fetchAll(
        sb,
        "program_offering_fee_plan_components",
        "fee_plan_id, amount, component_type",
        (q) => q.in("fee_plan_id", feePlans.map((p) => p.id))
      )
    : []
  const tuitionByPlan = new Map()
  for (const component of components) {
    if (String(component.component_type || "") === "tuition") {
      tuitionByPlan.set(component.fee_plan_id, Number(component.amount || 0))
    }
  }
  const tuitionByOffering = new Map()
  for (const plan of feePlans) {
    const amount = tuitionByPlan.get(plan.id)
    if (amount == null) continue
    if (plan.is_default || !tuitionByOffering.has(plan.offering_id)) {
      tuitionByOffering.set(plan.offering_id, amount)
    }
    if (plan.plan_type === "free") tuitionByOffering.set(plan.offering_id, 0)
  }
  const offerings = offeringsRaw.map((offering) => ({
    ...offering,
    family: offeringFamily(offering.name),
    tuition:
      tuitionByOffering.has(offering.id)
        ? tuitionByOffering.get(offering.id)
        : offeringFamily(offering.name) === "ajurrum"
          ? 0
          : offeringFamily(offering.name) === "baqara" ||
              offeringFamily(offering.name) === "omran"
            ? 225
            : DEFAULT_PAID_TUITION,
  }))

  const assignments = await fetchAll(
    sb,
    "program_staff_assignments",
    "offering_id, contact_id, is_active, assignment_role",
    (q) =>
      q
        .eq("organization_id", orgId)
        .eq("assignment_role", "primary_instructor")
        .eq("is_active", true)
        .in("offering_id", offerings.map((o) => o.id))
  )
  const primaryByOffering = new Map()
  for (const row of assignments) {
    if (!primaryByOffering.has(row.offering_id)) {
      primaryByOffering.set(row.offering_id, row.contact_id)
    }
  }

  const enrollments = await fetchAll(
    sb,
    "program_enrollments",
    "id, offering_id, participant_contact_id, registrant_contact_id, payer_contact_id, status, payment_status, total_amount, amount_paid, fee_total, discount_total, final_total, charge_id, child_name, notes, enrollment_date, parent_name, parent_email, parent_phone",
    (q) => q.eq("organization_id", orgId).eq("program_id", PROGRAM_ID)
  )
  const applications = await fetchAll(
    sb,
    "program_applications",
    "id, status, enrollment_id, participant_contact_id, registrant_contact_id, participant_name, offering_id, approved_offering_id",
    (q) => q.eq("organization_id", orgId).eq("program_id", PROGRAM_ID)
  )
  const contacts = await fetchAll(sb, "contacts", "id, full_name, email, phone", (q) =>
    q.eq("organization_id", orgId).eq("contact_type", "individual")
  )
  const preferredIds = new Set(
    [
      ...enrollments.map((row) => row.participant_contact_id),
      ...applications.map((row) => row.participant_contact_id),
      ...applications.map((row) => row.registrant_contact_id),
    ].filter(Boolean)
  )
  const { contactsByEmail, contactsByPhone } = indexContacts(contacts)
  return {
    offerings,
    offeringsById: new Map(offerings.map((o) => [o.id, o])),
    primaryByOffering,
    enrollments,
    applications,
    contacts,
    preferredContacts: contacts.filter((c) => preferredIds.has(c.id)),
    contactsByEmail,
    contactsByPhone,
  }
}

function rememberContact(ctx, contact) {
  if (!contact?.id || ctx.contacts.some((c) => c.id === contact.id)) return
  ctx.contacts.push(contact)
  if (contact.email) ctx.contactsByEmail.set(normalizeEmail(contact.email), contact)
  const phoneKey = last10(contact.phone)
  if (phoneKey) ctx.contactsByPhone.set(phoneKey, contact)
}

async function ensureContact(sb, orgId, name, email, phone, execute, ctx) {
  const hit = resolveContact(name, email, phone, ctx)
  if (hit.contact) return { ...hit, created: false }
  if (hit.ambiguous?.length) return { ...hit, created: false }
  if (!execute) {
    const dry = {
      id: `dry-run:${foldName(name)}:${email || last10(phone) || "new"}`,
      full_name: name,
      email: email || null,
      phone: phone || null,
    }
    rememberContact(ctx, dry)
    return { contact: dry, via: "create", score: 0, created: true }
  }
  const { data, error } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: name || "Unknown",
    p_email: email || null,
    p_phone: phone || null,
    p_contact_type: "individual",
  })
  if (error) throw new Error(`contact ${name}: ${error.message}`)
  const { data: contact, error: reloadError } = await sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("id", data)
    .single()
  if (reloadError) throw new Error(`reload contact ${name}: ${reloadError.message}`)
  rememberContact(ctx, contact)
  ctx.preferredContacts.push(contact)
  return { contact, via: "create", score: 0, created: true }
}

function computeAssisted(row, memberCount, listPrice) {
  const shareFee =
    memberCount > 0 ? round2(row.subscriptionFees / memberCount) : row.subscriptionFees
  const shareDiscount =
    memberCount > 0 ? round2(row.subscriptionDiscount / memberCount) : row.subscriptionDiscount
  const shareCoupon =
    memberCount > 0 ? round2(row.couponValue / memberCount) : row.couponValue
  const monthly = row.recurringType === "MONTHLY"
  if (row.couponClass.type === "financial_assistance") {
    return { originalFee: listPrice || shareFee || DEFAULT_PAID_TUITION, assistedFee: 0 }
  }
  if (monthly) {
    const originalFee = listPrice || DEFAULT_PAID_TUITION
    if (row.couponClass.type === "staff_credit") {
      return { originalFee, assistedFee: round2(originalFee * 0.5) }
    }
    return { originalFee, assistedFee: originalFee }
  }
  const originalFee = listPrice || shareFee || DEFAULT_PAID_TUITION
  const assistedFee = Math.max(0, round2(originalFee - shareDiscount - shareCoupon))
  return { originalFee, assistedFee }
}

function paymentStatusOf(assistedFee, amountPaid) {
  if (amountPaid <= 0.009 && assistedFee > 0.009) return "pending"
  if (assistedFee - amountPaid <= 0.009) return "paid"
  return "partial"
}

function chargeStatusOf(assistedFee, amountPaid, remaining) {
  if (amountPaid <= 0.009 && assistedFee > 0.009) return "pending_payment"
  if (remaining <= 0.009) return "paid"
  return "partially_paid"
}

async function writeCharge(sb, orgId, enrollmentRow, money, execute) {
  if (!execute) return enrollmentRow.charge_id || `dry-run:chg:${enrollmentRow.id}`
  const firstIso =
    [...money.payments, ...money.refunds].find((part) => part.iso)?.iso ||
    new Date().toISOString()
  const firstDate =
    [...money.payments, ...money.refunds].find((part) => part.date)?.date ||
    firstIso.slice(0, 10)
  const discountTotal = round2(Math.max(money.originalFee - money.assistedFee, 0))
  const importKey = createHash("sha1")
    .update(`${IMPORT_TAG}|${enrollmentRow.participant_contact_id}|${enrollmentRow.offering_id}`)
    .digest("hex")
  const payload = {
    organization_id: orgId,
    enrollment_id: enrollmentRow.id,
    charge_type: "registration",
    source_type: "manual",
    payer_contact_id: enrollmentRow.payer_contact_id,
    registrant_contact_id: enrollmentRow.registrant_contact_id,
    participant_contact_id: enrollmentRow.participant_contact_id,
    program_id: PROGRAM_ID,
    offering_id: enrollmentRow.offering_id,
    currency: "USD",
    subtotal: money.originalFee,
    discount_total: discountTotal,
    total: money.assistedFee,
    due_today: Math.max(money.remaining, 0),
    amount_paid: money.amountPaid,
    payment_required: money.assistedFee > 0.009,
    charge_status: chargeStatusOf(money.assistedFee, money.amountPaid, money.remaining),
    checkout_status:
      money.amountPaid > 0 || money.assistedFee <= 0.009 ? "paid" : "not_started",
    paid_at: money.amountPaid > 0 || money.cancelled ? firstIso : null,
    metadata: {
      import_tag: IMPORT_TAG,
      import_key: importKey,
      coupon_code: money.couponCode || null,
      coupon_type: money.couponClass?.type || null,
    },
    quote_snapshot: { import: IMPORT_TAG, offering: money.offeringName },
  }
  let chargeId = enrollmentRow.charge_id || null
  if (!chargeId) {
    const { data, error } = await sb.from("program_charges").insert(payload).select("id").single()
    if (error) throw new Error(`charge insert: ${error.message}`)
    chargeId = data.id
    await sb
      .from("program_enrollments")
      .update({ charge_id: chargeId })
      .eq("id", enrollmentRow.id)
      .eq("organization_id", orgId)
  } else {
    const { error } = await sb
      .from("program_charges")
      .update(payload)
      .eq("id", chargeId)
      .eq("organization_id", orgId)
    if (error) throw new Error(`charge update: ${error.message}`)
  }

  await sb.from("program_charge_lines").delete().eq("organization_id", orgId).eq("charge_id", chargeId)
  const lines = [
    {
      organization_id: orgId,
      charge_id: chargeId,
      line_type: "tuition",
      label: money.offeringName,
      quantity: 1,
      unit_amount: money.originalFee,
      amount: money.originalFee,
      sort_order: 0,
      metadata: { import_tag: IMPORT_TAG },
    },
  ]
  if (discountTotal > 0.009) {
    const lineType =
      money.couponClass?.type === "financial_assistance"
        ? "financial_assistance"
        : money.couponClass?.type === "staff_credit"
          ? "staff_discount"
          : "discount"
    lines.push({
      organization_id: orgId,
      charge_id: chargeId,
      line_type: lineType,
      label: money.couponCode ? `Discount (${money.couponCode})` : "Full payment discount",
      quantity: 1,
      unit_amount: -discountTotal,
      amount: -discountTotal,
      sort_order: 1,
      metadata: { import_tag: IMPORT_TAG },
    })
  }
  const { error: lineError } = await sb.from("program_charge_lines").insert(lines)
  if (lineError) throw new Error(`charge lines: ${lineError.message}`)

  await sb
    .from("program_charge_schedule")
    .delete()
    .eq("organization_id", orgId)
    .eq("charge_id", chargeId)
  const scheduleRows = []
  let sequence = 1
  for (const part of money.payments) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: `Payment ${part.date || sequence}`,
      due_date: part.date,
      amount: part.amount,
      sequence_number: sequence,
      status: "paid",
      charge_category: "tuition",
      paid_at: part.iso || (part.date ? `${part.date}T17:00:00Z` : firstIso),
      metadata: {
        import_tag: IMPORT_TAG,
        stripe_charge_id: part.transactionId,
        recurring_type: part.recurringType,
      },
    })
    sequence += 1
  }
  for (const part of money.refunds) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: `Refund ${part.date || sequence}`,
      due_date: part.date,
      amount: part.amount,
      original_amount: part.amount,
      sequence_number: sequence,
      status: "refunded",
      charge_category: "tuition",
      paid_at: part.iso || (part.date ? `${part.date}T17:00:00Z` : firstIso),
      metadata: {
        import_tag: IMPORT_TAG,
        stripe_charge_id: part.transactionId,
        refund_reason: part.refundReason || null,
      },
    })
    sequence += 1
  }
  if (money.remaining > 0.009 && !money.cancelled) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: "Remaining tuition",
      due_date: firstDate,
      amount: money.remaining,
      sequence_number: sequence,
      status: "scheduled",
      charge_category: "tuition",
      metadata: { import_tag: IMPORT_TAG },
    })
  }
  if (scheduleRows.length) {
    const { error: scheduleError } = await sb.from("program_charge_schedule").insert(scheduleRows)
    if (scheduleError) throw new Error(`schedule: ${scheduleError.message}`)
  }
  return chargeId
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const roster = loadRoster(args.file)
  const paymentRows = loadPayments(args.csv)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const ctx = await loadContext(sb, args.orgId)

  const unmatched = []
  const ambiguous = []
  const unmappedCourses = []
  const createdContacts = []
  const keepExistingNotes = []
  const targets = []
  const seenTarget = new Set()
  const keepContactIds = new Set()
  const nameByContact = new Map()

  for (const row of roster) {
    const studentHit = await ensureContact(
      sb,
      args.orgId,
      row.studentName,
      row.email,
      row.phone,
      args.execute,
      ctx
    )
    if (studentHit.ambiguous?.length && !studentHit.contact) {
      ambiguous.push({
        rowNumber: row.rowNumber,
        name: row.studentName,
        course: row.courseRaw,
        candidates: studentHit.ambiguous.map((item) => ({
          name: item.contact.full_name,
          score: item.score,
        })),
      })
      continue
    }
    if (!studentHit.contact) {
      unmatched.push({
        rowNumber: row.rowNumber,
        name: row.studentName,
        course: row.courseRaw,
        email: row.email,
      })
      continue
    }
    if (studentHit.created) {
      createdContacts.push({ name: row.studentName, email: row.email })
    }
    keepContactIds.add(studentHit.contact.id)
    const prior = nameByContact.get(studentHit.contact.id)
    if (prior && foldName(prior) !== foldName(row.studentName)) {
      console.log(
        `NAME COLLISION: ${prior} + ${row.studentName} → ${studentHit.contact.full_name}`
      )
    }
    nameByContact.set(studentHit.contact.id, row.studentName)

    if (!row.family) {
      keepExistingNotes.push({
        name: row.studentName,
        matched: studentHit.contact.full_name,
        reason: "on list without a course — keeping current enrollment(s)",
      })
      const existing = ctx.enrollments.filter(
        (enroll) =>
          enroll.participant_contact_id === studentHit.contact.id &&
          enroll.status !== "cancelled"
      )
      for (const enroll of existing) {
        const offering = ctx.offeringsById.get(enroll.offering_id)
        const key = `${studentHit.contact.id}::${enroll.offering_id}`
        if (seenTarget.has(key)) continue
        seenTarget.add(key)
        targets.push({
          student: studentHit.contact,
          excelName: row.studentName,
          offering,
          family: offering?.family || null,
          bucket: paymentBucket(offering?.family),
          teacherRaw: row.teacherRaw,
          email: row.email,
          phone: row.phone,
          existing: enroll,
          keepExisting: true,
        })
      }
      continue
    }

    const teacherHit = resolveTeacher(row.teacherRaw, ctx)
    const offering = pickOffering(
      row.family,
      teacherHit.contact?.id,
      row.deliveryHint,
      ctx
    )
    if (!offering) {
      unmappedCourses.push({
        rowNumber: row.rowNumber,
        name: row.studentName,
        course: row.courseRaw,
      })
      continue
    }
    const key = `${studentHit.contact.id}::${offering.id}`
    if (seenTarget.has(key)) continue
    seenTarget.add(key)
    targets.push({
      student: studentHit.contact,
      excelName: row.studentName,
      offering,
      family: row.family,
      bucket: paymentBucket(row.family),
      teacherRaw: row.teacherRaw,
      email: row.email,
      phone: row.phone,
      existing: null,
      keepExisting: false,
    })
  }

  const activeByStudent = new Map()
  for (const enroll of ctx.enrollments) {
    if (enroll.status === "cancelled") continue
    const list = activeByStudent.get(enroll.participant_contact_id) || []
    list.push(enroll)
    activeByStudent.set(enroll.participant_contact_id, list)
  }

  const usedEnrollmentIds = new Set()
  for (const target of targets) {
    const pool = (activeByStudent.get(target.student.id) || []).filter(
      (enroll) => !usedEnrollmentIds.has(enroll.id)
    )
    const sameOffering = pool.find((enroll) => enroll.offering_id === target.offering.id)
    const sameFamily = pool.find((enroll) => {
      const offering = ctx.offeringsById.get(enroll.offering_id)
      return offering?.family === target.family
    })
    const sameBucket = pool.find((enroll) => {
      const offering = ctx.offeringsById.get(enroll.offering_id)
      return paymentBucket(offering?.family) === target.bucket && target.bucket !== "free"
    })
    const match = sameOffering || sameFamily || sameBucket || null
    if (match) {
      target.existing = match
      usedEnrollmentIds.add(match.id)
    }
  }
  const leftoverByStudent = new Map()
  for (const target of targets) {
    if (target.existing) continue
    const list = leftoverByStudent.get(target.student.id) || []
    list.push(target)
    leftoverByStudent.set(target.student.id, list)
  }
  for (const [contactId, leftoverTargets] of leftoverByStudent.entries()) {
    const unused = (activeByStudent.get(contactId) || []).filter(
      (enroll) => !usedEnrollmentIds.has(enroll.id)
    )
    const paidTargets = leftoverTargets.filter((target) => target.family !== "ajurrum")
    const count = Math.min(paidTargets.length, unused.length)
    for (let i = 0; i < count; i += 1) {
      paidTargets[i].existing = unused[i]
      usedEnrollmentIds.add(unused[i].id)
    }
  }

  const toCancel = []
  for (const enroll of ctx.enrollments) {
    if (enroll.status === "cancelled") continue
    if (usedEnrollmentIds.has(enroll.id)) continue
    const offering = ctx.offeringsById.get(enroll.offering_id)
    const contact = ctx.contacts.find((c) => c.id === enroll.participant_contact_id)
    toCancel.push({
      enrollment: enroll,
      name: contact?.full_name || enroll.child_name,
      offering: offering?.name,
      onFinalList: keepContactIds.has(enroll.participant_contact_id),
    })
  }

  const moneyByTarget = new Map()
  const unmatchedPaymentMembers = []
  function moneyKey(contactId, bucket) {
    return `${contactId}::${bucket}`
  }
  function targetForPayment(contactId, bucket) {
    const matches = targets.filter(
      (target) => target.student.id === contactId && target.bucket === bucket
    )
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      return [...matches].sort((a, b) => {
        const an = foldName(a.offering.name)
        const bn = foldName(b.offering.name)
        const order = [
          "recitation improvement",
          "tajweed level 1",
          "tajweed beginner",
          "tajweed osool",
          "tajweed advanced",
          "al nouraniyyeh",
          "preparing for ijaza",
        ]
        return (
          order.findIndex((item) => an.includes(item)) -
          order.findIndex((item) => bn.includes(item))
        )
      })[0]
    }
    return null
  }

  for (const row of paymentRows) {
    if (row.status !== "succeeded" && row.status !== "refunded") continue
    const memberCount = Math.max(row.members.length, 1)
    const amountShares = splitMoneyAcross(Math.abs(row.amount), memberCount)
    for (let index = 0; index < row.members.length; index += 1) {
      const memberName = row.members[index]
      const memberEmail =
        foldName(memberName) === foldName(row.customerName) ? row.email : null
      const hit = resolveContact(memberName, memberEmail, row.phone, ctx)
      const payerHit = resolveContact(row.customerName, row.email, row.phone, ctx)
      if (!hit.contact) {
        unmatchedPaymentMembers.push({
          rowNumber: row.rowNumber,
          memberName,
          customerName: row.customerName,
          amount: row.amount,
        })
        continue
      }
      function keepSeat(contactId, bucket) {
        return (
          targetForPayment(contactId, bucket) ||
          targets.find(
            (item) =>
              item.student.id === contactId &&
              !item.cancelledFromList &&
              item.bucket !== "free"
          ) ||
          null
        )
      }
      let target = keepSeat(hit.contact.id, row.bucket)
      if (!target && payerHit.contact && payerHit.contact.id !== hit.contact.id) {
        target = keepSeat(payerHit.contact.id, row.bucket)
      }
      if (!target) {
        unmatchedPaymentMembers.push({
          rowNumber: row.rowNumber,
          memberName,
          customerName: row.customerName,
          amount: row.amount,
          reason: row.reason,
          note: "paid but student is not on the final list",
        })
        continue
      }
      const key = moneyKey(target.student.id, `${target.offering.id}`)
      if (!moneyByTarget.has(key)) {
        const tuition = defaultTuition(target.family, target.offering)
        moneyByTarget.set(key, {
          target,
          originalFee: tuition,
          assistedFee: tuition,
          couponCode: "",
          couponClass: { type: "none", code: "" },
          payments: [],
          refunds: [],
          grossPaid: 0,
          refunded: 0,
          payerName: row.customerName,
          payerEmail: row.email,
          payerPhone: row.phone,
        })
      }
      const group = moneyByTarget.get(key)
      const fees = computeAssisted(row, memberCount, group.originalFee)
      if (fees.originalFee > group.originalFee) group.originalFee = fees.originalFee
      if (row.isFullPayment || row.couponClass.type !== "none") {
        group.assistedFee = fees.assistedFee
        group.couponCode = row.couponCode || group.couponCode
        group.couponClass = row.couponClass.type !== "none" ? row.couponClass : group.couponClass
      }
      const share = amountShares[index] || 0
      const part = {
        amount: share,
        date: row.date,
        iso: row.iso,
        transactionId: row.transactionId,
        recurringType: row.recurringType,
        refundReason: row.refundReason,
      }
      if (row.status === "refunded") {
        group.refunds.push(part)
        group.refunded = round2(group.refunded + share)
      } else {
        group.payments.push(part)
        group.grossPaid = round2(group.grossPaid + share)
      }
    }
  }

  const plan = {
    keep: [],
    create: [],
    move: [],
    update: [],
    cancel: toCancel,
  }

  for (const target of targets) {
    const money = moneyByTarget.get(moneyKey(target.student.id, `${target.offering.id}`))
    const tuition = defaultTuition(target.family, target.offering)
    const cancelledFromList = Boolean(target.cancelledFromList)
    let originalFee = tuition
    let assistedFee = tuition
    let amountPaid = 0
    let payments = []
    let refunds = []
    let couponCode = ""
    let couponClass = { type: "none", code: "" }
    if (money) {
      originalFee = money.originalFee
      assistedFee = money.assistedFee
      amountPaid = round2(Math.max(money.grossPaid - money.refunded, 0))
      payments = money.payments
      refunds = money.refunds
      couponCode = money.couponCode
      couponClass = money.couponClass
      if (money.refunded > 0.009 && amountPaid <= 0.009 && cancelledFromList) {
        assistedFee = 0
      }
    } else if (target.existing && Number(target.existing.amount_paid || 0) > 0.009) {
      originalFee = Number(target.existing.fee_total || tuition)
      assistedFee = Number(target.existing.total_amount || tuition)
      amountPaid = Number(target.existing.amount_paid || 0)
    }
    if (target.family === "ajurrum") {
      originalFee = 0
      assistedFee = 0
    }
    const remaining = round2(Math.max(assistedFee - amountPaid, 0))
    const cancelled = cancelledFromList
    const moneyView = {
      originalFee,
      assistedFee,
      amountPaid,
      remaining,
      payments,
      refunds,
      couponCode,
      couponClass,
      cancelled,
      offeringName: target.offering.name,
      payerName: money?.payerName || target.excelName,
      payerEmail: money?.payerEmail || target.email,
      payerPhone: money?.payerPhone || target.phone,
    }
    const item = {
      studentName: target.excelName,
      matchedName: target.student.full_name,
      offering: target.offering.name,
      delivery: target.offering.delivery_format,
      teacher: target.teacherRaw,
      originalFee,
      assistedFee,
      amountPaid,
      remaining,
      paymentStatus: paymentStatusOf(assistedFee, amountPaid),
      cancelled,
      money: moneyView,
      target,
    }
    if (!target.existing) {
      plan.create.push(item)
    } else if (target.existing.offering_id !== target.offering.id) {
      plan.move.push(item)
    } else if (cancelled && target.existing.status !== "cancelled") {
      plan.cancel.push({
        enrollment: target.existing,
        name: target.excelName,
        offering: target.offering.name,
        onFinalList: false,
        money: moneyView,
      })
    } else {
      plan.update.push(item)
    }
  }

  const seenCancel = new Set()
  plan.cancel = plan.cancel.filter((row) => {
    if (seenCancel.has(row.enrollment.id)) return false
    seenCancel.add(row.enrollment.id)
    return true
  })

  const toWithdraw = ctx.applications.filter((app) => {
    if (!["approved", "submitted"].includes(app.status)) return false
    if (keepContactIds.has(app.participant_contact_id)) return false
    if (app.enrollment_id) {
      const enroll = ctx.enrollments.find((row) => row.id === app.enrollment_id)
      if (enroll && enroll.status !== "cancelled") return false
      if (enroll) return false
    }
    return true
  })

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const mode = args.execute ? "execute" : "dry-run"
  const reportPath = resolve(reportDir, `qil-2026-2027-final-${mode}.json`)
  const summary = {
    rosterRows: roster.length,
    uniqueKeepContacts: keepContactIds.size,
    targets: targets.filter((t) => !t.cancelledFromList).length,
    create: plan.create.length,
    update: plan.update.length,
    move: plan.move.length,
    cancel: plan.cancel.length,
    withdrawApplications: toWithdraw.length,
    createdContacts: createdContacts.length,
    unmatchedStudents: unmatched.length,
    ambiguous: ambiguous.length,
    unmappedCourses: unmappedCourses.length,
    unmatchedPaymentMembers: unmatchedPaymentMembers.length,
    csvNet: round2(paymentRows.reduce((sum, row) => sum + row.amount, 0)),
  }
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        importTag: IMPORT_TAG,
        mode,
        generatedAt: new Date().toISOString(),
        file: args.file,
        csv: args.csv,
        summary,
        createdContacts,
        keepExistingNotes,
        unmatched,
        ambiguous,
        unmappedCourses,
        unmatchedPaymentMembers,
        create: plan.create.map((row) => ({
          student: row.studentName,
          matched: row.matchedName,
          offering: row.offering,
          teacher: row.teacher,
          amountPaid: row.amountPaid,
          assistedFee: row.assistedFee,
        })),
        move: plan.move.map((row) => ({
          student: row.studentName,
          from: ctx.offeringsById.get(row.target.existing.offering_id)?.name,
          to: row.offering,
          amountPaid: row.amountPaid,
        })),
        cancel: plan.cancel.map((row) => ({
          name: row.name,
          offering: row.offering,
          onFinalList: row.onFinalList,
          paid: Number(row.enrollment.amount_paid || 0),
        })),
        withdrawApplications: toWithdraw.map((app) => ({
          name: app.participant_name,
          status: app.status,
        })),
      },
      null,
      2
    )
  )

  console.log(`Mode: ${mode.toUpperCase()}`)
  console.log(JSON.stringify(summary, null, 2))
  if (keepExistingNotes.length) {
    console.log("\nKept existing seats (list row had no course):")
    for (const row of keepExistingNotes) console.log(`  ${row.name} — ${row.reason}`)
  }
  if (unmatched.length) {
    console.log("\nUnmatched students:")
    for (const row of unmatched) console.log(`  ${row.name} / ${row.course}`)
  }
  if (ambiguous.length) {
    console.log("\nAmbiguous names:")
    for (const row of ambiguous) {
      console.log(
        `  ${row.name} → ${row.candidates.map((c) => `${c.name} (${c.score})`).join("; ")}`
      )
    }
  }
  if (unmappedCourses.length) {
    console.log("\nUnmapped courses:")
    for (const row of unmappedCourses) console.log(`  ${row.course} (${row.name})`)
  }
  console.log(`\nCreate ${plan.create.length}, update ${plan.update.length}, move ${plan.move.length}, cancel ${plan.cancel.length}`)
  console.log("Cancels:")
  for (const row of plan.cancel) {
    console.log(
      `  ${row.name} / ${row.offering}${row.onFinalList ? " (extra class)" : " (not on final list)"}`
    )
  }
  console.log(`Report: ${reportPath}`)

  if (unmatched.length || ambiguous.length || unmappedCourses.length) {
    throw new Error("Fix unmatched / ambiguous / unmapped rows before --execute.")
  }
  if (!args.execute) {
    console.log("\nDry-run complete. Re-run with --execute to write.")
    return
  }

  const now = new Date().toISOString()
  async function upsertEnrollment(item, status) {
    const target = item.target
    const payerHit = resolveContact(
      item.money.payerName || target.excelName,
      item.money.payerEmail || target.email,
      item.money.payerPhone || target.phone,
      ctx
    )
    const payer = payerHit.contact || target.student
    const firstDate =
      [...item.money.payments, ...item.money.refunds].find((part) => part.date)?.date ||
      PROGRAM_START
    const payload = {
      organization_id: args.orgId,
      program_id: PROGRAM_ID,
      offering_id: target.offering.id,
      department_id: DEPARTMENT_ID,
      child_name: target.excelName,
      participant_contact_id: target.student.id,
      registrant_contact_id: payer.id,
      payer_contact_id: payer.id,
      status,
      payment_status: item.paymentStatus,
      total_amount: item.assistedFee,
      amount_paid: item.amountPaid,
      fee_total: item.originalFee,
      discount_total: round2(Math.max(item.originalFee - item.assistedFee, 0)),
      final_total: item.assistedFee,
      enrollment_date: target.existing?.enrollment_date || firstDate,
      participant_type: "adult",
      registrant_type: payer.id === target.student.id ? "adult_self" : "guardian",
      parent_name: payer.full_name,
      parent_email: item.money.payerEmail || payer.email || target.email || null,
      parent_phone: item.money.payerPhone || payer.phone || target.phone || null,
      notes: `Imported ${IMPORT_TAG}`,
      payment_required: item.assistedFee > 0.009,
      cancelled_at: status === "cancelled" ? now : null,
      cancel_reason:
        status === "cancelled" ? "Not on QI-FinalList.xlsx for 2026-2027" : null,
    }
    let enrollmentId = target.existing?.id || null
    if (!enrollmentId) {
      const { data, error } = await sb
        .from("program_enrollments")
        .insert(payload)
        .select("id, charge_id, participant_contact_id, registrant_contact_id, payer_contact_id, offering_id")
        .single()
      if (error) throw new Error(`enroll ${item.studentName}: ${error.message}`)
      enrollmentId = data.id
      target.existing = data
    } else {
      const { error } = await sb
        .from("program_enrollments")
        .update(payload)
        .eq("id", enrollmentId)
        .eq("organization_id", args.orgId)
      if (error) throw new Error(`update ${item.studentName}: ${error.message}`)
      target.existing = { ...target.existing, ...payload, id: enrollmentId }
    }
    const enrollmentRow = {
      id: enrollmentId,
      offering_id: target.offering.id,
      participant_contact_id: target.student.id,
      registrant_contact_id: payer.id,
      payer_contact_id: payer.id,
      charge_id: target.existing.charge_id || null,
    }
    await writeCharge(sb, args.orgId, enrollmentRow, item.money, true)

    const apps = ctx.applications.filter(
      (app) => app.participant_contact_id === target.student.id
    )
    const matchingApp =
      apps.find((app) => (app.approved_offering_id || app.offering_id) === target.offering.id) ||
      apps.find((app) => {
        const offering = ctx.offeringsById.get(app.approved_offering_id || app.offering_id)
        return offering?.family === target.family
      })
    if (matchingApp) {
      await sb
        .from("program_applications")
        .update({
          status: "approved",
          enrollment_id: enrollmentId,
          approved_offering_id: target.offering.id,
          participant_name: target.excelName,
          updated_at: now,
        })
        .eq("id", matchingApp.id)
        .eq("organization_id", args.orgId)
    } else if (!String(target.student.id).startsWith("dry-run:")) {
      await sb.from("program_applications").insert({
        organization_id: args.orgId,
        program_id: PROGRAM_ID,
        offering_id: target.offering.id,
        approved_offering_id: target.offering.id,
        registrant_contact_id: target.student.id,
        participant_contact_id: target.student.id,
        participant_name: target.excelName,
        applicant_type: "returning",
        status: "approved",
        source: "staff",
        enrollment_id: enrollmentId,
        evaluation_notes: `${IMPORT_TAG} | Final list`,
        evaluated_at: now,
      })
    }

    if (target.email && !target.student.email) {
      await sb
        .from("contacts")
        .update({ email: target.email })
        .eq("id", target.student.id)
        .eq("organization_id", args.orgId)
    }
    if (target.phone && !target.student.phone) {
      await sb
        .from("contacts")
        .update({ phone: target.phone })
        .eq("id", target.student.id)
        .eq("organization_id", args.orgId)
    }
    try {
      await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: target.student.id,
      })
    } catch (error) {
      console.warn(`affiliation warn (${item.studentName}): ${error.message}`)
    }
  }

  for (const item of [...plan.create, ...plan.update, ...plan.move]) {
    await upsertEnrollment(item, item.cancelled ? "cancelled" : "enrolled")
  }

  for (const row of plan.cancel) {
    const payload = {
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: row.onFinalList
        ? "Removed extra class — not on QI-FinalList.xlsx"
        : "Not on QI-FinalList.xlsx for 2026-2027",
      notes: `${row.enrollment.notes || ""}\nImported ${IMPORT_TAG} — cancelled`.trim(),
    }
    if (!row.onFinalList) {
      payload.amount_paid = 0
      payload.total_amount = 0
      payload.final_total = 0
      payload.payment_status = "paid"
    }
    const { error } = await sb
      .from("program_enrollments")
      .update(payload)
      .eq("id", row.enrollment.id)
      .eq("organization_id", args.orgId)
    if (error) throw new Error(`cancel ${row.name}: ${error.message}`)
  }

  for (const app of toWithdraw) {
    const { error } = await sb
      .from("program_applications")
      .update({
        status: "withdrawn",
        evaluation_notes: `${app.evaluation_notes || ""}\n${IMPORT_TAG} | Not on final list`.trim(),
        evaluated_at: now,
        updated_at: now,
      })
      .eq("id", app.id)
      .eq("organization_id", args.orgId)
    if (error) throw new Error(`withdraw ${app.participant_name}: ${error.message}`)
  }

  console.log("\nExecute complete.")
  console.log(`Report: ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
