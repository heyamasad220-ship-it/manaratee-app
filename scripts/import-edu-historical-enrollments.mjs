/**
 * Import historical Education (plus Istiqamah Institute) enrollments from:
 *   EducationPrograms.xlsx  — cleaned member rows (program, year, student, parent)
 *   EduPrograms2.csv        — original registrations (parent email / phone)
 *
 * People + enrollments only (no charges). Skips years already in the app,
 * cancelled rows, and fall camps (already omitted from the Excel).
 *
 * Usage (dry-run by default):
 *   node scripts/import-edu-historical-enrollments.mjs
 *   node scripts/import-edu-historical-enrollments.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
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

const IMPORT_TAG = "EDU_HISTORICAL_V1"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_XLSX = "C:/Users/danan/Downloads/EducationPrograms.xlsx"
const DEFAULT_CSV = "C:/Users/danan/Downloads/EduPrograms2.csv"

const EDUCATION_DEPT = "Education"
const ISTIQAMAH_DEPT = "Istiqamah Institute"
const ISTIQAMAH_COLOR = "#0f766e"

const SKIP_PROGRAMS = new Set([
  "QLH 2024-2025",
  "QLH 2025-2026",
  "Sunday School 2026-2027",
])

const YEAR_DATES = {
  "2022-2023": { start: "2022-09-04", end: "2023-05-21" },
  "2023-2024": { start: "2023-09-03", end: "2024-05-19" },
  "2024-2025": { start: "2024-09-03", end: "2025-05-22" },
  "2025-2026": { start: "2025-09-02", end: "2026-05-14" },
  "2026-2027": { start: "2026-09-06", end: "2027-05-16" },
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

function expandReportingYear(value) {
  const text = norm(value)
  const m = /^(\d{4})-(\d{2})$/.exec(text)
  if (!m) return text
  return `${m[1]}-${m[1].slice(0, 2)}${m[2]}`
}

function programNameFor(normalizedProgram, expandedYear) {
  if (normalizedProgram === "Quran 4 Little Hearts") return `QLH ${expandedYear}`
  return `${normalizedProgram} ${expandedYear}`
}

function departmentNameFor(normalizedProgram) {
  return normalizedProgram === "Istiqamah Institute" ? ISTIQAMAH_DEPT : EDUCATION_DEPT
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

function loadSheet(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`)
  const wb = XLSX.readFile(path, { raw: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false })
}

function buildCsvIndex(csvRows) {
  const byCustProg = new Map()
  const byCust = new Map()
  for (const raw of csvRows) {
    const parentName = norm(raw["Customer Name"])
    const program = norm(raw.Program)
    const email = normEmail(raw["Customer Email"])
    const phone = formatPhone(digitsPhone(raw["Customer Phone"]))
    if (!parentName) continue
    const record = { parentName, email, phone, program }
    const key = `${normName(parentName)}||${program}`
    if (!byCustProg.has(key)) byCustProg.set(key, record)
    const nameKey = normName(parentName)
    if (!byCust.has(nameKey)) byCust.set(nameKey, record)
  }
  return { byCustProg, byCust }
}

async function loadPhoneIndex(sb) {
  const index = new Map()
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, person_id, address")
      .eq("organization_id", ORG_ID)
      .not("phone", "is", null)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`phone index: ${error.message}`)
    const rows = data || []
    for (const c of rows) {
      const digits = digitsPhone(c.phone)
      if (digits && !index.has(digits)) index.set(digits, c)
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
      .select("id, full_name, email, phone, person_id, address")
      .eq("organization_id", ORG_ID)
      .not("email", "is", null)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`email index: ${error.message}`)
    const rows = data || []
    for (const c of rows) {
      const email = normEmail(c.email)
      if (email && !index.has(email)) index.set(email, c)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return index
}

async function ensureDepartment(sb, name, execute, extras = {}) {
  const { data: existing } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .ilike("name", name)
    .maybeSingle()
  if (existing) return { ...existing, created: false }
  if (!execute) return { id: `dry-run:dept:${name}`, name, created: true }
  const insert = {
    organization_id: ORG_ID,
    name,
    description: extras.description || null,
    color: extras.color || "#3b82f6",
  }
  const data = await must(
    `department ${name}`,
    sb.from("departments").insert(insert).select("id, name").single()
  )
  return { ...data, created: true }
}

async function ensureProgram(sb, spec, execute) {
  const { data: existing } = await sb
    .from("programs")
    .select("id, name, start_date, end_date, department_id, status")
    .eq("organization_id", ORG_ID)
    .eq("department_id", spec.departmentId)
    .eq("name", spec.name)
    .maybeSingle()
  if (existing) return { ...existing, created: false }
  if (!execute) {
    return {
      id: `dry-run:program:${spec.name}`,
      name: spec.name,
      start_date: spec.start,
      end_date: spec.end,
      department_id: spec.departmentId,
      status: spec.status,
      created: true,
    }
  }
  const data = await must(
    `program ${spec.name}`,
    sb
      .from("programs")
      .insert({
        organization_id: ORG_ID,
        department_id: spec.departmentId,
        name: spec.name,
        description: spec.description,
        start_date: spec.start,
        end_date: spec.end,
        enrollment_open_date: spec.start,
        enrollment_close_date: spec.end,
        program_type: "youth",
        program_kind: "academic",
        gender: null,
        capacity: 0,
        enrolled: 0,
        waitlist: 0,
        status: spec.status,
        visibility: "private",
        billing_type: "free",
        full_program_registration_enabled: true,
        session_registration_enabled: false,
        require_guardian: false,
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
        offering_type: "academic_year",
        audience_type: "youth",
        start_date: program.start_date,
        end_date: program.end_date,
        enrollment_open_date: program.start_date,
        enrollment_close_date: program.end_date,
        status: program.status === "active" ? "active" : "closed",
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

async function ensureParentContact(sb, parent, execute, cache, phoneIndex, emailIndex, report) {
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

  const fullName = norm(parent.name) || "Education Parent"
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

  const { data: contactId, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: ORG_ID,
    p_full_name: fullName,
    p_email: email || null,
    p_phone: formatPhone(phoneDigits) || parent.phone || null,
    p_contact_type: "individual",
  })
  if (rpcError) throw new Error(`find_or_create_contact: ${rpcError.message}`)

  const contact = await must(
    "reload contact",
    sb
      .from("contacts")
      .select("id, full_name, email, phone, person_id, address")
      .eq("id", contactId)
      .single()
  )

  const patch = {}
  if (email && !normEmail(contact.email)) patch.email = email
  if (phoneDigits && !digitsPhone(contact.phone)) patch.phone = formatPhone(phoneDigits)
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

async function ensureChildPerson(sb, child, parentPersonId, execute) {
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
      const match = (people || []).find(
        (p) => normName(`${p.first_name} ${p.last_name}`) === normName(child.name)
      )
      if (match) return { id: match.id, created: false }
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

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const xlsxPath = argValue("--xlsx") || DEFAULT_XLSX
  const csvPath = argValue("--csv") || DEFAULT_CSV

  const excelRows = loadSheet(xlsxPath)
  const csvRows = loadSheet(csvPath)
  const csvIndex = buildCsvIndex(csvRows)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const report = {
    mode: execute ? "execute" : "dry-run",
    xlsxPath,
    csvPath,
    generatedAt: new Date().toISOString(),
    excelRows: excelRows.length,
    csvRows: csvRows.length,
    createdDepartments: 0,
    createdPrograms: 0,
    createdOfferings: 0,
    createdContacts: 0,
    reusedContacts: 0,
    createdPeople: 0,
    reusedPeople: 0,
    createdEnrollments: 0,
    skippedExisting: 0,
    skippedCancelled: 0,
    skippedExistingYear: 0,
    skippedNoParent: 0,
    skippedDuplicate: 0,
    skippedNoMember: 0,
    uniqueParents: 0,
    byProgram: {},
    errors: [],
    samples: [],
  }

  if (execute && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const education = await ensureDepartment(sb, EDUCATION_DEPT, false)
  if (!education?.id || String(education.id).startsWith("dry-run:")) {
    throw new Error(`Department not found: ${EDUCATION_DEPT}`)
  }

  const istiqamah = await ensureDepartment(sb, ISTIQAMAH_DEPT, execute, {
    description: "Istiqamah Institute programs",
    color: ISTIQAMAH_COLOR,
  })
  if (istiqamah.created) report.createdDepartments += 1

  const deptByName = new Map([
    [EDUCATION_DEPT, education],
    [ISTIQAMAH_DEPT, istiqamah],
  ])

  const programCache = new Map()
  const offeringCache = new Map()
  const contactCache = new Map()
  const phoneIndex = await loadPhoneIndex(sb)
  const emailIndex = await loadEmailIndex(sb)
  const seenKeys = new Set()
  const parentsToSync = new Set()

  async function getProgramAndOffering(normalizedProgram, expandedYear) {
    const name = programNameFor(normalizedProgram, expandedYear)
    const cacheKey = name
    if (programCache.has(cacheKey)) {
      return { program: programCache.get(cacheKey), offering: offeringCache.get(cacheKey) }
    }
    const dates = YEAR_DATES[expandedYear]
    if (!dates) throw new Error(`No dates for year ${expandedYear}`)
    const deptName = departmentNameFor(normalizedProgram)
    const dept = deptByName.get(deptName)
    const status = expandedYear === "2026-2027" ? "active" : "closed"
    const program = await ensureProgram(
      sb,
      {
        name,
        departmentId: dept.id,
        start: dates.start,
        end: dates.end,
        status,
        description: `Historical ${normalizedProgram} ${expandedYear} (imported ${IMPORT_TAG})`,
      },
      execute
    )
    if (program.created) report.createdPrograms += 1
    const offering = await ensureDefaultOffering(sb, program, execute)
    if (offering.created) report.createdOfferings += 1
    programCache.set(cacheKey, program)
    offeringCache.set(cacheKey, offering)
    return { program, offering }
  }

  for (const raw of excelRows) {
    const status = norm(raw["Source Status"]).toUpperCase()
    const normalizedProgram = norm(raw.Program)
    const expandedYear = expandReportingYear(raw["Reporting Year"])
    const programName = programNameFor(normalizedProgram, expandedYear)
    const memberName = norm(raw["Registered Member"])
    const parentName = norm(raw["Customer / Account Name"])
    const originalProgram = norm(raw["Original Program Name"])

    if (status === "CANCELLED") {
      report.skippedCancelled += 1
      continue
    }
    if (SKIP_PROGRAMS.has(programName)) {
      report.skippedExistingYear += 1
      continue
    }
    if (!memberName) {
      report.skippedNoMember += 1
      continue
    }

    bump(report, programName, "rows")

    const csvHit =
      csvIndex.byCustProg.get(`${normName(parentName)}||${originalProgram}`) ||
      csvIndex.byCust.get(normName(parentName))
    const parentEmail = csvHit?.email || null
    const parentPhone = csvHit?.phone || null
    if (!parentEmail && !parentPhone && !parentName) {
      report.skippedNoParent += 1
      bump(report, programName, "skipped")
      continue
    }

    const row = {
      programName,
      memberName,
      parentName,
      parentEmail,
      parentPhone,
      originalProgram,
      expandedYear,
      normalizedProgram,
    }
    const key = importKey(row)
    if (seenKeys.has(key)) {
      report.skippedDuplicate += 1
      bump(report, programName, "skipped")
      continue
    }
    seenKeys.add(key)

    try {
      const { program, offering } = await getProgramAndOffering(normalizedProgram, expandedYear)
      const parentContact = await ensureParentContact(
        sb,
        {
          name: parentName,
          email: parentEmail,
          phone: parentPhone,
        },
        execute,
        contactCache,
        phoneIndex,
        emailIndex,
        report
      )
      const parentPersonId = await ensureParentPerson(sb, parentContact, execute)
      const child = await ensureChildPerson(
        sb,
        { name: memberName },
        parentPersonId,
        execute
      )
      if (child.created) report.createdPeople += 1
      else report.reusedPeople += 1

      const notes = [
        `Imported ${IMPORT_TAG}`,
        `Import key: ${key}`,
        `Original program: ${originalProgram}`,
        `Reporting year: ${expandedYear}`,
        `Source status: ${status}`,
      ].join("\n")

      if (execute) {
        const { data: byNotes } = await sb
          .from("program_enrollments")
          .select("id")
          .eq("organization_id", ORG_ID)
          .eq("offering_id", offering.id)
          .ilike("notes", `%Import key: ${key}%`)
          .limit(1)
          .maybeSingle()
        let existing = byNotes
        if (!existing && child.id && !String(child.id).startsWith("dry-run:")) {
          const { data: byChild } = await sb
            .from("program_enrollments")
            .select("id")
            .eq("organization_id", ORG_ID)
            .eq("offering_id", offering.id)
            .eq("child_person_id", child.id)
            .limit(1)
            .maybeSingle()
          existing = byChild
        }
        if (existing?.id) {
          report.skippedExisting += 1
          bump(report, programName, "skipped")
          continue
        }
      }

      if (!execute) {
        report.createdEnrollments += 1
        bump(report, programName, "enrolled")
        if (report.samples.length < 12) {
          report.samples.push({
            program: programName,
            member: memberName,
            parent: parentContact.full_name,
            parentEmail: parentContact.email,
          })
        }
        continue
      }

      const payload = {
        organization_id: ORG_ID,
        program_id: program.id,
        offering_id: offering.id,
        department_id: program.department_id,
        child_name: memberName,
        child_person_id: child.id,
        participant_contact_id: null,
        registrant_contact_id: parentContact.id,
        payer_contact_id: parentContact.id,
        status: "enrolled",
        payment_status: "paid",
        payment_required: false,
        total_amount: 0,
        amount_paid: 0,
        enrollment_date: program.start_date,
        participant_type: "youth",
        registrant_type: "guardian",
        parent_name: parentContact.full_name,
        parent_email: parentContact.email || null,
        parent_phone: parentContact.phone || null,
        notes,
      }

      try {
        await must(
          `enrollment ${memberName}`,
          sb.from("program_enrollments").insert(payload).select("id").single()
        )
      } catch (err) {
        if (/unique constraint|duplicate key/i.test(String(err.message))) {
          report.skippedExisting += 1
          bump(report, programName, "skipped")
          continue
        }
        throw err
      }

      report.createdEnrollments += 1
      bump(report, programName, "enrolled")
      if (!String(parentContact.id).startsWith("dry-run:")) {
        parentsToSync.add(parentContact.id)
      }
      if (report.samples.length < 12) {
        report.samples.push({
          program: programName,
          member: memberName,
          parent: parentContact.full_name,
        })
      }
    } catch (err) {
      report.errors.push({
        member: memberName,
        program: programName,
        error: err instanceof Error ? err.message : String(err),
      })
      bump(report, programName, "skipped")
    }
  }

  report.uniqueParents = contactCache.size
  report.programsCreated = [...programCache.values()].filter((p) => p.created).map((p) => p.name)
  report.programCount = programCache.size

  if (execute) {
    for (const contactId of parentsToSync) {
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
    }
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = resolve(
    reportsDir,
    `import-edu-historical-${execute ? "execute" : "dry-run"}-${stamp}.json`
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        excelRows: report.excelRows,
        createdDepartments: report.createdDepartments,
        createdPrograms: report.createdPrograms,
        createdOfferings: report.createdOfferings,
        createdContacts: report.createdContacts,
        reusedContacts: report.reusedContacts,
        createdPeople: report.createdPeople,
        reusedPeople: report.reusedPeople,
        createdEnrollments: report.createdEnrollments,
        skippedCancelled: report.skippedCancelled,
        skippedExistingYear: report.skippedExistingYear,
        skippedExisting: report.skippedExisting,
        skippedDuplicate: report.skippedDuplicate,
        skippedNoParent: report.skippedNoParent,
        uniqueParents: report.uniqueParents,
        byProgram: report.byProgram,
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
