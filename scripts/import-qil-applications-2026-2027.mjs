/**
 * Import QIL 2026–2027 Google Form applications into program_applications
 * (Needs review) for year program "Quran Institute for Ladies 2026-2027".
 *
 * Usage (dry-run by default):
 *   node scripts/import-qil-applications-2026-2027.mjs
 *   node scripts/import-qil-applications-2026-2027.mjs --file "C:/Users/danan/Downloads/QIL2026-2027.xlsx"
 *   node scripts/import-qil-applications-2026-2027.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
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

const IMPORT_TAG = "QIL_2026_27_APPS_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_FILE = "c:/Users/danan/Downloads/QIL2026-2027.xlsx"
const DEPARTMENT_ALIASES = [
  "Quran Institute for Ladies",
  "Qur'an Institute for Ladies",
]
const PROGRAM_NAME = "Quran Institute for Ladies 2026-2027"
const PROGRAM_START = "2026-08-17"
const PROGRAM_END = "2027-04-16"

/**
 * Excel course label (normalized) → canonical offering name + delivery.
 * Bare course names (no "In Person") map to online when both formats exist.
 */
const COURSE_MAP = {
  beginner: { name: "Tajweed (Beginner)", delivery_format: "online" },
  "beginner - in person": {
    name: "Tajweed (Beginner)",
    delivery_format: "in_person",
  },
  advanced: { name: "Tajweed (Advanced)", delivery_format: "online" },
  "advanced - in person": {
    name: "Tajweed (Advanced)",
    delivery_format: "in_person",
  },
  osool: { name: "Tajweed (Osool)", delivery_format: "online" },
  "osool - in person": {
    name: "Tajweed (Osool)",
    delivery_format: "in_person",
  },
  "memorization (surat al-baqara)": {
    name: "Memorization (Surat Al-Baqara)",
    delivery_format: "online",
  },
  "memorization (surat al-omran)": {
    name: "Memorization (Surat Al-Omran)",
    delivery_format: "online",
  },
  "memorization 1 - in person": {
    name: "Memorization 1",
    delivery_format: "in_person",
  },
  "memorization 2": {
    name: "Memorization 2",
    delivery_format: "online",
  },
  "mermorization 2": {
    name: "Memorization 2",
    delivery_format: "online",
  },
  "recitation imporovement": {
    name: "Recitation Improvement",
    delivery_format: "online",
  },
  "recitation improvement": {
    name: "Recitation Improvement",
    delivery_format: "online",
  },
  "recitation improvement - in person": {
    name: "Recitation Improvement",
    delivery_format: "in_person",
  },
  "preparing for ijaza": {
    name: "Preparing for Ijaza",
    delivery_format: "online",
  },
  "al-ajurrumiyyah": {
    name: "Al-Ajurrumiyyah",
    delivery_format: "online",
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
    file: DEFAULT_FILE,
    execute: false,
    orgId: DEFAULT_ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--file") args.file = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeCourseKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function parseMoney(value) {
  if (value == null || value === "") return 0
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function formatPhone(value) {
  if (value == null || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  const text = normalizeText(value).replace(/\.0$/, "")
  return text || null
}

function excelTimestampToIso(value) {
  if (!value && value !== 0) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    const d = new Date(
      Date.UTC(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        Math.floor(parsed.S || 0)
      )
    )
    return d.toISOString()
  }
  const text = normalizeText(value)
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  return null
}

function resolveCourse(excelCourse) {
  const key = normalizeCourseKey(excelCourse)
  const mapped = COURSE_MAP[key]
  if (!mapped) return null
  return { excelCourse: normalizeText(excelCourse), ...mapped }
}

function loadApplications(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`)
  const wb = XLSX.readFile(path, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  return rows
    .map((row, index) => {
      const name = normalizeText(row.Name)
      const email = normalizeEmail(row["Email Address"] || row.Email)
      const courseRaw = normalizeText(row.Course)
      const course = resolveCourse(courseRaw)
      const newStudentRaw = normalizeText(row["New Student?"]).toUpperCase()
      return {
        rowNumber: index + 2,
        name,
        email,
        phone: formatPhone(row.Phone),
        applicantType: newStudentRaw === "YES" ? "new" : "returning",
        courseRaw,
        course,
        fee: parseMoney(row.Fee),
        discount: parseMoney(row["Full Payment Discount"]),
        submittedAt: excelTimestampToIso(row.Timestamp),
      }
    })
    .filter((row) => row.name && row.courseRaw)
}

async function findDepartment(sb, orgId) {
  for (const name of DEPARTMENT_ALIASES) {
    const { data } = await sb
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .maybeSingle()
    if (data) return data
  }
  return null
}

async function findProgram(sb, orgId, departmentId) {
  const { data } = await sb
    .from("programs")
    .select("id, name, status, start_date, end_date, department_id")
    .eq("organization_id", orgId)
    .eq("department_id", departmentId)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()
  return data
}

async function ensureOffering(
  sb,
  orgId,
  program,
  course,
  execute,
  cache
) {
  const cacheKey = `${course.name}::${course.delivery_format}`
  if (cache.has(cacheKey)) {
    return { offering: cache.get(cacheKey), created: false }
  }

  const { data: existingRows, error } = await sb
    .from("program_offerings")
    .select("id, name, delivery_format, status, application_required")
    .eq("organization_id", orgId)
    .eq("program_id", program.id)
    .eq("name", course.name)

  if (error) throw new Error(`offering lookup (${course.name}): ${error.message}`)

  const match =
    (existingRows || []).find(
      (row) => (row.delivery_format || "in_person") === course.delivery_format
    ) || null

  if (match) {
    cache.set(cacheKey, match)
    return { offering: match, created: false }
  }

  if (!execute) {
    const placeholder = {
      id: `dry-run:offering:${cacheKey}`,
      name: course.name,
      delivery_format: course.delivery_format,
      status: "active",
      application_required: true,
    }
    cache.set(cacheKey, placeholder)
    return { offering: placeholder, created: true }
  }

  const isOnline = course.delivery_format === "online"
  const { data, error: insertError } = await sb
    .from("program_offerings")
    .insert({
      organization_id: orgId,
      program_id: program.id,
      name: course.name,
      is_default: false,
      offering_type: "academic_year",
      start_date: program.start_date || PROGRAM_START,
      end_date: program.end_date || PROGRAM_END,
      enrollment_open_date: "2026-06-03",
      enrollment_close_date: program.start_date || PROGRAM_START,
      status: "active",
      delivery_format: course.delivery_format,
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
    .select("id, name, delivery_format, status, application_required")
    .single()

  if (insertError || !data) {
    throw new Error(
      `offering create (${course.name}/${course.delivery_format}): ${insertError?.message}`
    )
  }
  cache.set(cacheKey, data)
  return { offering: data, created: true }
}

async function ensureContact(sb, orgId, fullName, email, phone, execute, cache) {
  const cacheKey = email || `name:${normalizeName(fullName)}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  function phoneLast10(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "")
    return digits.length >= 10 ? digits.slice(-10) : ""
  }

  if (email) {
    const { data: byEmail } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .ilike("email", email)
      .maybeSingle()
    if (byEmail) {
      if (execute) {
        const patch = {}
        if (phone && !byEmail.phone) patch.phone = phone
        if (Object.keys(patch).length > 0) {
          await sb.from("contacts").update(patch).eq("id", byEmail.id)
        }
      }
      cache.set(cacheKey, byEmail)
      return byEmail
    }
  }

  const phoneKey = phoneLast10(phone)
  if (phoneKey) {
    const { data: phoneCandidates } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .not("phone", "is", null)
      .limit(5000)
    const byPhone = (phoneCandidates || []).find((c) => {
      const digits = String(c.phone || "").replace(/[^0-9]/g, "")
      const last10 = digits.length >= 10 ? digits.slice(-10) : ""
      return last10 === phoneKey && !/[^\x00-\x7F]/.test(c.full_name || "")
    })
    if (byPhone) {
      if (execute) {
        const patch = {}
        if (email && !byPhone.email) patch.email = email
        if (Object.keys(patch).length > 0) {
          await sb.from("contacts").update(patch).eq("id", byPhone.id)
        }
      }
      cache.set(cacheKey, byPhone)
      return byPhone
    }
  }

  const { data: byName } = await sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", orgId)
    .eq("contact_type", "individual")
    .ilike("full_name", fullName)
    .limit(1)
    .maybeSingle()
  if (byName) {
    cache.set(cacheKey, byName)
    return byName
  }

  if (!execute) {
    const placeholder = {
      id: `dry-run:contact:${cacheKey}`,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
    }
    cache.set(cacheKey, placeholder)
    return placeholder
  }

  const { data, error } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      contact_type: "individual",
      status: "active",
    })
    .select("id, full_name, email, phone")
    .single()
  if (error) throw new Error(`contact create (${fullName}): ${error.message}`)
  cache.set(cacheKey, data)
  return data
}

function importNote(row) {
  const parts = [
    IMPORT_TAG,
    `Excel course: ${row.courseRaw}`,
    `Fee: $${row.fee}`,
  ]
  if (row.discount > 0) parts.push(`Full payment discount: $${row.discount}`)
  return parts.join(" | ")
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const rows = loadApplications(args.file)

  const unmapped = rows.filter((r) => !r.course)
  const missingEmail = rows.filter((r) => !r.email)
  const mapped = rows.filter((r) => r.course)

  const courseCounts = new Map()
  for (const row of mapped) {
    const key = `${row.course.name} (${row.course.delivery_format})`
    courseCounts.set(key, (courseCounts.get(key) || 0) + 1)
  }

  console.log(`File: ${args.file}`)
  console.log(`Rows: ${rows.length}`)
  console.log(`Mapped: ${mapped.length}`)
  console.log(`Unmapped courses: ${unmapped.length}`)
  console.log(`Missing email: ${missingEmail.length}`)
  console.log("Course targets:")
  for (const [name, count] of [...courseCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(`  ${count}\t${name}`)
  }
  if (unmapped.length) {
    const bad = new Map()
    for (const row of unmapped) {
      bad.set(row.courseRaw, (bad.get(row.courseRaw) || 0) + 1)
    }
    console.log("Unmapped labels:")
    for (const [label, count] of bad) console.log(`  ${count}\t${label}`)
  }

  if (unmapped.length > 0) {
    console.error("\nAborting: fix COURSE_MAP for unmapped labels before import.")
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const department = await findDepartment(sb, args.orgId)
  if (!department) throw new Error("QIL department not found")
  const program = await findProgram(sb, args.orgId, department.id)
  if (!program) throw new Error(`Program not found: ${PROGRAM_NAME}`)
  if (program.status === "closed") {
    throw new Error(`Program ${PROGRAM_NAME} is closed; reopen before importing applications.`)
  }

  console.log(`\nDepartment: ${department.name} (${department.id})`)
  console.log(`Program: ${program.name} [${program.status}] (${program.id})`)
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)

  const { data: existingApps } = await sb
    .from("program_applications")
    .select("id, offering_id, registrant_contact_id, participant_name, status, evaluation_notes")
    .eq("organization_id", args.orgId)
    .eq("program_id", program.id)

  const alreadyTagged = (existingApps || []).filter((app) =>
    String(app.evaluation_notes || "").includes(IMPORT_TAG)
  )
  console.log(`Existing apps on year: ${(existingApps || []).length}`)
  console.log(`Already tagged ${IMPORT_TAG}: ${alreadyTagged.length}`)

  const offeringCache = new Map()
  const contactCache = new Map()
  const offeringsCreated = []
  const toInsert = []
  const skipped = []

  // Build contact email → existing app offering set for idempotency
  const contactIds = [
    ...new Set(
      (existingApps || [])
        .map((a) => a.registrant_contact_id)
        .filter(Boolean)
    ),
  ]
  const emailByContactId = new Map()
  if (contactIds.length) {
    const { data: contacts } = await sb
      .from("contacts")
      .select("id, email")
      .in("id", contactIds)
    for (const c of contacts || []) {
      if (c.email) emailByContactId.set(c.id, normalizeEmail(c.email))
    }
  }
  const existingKeys = new Set()
  for (const app of existingApps || []) {
    const email = emailByContactId.get(app.registrant_contact_id) || ""
    if (email && app.offering_id) {
      existingKeys.add(`${email}::${app.offering_id}`)
    }
  }

  for (const row of mapped) {
    const { offering, created } = await ensureOffering(
      sb,
      args.orgId,
      program,
      row.course,
      args.execute,
      offeringCache
    )
    if (created) {
      offeringsCreated.push({
        name: row.course.name,
        delivery_format: row.course.delivery_format,
        id: offering.id,
      })
    }

    const contact = await ensureContact(
      sb,
      args.orgId,
      row.name,
      row.email,
      row.phone,
      args.execute,
      contactCache
    )

    const dedupeKey = `${row.email}::${offering.id}`
    if (existingKeys.has(dedupeKey)) {
      skipped.push({
        rowNumber: row.rowNumber,
        name: row.name,
        email: row.email,
        course: `${row.course.name} (${row.course.delivery_format})`,
        reason: "existing application for contact+offering",
      })
      continue
    }

    // Also skip within-file duplicates after first
    if (toInsert.some((item) => item.dedupeKey === dedupeKey)) {
      skipped.push({
        rowNumber: row.rowNumber,
        name: row.name,
        email: row.email,
        course: `${row.course.name} (${row.course.delivery_format})`,
        reason: "duplicate row in file",
      })
      continue
    }

    const submittedAt = row.submittedAt || new Date().toISOString()
    const displayName =
      contact.full_name && !/[^\x00-\x7F]/.test(contact.full_name)
        ? contact.full_name
        : row.name
    toInsert.push({
      dedupeKey,
      rowNumber: row.rowNumber,
      organization_id: args.orgId,
      program_id: program.id,
      offering_id: offering.id,
      registrant_contact_id: contact.id,
      participant_contact_id: contact.id,
      participant_name: displayName,
      applicant_type: row.applicantType,
      status: "submitted",
      source: "staff",
      evaluation_notes: importNote(row),
      created_at: submittedAt,
      updated_at: submittedAt,
      courseLabel: `${row.course.name} (${row.course.delivery_format})`,
      email: row.email,
    })
    existingKeys.add(dedupeKey)
  }

  const uniqueOfferingsCreated = [
    ...new Map(
      offeringsCreated.map((o) => [`${o.name}::${o.delivery_format}`, o])
    ).values(),
  ]

  console.log(`\nOfferings to create: ${uniqueOfferingsCreated.length}`)
  for (const o of uniqueOfferingsCreated) {
    console.log(`  + ${o.name} [${o.delivery_format}]`)
  }
  console.log(`Applications to insert: ${toInsert.length}`)
  console.log(`Skipped: ${skipped.length}`)
  if (skipped.length) {
    console.log("Skip sample:", skipped.slice(0, 10))
  }

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(
    reportDir,
    `qil-2026-2027-applications-${args.execute ? "execute" : "dry-run"}.json`
  )
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        importTag: IMPORT_TAG,
        execute: args.execute,
        file: args.file,
        programId: program.id,
        counts: {
          rows: rows.length,
          toInsert: toInsert.length,
          skipped: skipped.length,
          offeringsCreated: uniqueOfferingsCreated.length,
        },
        offeringsCreated: uniqueOfferingsCreated,
        skipped,
        sampleInserts: toInsert.slice(0, 20).map((r) => ({
          rowNumber: r.rowNumber,
          name: r.participant_name,
          email: r.email,
          course: r.courseLabel,
          applicant_type: r.applicant_type,
          created_at: r.created_at,
        })),
      },
      null,
      2
    )
  )
  console.log(`Report: ${reportPath}`)

  if (!args.execute) {
    console.log("\nDry-run complete. Re-run with --execute to write.")
    return
  }

  // Insert in batches
  const batchSize = 50
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize).map((row) => {
      const {
        dedupeKey: _d,
        rowNumber: _r,
        courseLabel: _c,
        email: _e,
        ...payload
      } = row
      return payload
    })
    const { error } = await sb.from("program_applications").insert(batch)
    if (error) throw new Error(`application insert batch ${i}: ${error.message}`)
    inserted += batch.length
    console.log(`Inserted ${inserted}/${toInsert.length}`)
  }

  console.log(`\nDone. Inserted ${inserted} applications (status=submitted).`)
  console.log("They should appear under Participants → Needs review.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
