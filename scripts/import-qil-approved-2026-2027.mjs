/**
 * Import the finalized QIL 2026–2027 approved roster (QIApproved.xlsx)
 * into program_applications as status=approved.
 *
 * - Matches existing contacts / applications even when spelling differs
 * - Creates missing offerings and teachers
 * - Renames Memorization 2 → Memorization (Yusif - Annahl) (same class)
 *
 * Usage:
 *   node scripts/import-qil-approved-2026-2027.mjs
 *   node scripts/import-qil-approved-2026-2027.mjs --file "C:/Users/danan/Downloads/QIApproved.xlsx"
 *   node scripts/import-qil-approved-2026-2027.mjs --execute
 */
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2026_27_APPROVED_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_FILE = "C:/Users/danan/Downloads/QIApproved.xlsx"
const PROGRAM_NAME = "Quran Institute for Ladies 2026-2027"
const PROGRAM_START = "2026-08-17"
const PROGRAM_END = "2027-04-16"
const PRIOR_PROGRAM_ID = "88a39883-baa8-424b-91c0-93a309978c3b"
const AUTO_MATCH_MIN = 82

const OFFERING_MAP = {
  "al ajjuremyeh": {
    action: "match",
    name: "Al-Ajurrumiyyah",
    delivery: "online",
  },
  "al nouraniyyeh": {
    action: "create",
    name: "Al Nouraniyyeh",
    delivery: "online",
  },
  "ijaza preparation": {
    action: "match",
    name: "Preparing for Ijaza",
    delivery: "online",
  },
  "memorization (surat al-omran)": {
    action: "match",
    name: "Memorization (Surat Al-Omran)",
    delivery: "online",
  },
  "memorization (yusif - annahl)": {
    action: "rename",
    fromName: "Memorization 2",
    name: "Memorization (Yusif - Annahl)",
    delivery: "online",
  },
  "recitation improvement": {
    action: "match",
    name: "Recitation Improvement",
    delivery: "online",
  },
  "tajweed (advanced) - arabic speaking": {
    action: "match",
    name: "Tajweed (Advanced)",
    delivery: "in_person",
  },
  "tajweed (beginner) - arabic speaking": {
    action: "match",
    name: "Tajweed (Beginner)",
    delivery: "online",
  },
  "tajweed (osool) - arabic speaking": {
    action: "match",
    name: "Tajweed (Osool)",
    delivery: "online",
  },
  "tajweed level 1 (non-arabic speaking)": {
    action: "create",
    name: "Tajweed Level 1 (Non-Arabic Speaking)",
    delivery: "online",
  },
  "tajweed level 2 (non-arabic speaking)": {
    action: "create",
    name: "Tajweed Level 2 (Non-Arabic Speaking)",
    delivery: "online",
  },
}

const TEACHER_ALIASES = {
  "abeer abu kiwan": "Abeer Abukawan",
  "rajaa aljaber": "Rajaa Eljaber",
}

const STUDENT_ALIASES = {
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
  "imene latreche": "Imene Latrehe",
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
  "ola alkhousi": "Viola Mohamed Alkhousi",
  "ghada abu faraj": "Ghada Abofarag",
  "ghadeer zarkani": "Ghadeer Zakani",
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

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    execute: false,
    orgId: DEFAULT_ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--file") args.file = argv[++i]
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

const FOLDED_OFFERING_MAP = Object.fromEntries(
  Object.entries(OFFERING_MAP).map(([key, spec]) => [foldName(key), spec])
)

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

function scoreNames(excelName, dbName) {
  const left = foldName(excelName).replace(/\s*\([^)]*\)\s*/g, " ").trim()
  const right = foldName(dbName).replace(/\s*\([^)]*\)\s*/g, " ").trim()
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

function resolveStudentAlias(name) {
  const alias = STUDENT_ALIASES[foldName(name)]
  return alias || name
}

function resolveTeacherAlias(name) {
  const alias = TEACHER_ALIASES[foldName(name)]
  return alias || name
}

function loadRows(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`)
  const wb = XLSX.readFile(path, { cellDates: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  })
  return rows
    .map((row, index) => {
      const studentName = normalizeText(row["Student_ Name"] || row["Student Name"])
      const offeringRaw = normalizeText(row.Offering)
      const teacherRaw = normalizeText(row.Teacher)
      return {
        rowNumber: index + 2,
        studentName,
        offeringRaw,
        teacherRaw,
        offeringSpec: FOLDED_OFFERING_MAP[foldName(offeringRaw)] || null,
      }
    })
    .filter((row) => row.studentName && row.offeringRaw)
}

async function fetchAll(sb, table, columns, filters = []) {
  const rows = []
  let from = 0
  while (true) {
    let query = sb.from(table).select(columns).range(from, from + 999)
    for (const filter of filters) {
      if (filter.op === "eq") query = query.eq(filter.col, filter.val)
      if (filter.op === "in") query = query.in(filter.col, filter.val)
    }
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return rows
}

function pickBestContact(excelName, contacts) {
  const aliasName = resolveStudentAlias(excelName)
  const scored = contacts
    .map((contact) => ({
      contact,
      score: Math.max(
        scoreNames(excelName, contact.full_name),
        scoreNames(aliasName, contact.full_name)
      ),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return { match: null, score: 0, ambiguous: [] }
  const best = scored[0]
  if (best.score === 100) {
    return { match: best.contact, score: 100, ambiguous: [] }
  }
  const close = scored.filter(
    (row) =>
      row.contact.id !== best.contact.id &&
      row.score >= AUTO_MATCH_MIN &&
      best.score - row.score < 8
  )
  if (best.score < AUTO_MATCH_MIN) {
    return { match: null, score: best.score, ambiguous: [] }
  }
  if (close.length) {
    return { match: null, score: best.score, ambiguous: [best, ...close].slice(0, 4) }
  }
  return { match: best.contact, score: best.score, ambiguous: [] }
}

async function ensureOffering(sb, orgId, program, spec, execute, cache) {
  const cacheKey = `${spec.name}::${spec.delivery}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const { data: existing, error } = await sb
    .from("program_offerings")
    .select("id, name, delivery_format, status")
    .eq("organization_id", orgId)
    .eq("program_id", program.id)

  if (error) throw new Error(`offering lookup: ${error.message}`)

  let match =
    (existing || []).find(
      (row) =>
        foldName(row.name) === foldName(spec.name) &&
        (row.delivery_format || "in_person") === spec.delivery
    ) || null

  if (!match && spec.action === "rename" && spec.fromName) {
    match =
      (existing || []).find(
        (row) =>
          foldName(row.name) === foldName(spec.fromName) &&
          (row.delivery_format || "in_person") === spec.delivery
      ) || null
    if (match && execute && foldName(match.name) !== foldName(spec.name)) {
      const { error: renameError } = await sb
        .from("program_offerings")
        .update({ name: spec.name })
        .eq("id", match.id)
      if (renameError) {
        throw new Error(`rename ${spec.fromName}: ${renameError.message}`)
      }
      match = { ...match, name: spec.name }
    }
    if (match && !execute) {
      match = { ...match, name: spec.name, renamedFrom: spec.fromName }
    }
  }

  if (match) {
    const result = { offering: match, created: false, renamed: Boolean(spec.fromName) }
    cache.set(cacheKey, result)
    return result
  }

  if (!execute) {
    const result = {
      offering: {
        id: `dry-run:offering:${cacheKey}`,
        name: spec.name,
        delivery_format: spec.delivery,
        status: "active",
      },
      created: true,
      renamed: false,
    }
    cache.set(cacheKey, result)
    return result
  }

  const isOnline = spec.delivery === "online"
  const { data, error: insertError } = await sb
    .from("program_offerings")
    .insert({
      organization_id: orgId,
      program_id: program.id,
      name: spec.name,
      is_default: false,
      offering_type: "academic_year",
      start_date: program.start_date || PROGRAM_START,
      end_date: program.end_date || PROGRAM_END,
      enrollment_open_date: "2026-06-03",
      enrollment_close_date: program.start_date || PROGRAM_START,
      status: "active",
      delivery_format: spec.delivery,
      application_required: true,
      audience_type: "adult",
      min_age: 18,
      capacity: isOnline ? 100 : 20,
      capacity_mode: "limited",
      enable_waitlist: false,
      gender: "Female",
      require_guardian: false,
      require_emergency_contact: true,
      registration_mode: "required",
      attendance_tracked: false,
      inherit_dates: false,
      inherit_eligibility: false,
      inherit_enrollment: false,
      care_enabled: false,
    })
    .select("id, name, delivery_format, status")
    .single()
  if (insertError || !data) {
    throw new Error(`create offering ${spec.name}: ${insertError?.message}`)
  }
  const result = { offering: data, created: true, renamed: false }
  cache.set(cacheKey, result)
  return result
}

async function ensureTeacher(sb, orgId, departmentId, excelName, contacts, execute) {
  const canonical = resolveTeacherAlias(excelName)
  const { match, score, ambiguous } = pickBestContact(canonical, contacts)
  let contact = match
  if (!contact) {
    const exact = contacts.find((c) => foldName(c.full_name) === foldName(canonical))
    contact = exact || null
  }

  if (!contact && !execute) {
    return {
      contact: {
        id: `dry-run:teacher:${foldName(canonical)}`,
        full_name: canonical,
      },
      createdContact: true,
      createdStaff: true,
      score,
      ambiguous,
    }
  }

  if (!contact && execute) {
    const { data, error } = await sb
      .from("contacts")
      .insert({
        organization_id: orgId,
        full_name: canonical,
        contact_type: "individual",
        status: "active",
      })
      .select("id, full_name, email, phone")
      .single()
    if (error) throw new Error(`teacher contact ${canonical}: ${error.message}`)
    contact = data
    contacts.push(contact)
  }

  const { data: staffRow } = await sb
    .from("staff")
    .select("id, contact_id, department_id, status")
    .eq("organization_id", orgId)
    .eq("contact_id", contact.id)
    .maybeSingle()

  let createdStaff = false
  if (!staffRow) {
    createdStaff = true
    if (execute) {
      const parts = normalizeText(contact.full_name).split(/\s+/).filter(Boolean)
      const { error } = await sb.from("staff").insert({
        organization_id: orgId,
        contact_id: contact.id,
        first_name: parts[0] || "Teacher",
        last_name: parts.slice(1).join(" ") || "",
        department_id: departmentId,
        staff_type: "part_time",
        status: "active",
        pay_basis: "hourly",
      })
      if (error) throw new Error(`staff ${canonical}: ${error.message}`)
    }
  } else if (
    execute &&
    staffRow.department_id !== departmentId &&
    departmentId
  ) {
    await sb
      .from("staff")
      .update({ department_id: departmentId })
      .eq("id", staffRow.id)
  }

  return {
    contact,
    createdContact: !match,
    createdStaff,
    score,
    ambiguous,
  }
}

async function ensureInstructor(sb, orgId, programId, offeringId, contactId, execute) {
  if (String(offeringId).startsWith("dry-run:") || String(contactId).startsWith("dry-run:")) {
    return { created: true }
  }
  const { data: existing } = await sb
    .from("program_staff_assignments")
    .select("id, contact_id, is_active, assignment_role")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("assignment_role", "primary_instructor")
    .is("session_id", null)

  const mine = (existing || []).find((row) => row.contact_id === contactId)
  const others = (existing || []).filter(
    (row) => row.contact_id !== contactId && row.is_active
  )
  if (existing && others.length === 0 && mine?.is_active) {
    return { created: false }
  }
  if (!execute) return { created: !mine }

  for (const row of others) {
    await sb
      .from("program_staff_assignments")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", row.id)
  }

  if (mine) {
    if (!mine.is_active) {
      await sb
        .from("program_staff_assignments")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", mine.id)
    }
    return { created: false }
  }

  const { error } = await sb.from("program_staff_assignments").insert({
    organization_id: orgId,
    program_id: programId,
    offering_id: offeringId,
    contact_id: contactId,
    assignment_role: "primary_instructor",
    is_active: true,
    notes: IMPORT_TAG,
  })
  if (error) throw new Error(`assign instructor: ${error.message}`)
  return { created: true }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const rows = loadRows(args.file)
  const unmapped = rows.filter((row) => !row.offeringSpec)
  if (unmapped.length) {
    console.error("Unmapped offerings:")
    for (const row of unmapped) console.error(`  ${row.offeringRaw}`)
    throw new Error("Fix OFFERING_MAP before importing.")
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: department } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", args.orgId)
    .ilike("name", "Quran Institute for Ladies")
    .maybeSingle()
  if (!department) throw new Error("QIL department not found")

  const { data: program } = await sb
    .from("programs")
    .select("id, name, status, start_date, end_date, department_id")
    .eq("organization_id", args.orgId)
    .eq("department_id", department.id)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()
  if (!program) throw new Error(`Program not found: ${PROGRAM_NAME}`)

  const contacts = await fetchAll(sb, "contacts", "id, full_name, email, phone", [
    { op: "eq", col: "organization_id", val: args.orgId },
    { op: "eq", col: "contact_type", val: "individual" },
  ])
  const existingApps = await fetchAll(
    sb,
    "program_applications",
    "id, offering_id, registrant_contact_id, participant_name, status, enrollment_id, evaluation_notes",
    [
      { op: "eq", col: "organization_id", val: args.orgId },
      { op: "eq", col: "program_id", val: program.id },
    ]
  )
  const priorEnrollments = await fetchAll(
    sb,
    "program_enrollments",
    "participant_contact_id",
    [
      { op: "eq", col: "organization_id", val: args.orgId },
      { op: "eq", col: "program_id", val: PRIOR_PROGRAM_ID },
    ]
  )
  const priorIds = new Set(
    priorEnrollments.map((row) => row.participant_contact_id).filter(Boolean)
  )
  const offeringsForProgram = await fetchAll(
    sb,
    "program_offerings",
    "id, name, delivery_format",
    [
      { op: "eq", col: "organization_id", val: args.orgId },
      { op: "eq", col: "program_id", val: program.id },
    ]
  )
  const offeringNameById = new Map(
    offeringsForProgram.map((row) => [row.id, foldName(row.name)])
  )
  const qilContactIds = new Set(
    existingApps.map((app) => app.registrant_contact_id).filter(Boolean)
  )
  const preferredContacts = contacts.filter((c) => qilContactIds.has(c.id))
  const otherContacts = contacts.filter((c) => !qilContactIds.has(c.id))

  console.log(`File: ${args.file}`)
  console.log(`Rows: ${rows.length}`)
  console.log(`Department: ${department.name}`)
  console.log(`Program: ${program.name} [${program.status}]`)
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)

  const offeringCache = new Map()
  const teacherCache = new Map()
  const createdOfferings = []
  const renamedOfferings = []
  const createdTeachers = []
  const matched = []
  const createdStudents = []
  const ambiguous = []
  const toInsert = []
  const toApprove = []
  const skipped = []
  const seen = new Set()

  for (const row of rows) {
    const { offering, created, renamed } = await ensureOffering(
      sb,
      args.orgId,
      program,
      row.offeringSpec,
      args.execute,
      offeringCache
    )
    if (created) createdOfferings.push(offering)
    if (renamed) renamedOfferings.push(offering)

    const teacherKey = foldName(row.teacherRaw)
    if (!teacherCache.has(teacherKey)) {
      teacherCache.set(
        teacherKey,
        await ensureTeacher(
          sb,
          args.orgId,
          department.id,
          row.teacherRaw,
          contacts,
          args.execute
        )
      )
    }
    const teacher = teacherCache.get(teacherKey)
    if (teacher.createdContact || teacher.createdStaff) {
      createdTeachers.push({
        excel: row.teacherRaw,
        canonical: teacher.contact.full_name,
        createdContact: teacher.createdContact,
        createdStaff: teacher.createdStaff,
      })
    }
    await ensureInstructor(
      sb,
      args.orgId,
      program.id,
      offering.id,
      teacher.contact.id,
      args.execute
    )

    const preferredHit = pickBestContact(row.studentName, preferredContacts)
    const fallbackHit =
      preferredHit.match || preferredHit.ambiguous.length
        ? preferredHit
        : pickBestContact(row.studentName, otherContacts)
    const hit = preferredHit.match ? preferredHit : fallbackHit

    if (hit.ambiguous.length && !hit.match) {
      ambiguous.push({
        rowNumber: row.rowNumber,
        excel: row.studentName,
        offering: row.offeringSpec.name,
        candidates: hit.ambiguous.map((item) => ({
          name: item.contact.full_name,
          score: item.score,
          email: item.contact.email,
        })),
      })
      continue
    }

    let contact = hit.match
    let createdContact = false
    if (!contact) {
      createdContact = true
      if (args.execute) {
        const { data, error } = await sb
          .from("contacts")
          .insert({
            organization_id: args.orgId,
            full_name: row.studentName,
            contact_type: "individual",
            status: "active",
          })
          .select("id, full_name, email, phone")
          .single()
        if (error) throw new Error(`student ${row.studentName}: ${error.message}`)
        contact = data
        contacts.push(contact)
      } else {
        contact = {
          id: `dry-run:student:${foldName(row.studentName)}`,
          full_name: row.studentName,
          email: null,
        }
      }
      createdStudents.push({
        excel: row.studentName,
        offering: row.offeringSpec.name,
      })
    } else {
      matched.push({
        excel: row.studentName,
        matched: contact.full_name,
        score: hit.score,
        offering: row.offeringSpec.name,
      })
    }

    const existingForPerson = existingApps.filter(
      (app) => app.registrant_contact_id === contact.id
    )
    const targetOfferingName = foldName(row.offeringSpec.name)
    const existingApp = existingForPerson.find((app) => {
      if (app.offering_id === offering.id) return true
      const existingName = offeringNameById.get(app.offering_id)
      if (!existingName) return false
      if (existingName === targetOfferingName) return true
      if (
        row.offeringSpec.fromName &&
        existingName === foldName(row.offeringSpec.fromName)
      ) {
        return true
      }
      return false
    })
    const dedupeKey = `${contact.id}::${offering.id}`
    if (seen.has(dedupeKey) || (existingApp && existingApp.status === "approved")) {
      skipped.push({
        rowNumber: row.rowNumber,
        name: row.studentName,
        matched: contact.full_name,
        offering: row.offeringSpec.name,
        reason: seen.has(dedupeKey)
          ? "duplicate row in file"
          : "already approved for this offering",
      })
      seen.add(dedupeKey)
      continue
    }
    seen.add(dedupeKey)

    if (existingApp && existingApp.status !== "approved") {
      toApprove.push({
        id: existingApp.id,
        name: contact.full_name,
        fromStatus: existingApp.status,
        offering: row.offeringSpec.name,
      })
      continue
    }

    const applicantType =
      priorIds.has(contact.id) || existingForPerson.length > 0 ? "returning" : "new"
    toInsert.push({
      organization_id: args.orgId,
      program_id: program.id,
      offering_id: offering.id,
      approved_offering_id: String(offering.id).startsWith("dry-run:")
        ? null
        : offering.id,
      registrant_contact_id: String(contact.id).startsWith("dry-run:")
        ? null
        : contact.id,
      participant_contact_id: String(contact.id).startsWith("dry-run:")
        ? null
        : contact.id,
      participant_name: contact.full_name || row.studentName,
      applicant_type: applicantType,
      status: "approved",
      source: "staff",
      evaluation_notes: `${IMPORT_TAG} | Excel: ${row.studentName} | ${row.offeringRaw} | Teacher: ${row.teacherRaw}`,
      evaluated_at: new Date().toISOString(),
      excelName: row.studentName,
      offeringName: row.offeringSpec.name,
      teacher: row.teacherRaw,
    })
  }

  const uniqueCreatedOfferings = [
    ...new Map(createdOfferings.map((o) => [`${o.name}::${o.delivery_format}`, o])).values(),
  ]
  const uniqueCreatedTeachers = [
    ...new Map(createdTeachers.map((t) => [foldName(t.canonical), t])).values(),
  ]

  console.log(`\nOfferings created: ${uniqueCreatedOfferings.length}`)
  for (const o of uniqueCreatedOfferings) {
    console.log(`  + ${o.name} [${o.delivery_format}]`)
  }
  console.log(`Offerings renamed: ${renamedOfferings.length}`)
  for (const o of renamedOfferings) console.log(`  ~ ${o.name}`)
  console.log(`Teachers added: ${uniqueCreatedTeachers.length}`)
  for (const t of uniqueCreatedTeachers) {
    console.log(`  + ${t.excel} → ${t.canonical}`)
  }
  console.log(`Students matched: ${matched.length}`)
  console.log(`Students created: ${createdStudents.length}`)
  console.log(`Ambiguous names (skipped): ${ambiguous.length}`)
  console.log(`Existing apps to approve: ${toApprove.length}`)
  console.log(`New approved apps: ${toInsert.length}`)
  console.log(`Already present / skipped: ${skipped.length}`)

  if (ambiguous.length) {
    console.log("\nAmbiguous (needs review):")
    for (const row of ambiguous) {
      console.log(
        `  ${row.excel} / ${row.offering} → ${row.candidates
          .map((c) => `${c.name} (${c.score})`)
          .join("; ")}`
      )
    }
  }
  if (createdStudents.length) {
    console.log("\nNew student contacts:")
    for (const row of createdStudents) {
      console.log(`  + ${row.excel} (${row.offering})`)
    }
  }

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(
    reportDir,
    `qil-2026-2027-approved-${args.execute ? "execute" : "dry-run"}.json`
  )
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        importTag: IMPORT_TAG,
        execute: args.execute,
        file: args.file,
        counts: {
          rows: rows.length,
          matched: matched.length,
          createdStudents: createdStudents.length,
          ambiguous: ambiguous.length,
          toApprove: toApprove.length,
          toInsert: toInsert.length,
          skipped: skipped.length,
          offeringsCreated: uniqueCreatedOfferings.length,
          teachersAdded: uniqueCreatedTeachers.length,
        },
        createdOfferings: uniqueCreatedOfferings,
        renamedOfferings,
        createdTeachers: uniqueCreatedTeachers,
        ambiguous,
        createdStudents,
        matched: matched.slice(0, 80),
        toApprove,
        toInsert: toInsert.map((row) => ({
          name: row.participant_name,
          excelName: row.excelName,
          offering: row.offeringName,
          teacher: row.teacher,
          applicant_type: row.applicant_type,
        })),
        skipped: skipped.slice(0, 40),
      },
      null,
      2
    )
  )
  console.log(`\nReport: ${reportPath}`)

  if (!args.execute) {
    console.log("\nDry-run complete. Re-run with --execute to write.")
    return
  }

  if (toApprove.length) {
    const now = new Date().toISOString()
    for (const row of toApprove) {
      const { error } = await sb
        .from("program_applications")
        .update({
          status: "approved",
          approved_offering_id: existingApps.find((app) => app.id === row.id)
            ?.offering_id,
          evaluated_at: now,
          evaluation_notes: `${IMPORT_TAG} | Approved from finalized roster`,
          updated_at: now,
        })
        .eq("id", row.id)
      if (error) throw new Error(`approve ${row.name}: ${error.message}`)
    }
    console.log(`Approved existing applications: ${toApprove.length}`)
  }

  const batchSize = 40
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize).map((row) => {
      const { excelName: _e, offeringName: _o, teacher: _t, ...payload } = row
      return payload
    })
    const { error } = await sb.from("program_applications").insert(batch)
    if (error) throw new Error(`insert batch ${i}: ${error.message}`)
    inserted += batch.length
    console.log(`Inserted ${inserted}/${toInsert.length}`)
  }

  console.log(`\nDone. Approved roster imported (${inserted} new, ${toApprove.length} updated).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
