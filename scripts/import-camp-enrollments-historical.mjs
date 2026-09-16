/**
 * Import historical Recreational Camps enrollments from
 * Camp_Enrollment_Growth.xlsx (Registrations sheet).
 *
 * People + enrollments + household contacts only (no charges).
 * Skips 2026 Summer Camp One/Two — those already live on operational
 * Summer Camp 2026 (Camp 1 / Camp 2 are session weeks).
 *
 * Usage (dry-run by default):
 *   node scripts/import-camp-enrollments-historical.mjs
 *   node scripts/import-camp-enrollments-historical.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 * After execute, fold households with:
 *   node scripts/sync-summer-camp-households.mjs --all-parents --execute
 */
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "CAMP_HISTORICAL_V1"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEPT_NAME = "Recreational Camps"
const DEFAULT_XLSX = "C:/Users/danan/Downloads/Camp_Enrollment_Growth.xlsx"

const SKIP_EXCEL_NAMES = new Set([
  "2026 MAS Summer Camp One (June)",
  "2026 MAS Summer Camp Two (6/29 - 7/23)",
])

const PROGRAM_SPECS = [
  {
    excel: ["Fall Camp 2022"],
    name: "Fall Camp 2022",
    start: "2022-11-21",
    end: "2022-11-24",
  },
  {
    excel: ["Summer Camp 22: On the Shoulders of the Giants"],
    name: "Summer Camp 1 2022",
    start: "2022-06-06",
    end: "2022-06-30",
  },
  {
    excel: [
      "Summer Camp 22: On the Shoulders of the Giants(July)",
      "Summer Camp 22: On the Shoulders of the Giants  2 (Copied)",
    ],
    name: "Summer Camp 2 2022",
    start: "2022-07-05",
    end: "2022-07-28",
  },
  {
    excel: ["Winter Camp 2022"],
    name: "Winter Camp 2022",
    start: "2022-12-26",
    end: "2022-12-30",
  },
  {
    excel: ["Fall Camp"],
    name: "Fall Camp 2023",
    start: "2023-11-20",
    end: "2023-11-23",
  },
  {
    excel: ['Spring Camp  Spring into Ramadan" 3/6/23 - 3/9/23"'],
    name: "Spring Camp Week 1 2023",
    start: "2023-03-06",
    end: "2023-03-09",
  },
  {
    excel: ['Spring Camp  Spring into Ramadan" 3/13/23 - 3/16/23"'],
    name: "Spring Camp Week 2 2023",
    start: "2023-03-13",
    end: "2023-03-16",
  },
  {
    excel: ["MAS Summer-2023 Camp1 (June): Busy Bees"],
    name: "Summer Camp 1 2023",
    start: "2023-06-05",
    end: "2023-06-29",
  },
  {
    excel: ["MAS Summer-2023 Camp2 (JULY): Busy Bees"],
    name: "Summer Camp 2 2023",
    start: "2023-07-03",
    end: "2023-07-27",
  },
  {
    excel: ["MAS Fall Camp 2024"],
    name: "Fall Camp October 2024",
    start: "2024-10-14",
    end: "2024-10-17",
  },
  {
    excel: ["MAS Fall Camp November 2024"],
    name: "Fall Camp November 2024",
    start: "2024-11-25",
    end: "2024-11-28",
  },
  {
    excel: ["RIJAAL Overnight Camp"],
    name: "RIJAAL Overnight Camp 2024",
    start: "2024-07-18",
    end: "2024-07-19",
  },
  {
    excel: ["2024 Ramadan Spring Camp"],
    name: "Spring Camp 2024",
    start: "2024-03-11",
    end: "2024-03-14",
  },
  {
    excel: ["2024 MAS Summer- Camp 1 (June)"],
    name: "Summer Camp 1 2024",
    start: "2024-06-03",
    end: "2024-06-27",
  },
  {
    excel: ["2024 MAS Summer- Camp 2 (July)"],
    name: "Summer Camp 2 2024",
    start: "2024-07-01",
    end: "2024-07-25",
  },
  {
    excel: ["Winter Camp"],
    name: "Winter Break Camp 2024",
    start: "2023-12-26",
    end: "2024-01-03",
  },
  {
    excel: ["Winter Camp - Ready, Set, Pray"],
    name: "Winter Camp Ready Set Pray 2024",
    start: "2024-12-23",
    end: "2025-01-01",
  },
  {
    excel: ["Fall Camp 2025 (November 24 - 27)"],
    name: "Fall Camp 2025",
    start: "2025-11-24",
    end: "2025-11-27",
  },
  {
    excel: ["Spring Camp"],
    name: "Spring Camp 2025",
    start: "2025-03-10",
    end: "2025-03-13",
  },
  {
    excel: ["2025 MAS Summer - Camp 1 (June)"],
    name: "Summer Camp 1 2025",
    start: "2025-06-02",
    end: "2025-06-26",
  },
  {
    excel: ["2025 MAS Summer - Camp 2 (July)"],
    name: "Summer Camp 2 2025",
    start: "2025-06-30",
    end: "2025-07-24",
  },
  {
    excel: ["2nd Annual Youth Intensive Summer Camp 2025"],
    name: "Youth Intensive 2025",
    start: "2025-06-09",
    end: "2025-06-13",
  },
  {
    excel: ["Winter Camp 2025 (Dec 22nd - Jan 1st)"],
    name: "Winter Camp 2025",
    start: "2025-12-22",
    end: "2026-01-01",
  },
  {
    excel: ["3rd Annual Youth Intensive Summer Camp 2026"],
    name: "Youth Intensive 2026",
    start: "2026-06-08",
    end: "2026-06-12",
  },
  {
    excel: ["Special Needs Summer Camp"],
    name: "Special Needs Summer Camp 2026",
    start: "2026-06-02",
    end: "2026-06-12",
  },
]

const SPEC_BY_EXCEL = new Map()
for (const spec of PROGRAM_SPECS) {
  for (const excelName of spec.excel) {
    SPEC_BY_EXCEL.set(excelName, spec)
  }
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

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  return process.argv[idx + 1] || null
}

function norm(value) {
  return String(value ?? "").trim()
}

function normName(value) {
  return norm(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normEmail(value) {
  const raw = norm(value).toLowerCase()
  if (!raw || raw === "undefined" || !raw.includes("@")) return null
  return raw
}

function digitsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  if (digits.length === 10) return digits
  return digits.length >= 10 ? digits.slice(-10) : null
}

function formatPhone(digits) {
  if (!digits || digits.length !== 10) return null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function splitName(fullName) {
  const parts = norm(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "Participant", last: "Student" }
  if (parts.length === 1) return { first: parts[0], last: "Participant" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

function excelDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000
    return new Date(utc).toISOString().slice(0, 10)
  }
  const text = norm(value)
  if (!text) return null
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function offeringTypeFor(name) {
  return /\bsummer\b|\byouth intensive\b|\bspecial needs\b/i.test(name)
    ? "summer"
    : "season"
}

function importKey(row) {
  return createHash("sha256")
    .update(
      [
        IMPORT_TAG,
        row.programName,
        normName(row.memberName),
        normName(row.parentName),
        row.parentEmail || "",
      ].join("|")
    )
    .digest("hex")
    .slice(0, 24)
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function loadPhoneIndex(sb) {
  const index = new Map()
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, person_id")
      .eq("organization_id", ORG_ID)
      .not("phone", "is", null)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`phone index: ${error.message}`)
    const rows = data || []
    for (const contact of rows) {
      const digits = digitsPhone(contact.phone)
      if (digits && !index.has(digits)) index.set(digits, contact)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return index
}

async function loadEmailIndex(sb) {
  const index = new Map()
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, person_id")
      .eq("organization_id", ORG_ID)
      .not("email", "is", null)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`email index: ${error.message}`)
    const rows = data || []
    for (const contact of rows) {
      const email = normEmail(contact.email)
      if (email && !index.has(email)) index.set(email, contact)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return index
}

async function ensureDepartment(sb) {
  const { data: existing } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .ilike("name", DEPT_NAME)
    .maybeSingle()
  if (!existing) throw new Error(`Department not found: ${DEPT_NAME}`)
  return existing
}

async function ensureProgram(sb, spec, departmentId, execute) {
  const { data: existing } = await sb
    .from("programs")
    .select("id, name, start_date, end_date, department_id, status")
    .eq("organization_id", ORG_ID)
    .eq("department_id", departmentId)
    .eq("name", spec.name)
    .maybeSingle()
  if (existing) return { ...existing, created: false }
  if (!execute) {
    return {
      id: `dry-run:program:${spec.name}`,
      name: spec.name,
      start_date: spec.start,
      end_date: spec.end,
      department_id: departmentId,
      status: "closed",
      created: true,
    }
  }
  const data = await must(
    `program ${spec.name}`,
    sb
      .from("programs")
      .insert({
        organization_id: ORG_ID,
        department_id: departmentId,
        name: spec.name,
        description: `Historical camp imported ${IMPORT_TAG}`,
        start_date: spec.start,
        end_date: spec.end,
        enrollment_open_date: spec.start,
        enrollment_close_date: spec.end,
        program_type: "youth",
        program_kind: "seasonal",
        gender: null,
        capacity: 0,
        enrolled: 0,
        waitlist: 0,
        status: "closed",
        visibility: "private",
        billing_type: "free",
        full_program_registration_enabled: true,
        session_registration_enabled: false,
        require_guardian: true,
        enrollment_process: "direct_registration",
        seat_activation_rule: "on_registration",
      })
      .select("id, name, start_date, end_date, department_id, status")
      .single()
  )
  return { ...data, created: true }
}

async function ensureDefaultOffering(sb, program, execute) {
  const offeringName = program.name
  const { data: existing } = await sb
    .from("program_offerings")
    .select("id, name, program_id")
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)
    .eq("name", offeringName)
    .maybeSingle()
  if (existing) return { ...existing, created: false }
  if (!execute) {
    return {
      id: `dry-run:offering:${program.id}`,
      name: offeringName,
      program_id: program.id,
      created: true,
    }
  }
  const data = await must(
    `offering ${offeringName}`,
    sb
      .from("program_offerings")
      .insert({
        organization_id: ORG_ID,
        program_id: program.id,
        name: offeringName,
        is_default: true,
        offering_type: offeringTypeFor(program.name),
        audience_type: "youth",
        start_date: program.start_date,
        end_date: program.end_date,
        enrollment_open_date: program.start_date,
        enrollment_close_date: program.end_date,
        status: "closed",
        require_guardian: true,
        application_required: false,
        inherit_dates: true,
        inherit_eligibility: true,
        inherit_enrollment: true,
      })
      .select("id, name, program_id")
      .single()
  )
  return { ...data, created: true }
}

async function ensureParentContact(
  sb,
  parent,
  execute,
  cache,
  phoneIndex,
  emailIndex,
  report
) {
  const email = parent.email
  const phoneDigits = digitsPhone(parent.phone)
  const cacheKey = email
    ? `email:${email}`
    : phoneDigits
      ? `phone:${phoneDigits}`
      : `name:${normName(parent.name || "Parent")}`
  if (cache.has(cacheKey)) {
    report.reusedContacts += 1
    return cache.get(cacheKey)
  }

  if (email && emailIndex.has(email)) {
    const hit = emailIndex.get(email)
    cache.set(cacheKey, hit)
    if (phoneDigits) phoneIndex.set(phoneDigits, hit)
    report.reusedContacts += 1
    return hit
  }

  if (phoneDigits && phoneIndex.has(phoneDigits)) {
    const hit = phoneIndex.get(phoneDigits)
    cache.set(cacheKey, hit)
    if (email) emailIndex.set(email, hit)
    report.reusedContacts += 1
    return hit
  }

  const fullName = norm(parent.name) || "Camp Parent"
  if (!execute) {
    const placeholder = {
      id: `dry-run:contact:${cacheKey}`,
      full_name: fullName,
      email: email || null,
      phone: formatPhone(phoneDigits) || parent.phone || null,
      person_id: null,
    }
    cache.set(cacheKey, placeholder)
    if (email) emailIndex.set(email, placeholder)
    if (phoneDigits) phoneIndex.set(phoneDigits, placeholder)
    report.createdContacts += 1
    return placeholder
  }

  const { data: contactId, error: rpcError } = await sb.rpc(
    "find_or_create_contact_for_org",
    {
      p_organization_id: ORG_ID,
      p_full_name: fullName,
      p_email: email || null,
      p_phone: formatPhone(phoneDigits) || parent.phone || null,
      p_contact_type: "individual",
    }
  )
  if (rpcError) throw new Error(`find_or_create_contact: ${rpcError.message}`)

  const contact = await must(
    "reload contact",
    sb
      .from("contacts")
      .select("id, full_name, email, phone, person_id")
      .eq("id", contactId)
      .single()
  )

  const patch = {}
  if (email && !normEmail(contact.email)) patch.email = email
  if (phoneDigits && !digitsPhone(contact.phone)) {
    patch.phone = formatPhone(phoneDigits)
  }
  if (fullName && (!contact.full_name || /^parent of /i.test(contact.full_name))) {
    patch.full_name = fullName
  }
  if (Object.keys(patch).length > 0) {
    await sb
      .from("contacts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", contact.id)
      .eq("organization_id", ORG_ID)
    Object.assign(contact, patch)
  }

  report.createdContacts += 1
  cache.set(cacheKey, contact)
  if (email) emailIndex.set(email, contact)
  if (phoneDigits) phoneIndex.set(phoneDigits, contact)
  return contact
}

async function ensureParentPerson(sb, contact, execute) {
  if (contact.person_id) return contact.person_id
  if (!execute || String(contact.id).startsWith("dry-run:")) {
    return `dry-run:person:${contact.id}`
  }
  const { first, last } = splitName(contact.full_name)
  const created = await must(
    "parent person",
    sb
      .from("people")
      .insert({
        organization_id: ORG_ID,
        first_name: first,
        last_name: last,
        person_type: "contact",
        email: contact.email || null,
        phone: contact.phone || null,
      })
      .select("id")
      .single()
  )
  await must(
    "link parent person",
    sb
      .from("contacts")
      .update({ person_id: created.id, updated_at: new Date().toISOString() })
      .eq("id", contact.id)
      .eq("organization_id", ORG_ID)
  )
  contact.person_id = created.id
  return created.id
}

async function ensureChildPerson(sb, child, parentPersonId, execute, childrenByParentName) {
  if (!execute) return { id: `dry-run:child:${normName(child.name)}`, created: true }

  if (parentPersonId && !String(parentPersonId).startsWith("dry-run:")) {
    const { data: rels } = await sb
      .from("person_relationships")
      .select("related_person_id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", parentPersonId)
      .eq("relationship_type", "child")
    const relatedIds = (rels || []).map((r) => r.related_person_id).filter(Boolean)
    if (relatedIds.length > 0) {
      const { data: people } = await sb
        .from("people")
        .select("id, first_name, last_name")
        .eq("organization_id", ORG_ID)
        .in("id", relatedIds)
      for (const person of people || []) {
        const map = childrenByParentName || new Map()
        map.set(
          `${parentPersonId}|${normName(`${person.first_name} ${person.last_name}`)}`,
          { id: person.id, created: false }
        )
      }
      const match = (childrenByParentName || new Map()).get(
        `${parentPersonId}|${normName(child.name)}`
      )
      if (match) return match
    }
  }

  const { first, last } = splitName(child.name)
  const created = await must(
    "child person",
    sb
      .from("people")
      .insert({
        organization_id: ORG_ID,
        first_name: first,
        last_name: last,
        person_type: "participant",
      })
      .select("id")
      .single()
  )

  if (parentPersonId && !String(parentPersonId).startsWith("dry-run:")) {
    const { data: existingRel } = await sb
      .from("person_relationships")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", parentPersonId)
      .eq("related_person_id", created.id)
      .maybeSingle()
    if (!existingRel) {
      await sb.from("person_relationships").insert({
        organization_id: ORG_ID,
        person_id: parentPersonId,
        related_person_id: created.id,
        relationship_type: "child",
      })
    }
  }

  return { id: created.id, created: true }
}

function bump(report, programName, field) {
  if (!report.byProgram[programName]) {
    report.byProgram[programName] = { rows: 0, enrolled: 0, skipped: 0 }
  }
  report.byProgram[programName][field] += 1
}

async function mapPool(items, limit, worker) {
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = items[index++]
      await worker(current)
    }
  }
  const n = Math.max(1, Math.min(limit, items.length || 1))
  await Promise.all(Array.from({ length: n }, run))
}

function withLock(locks, key, fn) {
  const previous = locks.get(key) || Promise.resolve()
  const next = previous.then(fn, fn)
  locks.set(
    key,
    next.then(
      () => undefined,
      () => undefined
    )
  )
  return next
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const xlsxPath = argValue("--xlsx") || DEFAULT_XLSX
  if (!existsSync(xlsxPath)) throw new Error(`File not found: ${xlsxPath}`)

  const workbook = XLSX.readFile(xlsxPath, { raw: true })
  const sheet = workbook.Sheets.Registrations || workbook.Sheets[workbook.SheetNames[0]]
  const excelRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const report = {
    mode: execute ? "execute" : "dry-run",
    xlsxPath,
    generatedAt: new Date().toISOString(),
    excelRows: excelRows.length,
    createdPrograms: 0,
    createdOfferings: 0,
    createdContacts: 0,
    reusedContacts: 0,
    createdPeople: 0,
    reusedPeople: 0,
    createdEnrollments: 0,
    skippedExisting: 0,
    skippedDuplicate: 0,
    skippedExistingYear: 0,
    skippedUnmapped: 0,
    skippedNoMember: 0,
    skippedNoParent: 0,
    uniqueParents: 0,
    byProgram: {},
    unmapped: [],
    errors: [],
    samples: [],
  }

  if (
    execute &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const department = await ensureDepartment(sb)
  const programCache = new Map()
  const offeringCache = new Map()
  const contactCache = new Map()
  const phoneIndex = await loadPhoneIndex(sb)
  const emailIndex = await loadEmailIndex(sb)
  console.log(`indexes contacts phone=${phoneIndex.size} email=${emailIndex.size}`)
  const seenKeys = new Set()
  const importedKeys = new Set()
  if (execute) {
    let from = 0
    for (;;) {
      const { data, error } = await sb
        .from("program_enrollments")
        .select("notes")
        .eq("organization_id", ORG_ID)
        .ilike("notes", `%${IMPORT_TAG}%`)
        .range(from, from + 999)
      if (error) throw new Error(`imported keys: ${error.message}`)
      const rows = data || []
      for (const row of rows) {
        const match = String(row.notes || "").match(/Import key:\s*([a-f0-9]+)/i)
        if (match) importedKeys.add(match[1])
      }
      if (rows.length < 1000) break
      from += 1000
    }
    console.log(`already imported keys=${importedKeys.size}`)
  }
  const parentsToSync = new Set()
  const childrenByParentName = new Map()
  const existingChildrenByOffering = new Map()
  const pendingInserts = []
  const programLocks = new Map()
  const BATCH_SIZE = 40

  async function loadExistingChildren(offeringId) {
    if (existingChildrenByOffering.has(offeringId)) {
      return existingChildrenByOffering.get(offeringId)
    }
    const ids = new Set()
    if (String(offeringId).startsWith("dry-run:")) {
      existingChildrenByOffering.set(offeringId, ids)
      return ids
    }
    let from = 0
    for (;;) {
      const { data, error } = await sb
        .from("program_enrollments")
        .select("child_person_id")
        .eq("organization_id", ORG_ID)
        .eq("offering_id", offeringId)
        .not("child_person_id", "is", null)
        .range(from, from + 999)
      if (error) throw new Error(`existing enrollments: ${error.message}`)
      const rows = data || []
      for (const row of rows) ids.add(row.child_person_id)
      if (rows.length < 1000) break
      from += 1000
    }
    existingChildrenByOffering.set(offeringId, ids)
    return ids
  }

  async function flushInserts() {
    if (!execute || pendingInserts.length === 0) return
    const batch = pendingInserts.splice(0, pendingInserts.length)
    const cleaned = batch.map(({ _programName, ...rest }) => rest)
    const { error } = await sb.from("program_enrollments").insert(cleaned)
    if (error) {
      if (/unique constraint|duplicate key/i.test(error.message)) {
        for (const payload of batch) {
          const { _programName, ...rest } = payload
          try {
            await must(
              "enrollment retry",
              sb.from("program_enrollments").insert(rest).select("id").single()
            )
            report.createdEnrollments += 1
            bump(report, payload._programName, "enrolled")
          } catch (err) {
            if (/unique constraint|duplicate key/i.test(String(err.message))) {
              report.skippedExisting += 1
              bump(report, payload._programName, "skipped")
            } else {
              report.errors.push({
                member: payload.child_name,
                program: payload._programName,
                error: err instanceof Error ? err.message : String(err),
              })
              bump(report, payload._programName, "skipped")
            }
          }
        }
        return
      }
      throw new Error(`enrollment batch: ${error.message}`)
    }
    for (const payload of batch) {
      report.createdEnrollments += 1
      bump(report, payload._programName, "enrolled")
    }
  }

  async function getProgramAndOffering(spec) {
    return withLock(programLocks, spec.name, async () => {
      if (programCache.has(spec.name)) {
        return {
          program: programCache.get(spec.name),
          offering: offeringCache.get(spec.name),
        }
      }
      const program = await ensureProgram(sb, spec, department.id, execute)
      if (program.created) report.createdPrograms += 1
      const offering = await ensureDefaultOffering(sb, program, execute)
      if (offering.created) report.createdOfferings += 1
      programCache.set(spec.name, program)
      offeringCache.set(spec.name, offering)
      return { program, offering }
    })
  }

  const jobs = []
  for (const raw of excelRows) {
    const excelProgram = norm(raw["Camp / Program"])
    const memberName = norm(raw["Registered Member"])
    const parentName = norm(raw["Household / Customer"])
    const parentEmail = normEmail(raw["Customer Email"])
    const parentPhone = formatPhone(digitsPhone(raw["Customer Phone"])) || norm(raw["Customer Phone"])
    const registeredAt = excelDate(raw["Registration Date"])

    if (!excelProgram) continue
    if (SKIP_EXCEL_NAMES.has(excelProgram)) {
      report.skippedExistingYear += 1
      continue
    }
    const spec = SPEC_BY_EXCEL.get(excelProgram)
    if (!spec) {
      report.skippedUnmapped += 1
      if (report.unmapped.length < 20) {
        report.unmapped.push(excelProgram)
      }
      continue
    }
    if (!memberName) {
      report.skippedNoMember += 1
      continue
    }
    if (!parentName && !parentEmail) {
      report.skippedNoParent += 1
      continue
    }

    bump(report, spec.name, "rows")
    const row = {
      programName: spec.name,
      memberName,
      parentName,
      parentEmail,
      parentPhone,
      excelProgram,
      registeredAt,
    }
    const key = importKey(row)
    if (seenKeys.has(key)) {
      report.skippedDuplicate += 1
      bump(report, spec.name, "skipped")
      continue
    }
    seenKeys.add(key)
    if (importedKeys.has(key)) {
      report.skippedExisting += 1
      bump(report, spec.name, "skipped")
      continue
    }
    jobs.push({ spec, ...row, key })
  }

  console.log(`jobs to import=${jobs.length}`)
  const parentLocks = new Map()
  let processed = 0

  async function processJob(job) {
    try {
      const { program, offering } = await getProgramAndOffering(job.spec)
      const parentContact = await withLock(
        parentLocks,
        job.parentEmail || job.parentPhone || job.parentName,
        () =>
          ensureParentContact(
            sb,
            {
              name: job.parentName,
              email: job.parentEmail,
              phone: job.parentPhone,
            },
            execute,
            contactCache,
            phoneIndex,
            emailIndex,
            report
          )
      )
      const parentPersonId = await ensureParentPerson(sb, parentContact, execute)
      const childCacheKey = `${parentPersonId}|${normName(job.memberName)}`
      const child = await withLock(parentLocks, `child:${parentPersonId}`, async () => {
        const cached = childrenByParentName.get(childCacheKey)
        if (cached) {
          report.reusedPeople += 1
          return cached
        }
        const created = await ensureChildPerson(
          sb,
          { name: job.memberName },
          parentPersonId,
          execute,
          childrenByParentName
        )
        childrenByParentName.set(childCacheKey, created)
        if (created.created) report.createdPeople += 1
        else report.reusedPeople += 1
        return created
      })

      const notes = [
        `Imported ${IMPORT_TAG}`,
        `Import key: ${job.key}`,
        `Original program: ${job.excelProgram}`,
      ].join("\n")

      if (execute) {
        const existingChildren = await loadExistingChildren(offering.id)
        if (child.id && existingChildren.has(child.id)) {
          report.skippedExisting += 1
          bump(report, job.spec.name, "skipped")
          return
        }
      }

      if (!execute) {
        report.createdEnrollments += 1
        bump(report, job.spec.name, "enrolled")
        return
      }

      pendingInserts.push({
        organization_id: ORG_ID,
        program_id: program.id,
        offering_id: offering.id,
        department_id: program.department_id,
        child_name: job.memberName,
        child_person_id: child.id,
        participant_contact_id: null,
        registrant_contact_id: parentContact.id,
        payer_contact_id: parentContact.id,
        status: "enrolled",
        payment_status: "paid",
        payment_required: false,
        total_amount: 0,
        amount_paid: 0,
        enrollment_date: job.registeredAt || program.start_date,
        participant_type: "youth",
        registrant_type: "guardian",
        parent_name: parentContact.full_name,
        parent_email: parentContact.email || null,
        parent_phone: parentContact.phone || null,
        notes,
        _programName: job.spec.name,
      })
      if (child.id) {
        const existingChildren = existingChildrenByOffering.get(offering.id)
        if (existingChildren) existingChildren.add(child.id)
      }
      if (!String(parentContact.id).startsWith("dry-run:")) {
        parentsToSync.add(parentContact.id)
      }
      if (pendingInserts.length >= BATCH_SIZE) {
        await withLock(parentLocks, "flush-enrollments", flushInserts)
      }
    } catch (err) {
      report.errors.push({
        member: job.memberName,
        program: job.spec.name,
        error: err instanceof Error ? err.message : String(err),
      })
      bump(report, job.spec.name, "skipped")
    } finally {
      processed += 1
      if (processed % 50 === 0 || processed === jobs.length) {
        console.log(
          `progress jobs=${processed}/${jobs.length} enrollments=${report.createdEnrollments} skipped=${report.skippedExisting} errors=${report.errors.length}`
        )
      }
    }
  }

  await mapPool(jobs, execute ? 8 : 1, processJob)
  await flushInserts()

  report.uniqueParents = contactCache.size
  report.programCount = programCache.size

  if (execute) {
    console.log(`affiliation sync parents=${parentsToSync.size}`)
    await mapPool([...parentsToSync], 8, async (contactId) => {
      try {
        await sb.rpc("sync_contact_affiliations", {
          p_organization_id: ORG_ID,
          p_contact_id: contactId,
        })
      } catch (err) {
        console.warn(
          `affiliation sync warn ${contactId}: ${err instanceof Error ? err.message : err}`
        )
      }
    })
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = resolve(
    reportsDir,
    `import-camp-enrollments-${execute ? "execute" : "dry-run"}-${stamp}.json`
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        excelRows: report.excelRows,
        createdPrograms: report.createdPrograms,
        createdOfferings: report.createdOfferings,
        createdContacts: report.createdContacts,
        reusedContacts: report.reusedContacts,
        createdPeople: report.createdPeople,
        reusedPeople: report.reusedPeople,
        createdEnrollments: report.createdEnrollments,
        skippedExistingYear: report.skippedExistingYear,
        skippedExisting: report.skippedExisting,
        skippedDuplicate: report.skippedDuplicate,
        skippedUnmapped: report.skippedUnmapped,
        skippedNoParent: report.skippedNoParent,
        uniqueParents: report.uniqueParents,
        byProgram: report.byProgram,
        unmapped: report.unmapped,
        errors: report.errors.length,
        errorSample: report.errors.slice(0, 8),
        report: outPath,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
