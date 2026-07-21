/**
 * Import Qur'an Institute for Ladies 2025–26 roster + Stripe payment export.
 *
 * Usage (dry-run by default):
 *   node scripts/import-qil-year.mjs
 *   node scripts/import-qil-year.mjs --roster "C:/path/QIL25-26.xlsx" --payments "C:/path/QIL25-26_Payments.csv"
 *   node scripts/import-qil-year.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2025_26_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_ROSTER = "c:/Users/danan/Downloads/QIL25-26.xlsx"
const DEFAULT_PAYMENTS = "c:/Users/danan/Downloads/QIL25-26_Payments.csv"
const DEPARTMENT_NAME = "Qur'an Institute for Ladies"
const PROGRAM_NAME = "Quran Institute for Ladies 2025-2026"
const PROGRAM_START = "2025-08-17"
/** Display / registration date on imported enrollments (Programs → Reports → Registrations). */
const ENROLLMENT_DATE = "2025-08-31"
const PROGRAM_END = "2026-05-31"

/** Payment customer name → roster student name (spelling / family payer aliases). */
const PAYMENT_NAME_ALIASES = {
  "suzanne swelleh": "Suzanne Jamal Sweileh",
  soha: "Soha Musa",
  "aziza owda": "Aziza Odeh",
  "noorelaine abushaaban": "Noor Abushaaban",
  "ghadeer zarkani": "Ghadeer Zakani",
  "monaliza fikri elquadi": "Monaliza Alqadi",
  "duaa kabbani": "Duaa Qabbani",
  "imene latreche": "Imene Latrehe",
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
    roster: DEFAULT_ROSTER,
    payments: DEFAULT_PAYMENTS,
    execute: false,
    orgId: DEFAULT_ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--roster") args.roster = argv[++i]
    else if (arg === "--payments") args.payments = argv[++i]
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

function normalizeCourse(value) {
  return normalizeText(value)
    .replace(/\s*\/\s*/g, "/")
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

function parseDateToIso(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const text = normalizeText(value)
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(text)
  if (mdy) {
    let year = Number(mdy[3])
    if (year < 100) year += 2000
    const month = String(mdy[1]).padStart(2, "0")
    const day = String(mdy[2]).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "Unknown", last: "Student" }
  if (parts.length === 1) return { first: parts[0], last: "" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

function namesMatch(a, b) {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return null
  if (na === nb) return "exact"
  if (na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))) {
    return "contains"
  }
  const ta = na.split(" ")
  const tb = nb.split(" ")
  if (
    ta.length >= 2 &&
    tb.length >= 2 &&
    ta[0] === tb[0] &&
    ta[ta.length - 1] === tb[tb.length - 1]
  ) {
    return "first_last"
  }
  return null
}

function loadRoster(path) {
  if (!existsSync(path)) throw new Error(`Roster file not found: ${path}`)
  const wb = XLSX.readFile(path, { cellDates: true, raw: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    studentName: normalizeText(row["Student Name (English)"] || row["Student Name"]),
    teacherName: normalizeText(row.Teacher),
    courseName: normalizeCourse(row.Course),
    courseFee: parseMoney(row["Course Fee"]),
  })).filter((row) => row.studentName && row.courseName)
}

function loadPayments(path) {
  if (!existsSync(path)) throw new Error(`Payments file not found: ${path}`)
  const text = readFileSync(path, "utf8")
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (parsed.errors?.length) {
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 3))
  }
  return (parsed.data || [])
    .map((row, index) => ({
      rowNumber: index + 2,
      customerName: normalizeText(row["Customer Name"]),
      transactionDate: parseDateToIso(row["Transaction Date"]),
      programName: normalizeText(row["Program Name"]),
      amount: parseMoney(row.Amount),
      status: normalizeText(row.Status).toLowerCase(),
      phone: normalizeText(row["Customer Phone"]),
      email: normalizeEmail(row["Customer Email"]),
      recurringType: normalizeText(row["Recurring Type"]),
    }))
    .filter((row) => row.customerName && row.amount > 0)
}

function buildPlan(rosterRows, paymentRows) {
  const courses = new Map()
  const teachers = new Map()
  const students = new Map()

  for (const row of rosterRows) {
    if (!courses.has(row.courseName)) {
      courses.set(row.courseName, { name: row.courseName, enrollmentCount: 0, teachers: new Set() })
    }
    const course = courses.get(row.courseName)
    course.enrollmentCount += 1
    if (row.teacherName) course.teachers.add(row.teacherName)

    if (row.teacherName) {
      teachers.set(normalizeName(row.teacherName), row.teacherName)
    }

    const key = normalizeName(row.studentName)
    if (!students.has(key)) {
      students.set(key, {
        displayName: row.studentName,
        enrollments: [],
        email: null,
        phone: null,
      })
    }
    students.get(key).enrollments.push({
      courseName: row.courseName,
      teacherName: row.teacherName,
      courseFee: row.courseFee,
      rowNumber: row.rowNumber,
    })
  }

  const succeeded = paymentRows.filter((p) => p.status === "succeeded")
  const skippedStatus = paymentRows.filter((p) => p.status !== "succeeded")

  const unmatchedPayments = []
  const fuzzyMatches = []
  const paymentsByStudent = new Map()

  for (const payment of succeeded) {
    let matchedKey = null
    let reason = null

    const aliasTarget = PAYMENT_NAME_ALIASES[normalizeName(payment.customerName)]
    if (aliasTarget) {
      const aliasKey = normalizeName(aliasTarget)
      if (students.has(aliasKey)) {
        matchedKey = aliasKey
        reason = "alias"
      }
    }

    if (!matchedKey) {
      for (const [key, student] of students) {
        const hit = namesMatch(payment.customerName, student.displayName)
        if (hit) {
          matchedKey = key
          reason = hit
          break
        }
      }
    }
    if (!matchedKey) {
      unmatchedPayments.push(payment)
      continue
    }
    if (reason !== "exact") {
      fuzzyMatches.push({
        paymentName: payment.customerName,
        rosterName: students.get(matchedKey).displayName,
        reason,
        amount: payment.amount,
      })
    }
    const student = students.get(matchedKey)
    if (payment.email && !student.email) student.email = payment.email
    if (payment.phone && !student.phone) student.phone = payment.phone
    if (!paymentsByStudent.has(matchedKey)) paymentsByStudent.set(matchedKey, [])
    paymentsByStudent.get(matchedKey).push(payment)
  }

  const allocations = []
  const rosterNoPayments = []

  for (const [key, student] of students) {
    const pays = (paymentsByStudent.get(key) || []).slice().sort((a, b) =>
      String(a.transactionDate || "").localeCompare(String(b.transactionDate || ""))
    )
    const enrollments = student.enrollments.map((e) => ({
      ...e,
      remaining: e.courseFee,
      paid: 0,
      paymentParts: [],
    }))

    if (pays.length === 0) {
      rosterNoPayments.push({
        studentName: student.displayName,
        courses: enrollments.map((e) => e.courseName),
        feeTotal: enrollments.reduce((s, e) => s + e.courseFee, 0),
      })
    }

    let leftover = 0
    for (const pay of pays) {
      let left = pay.amount
      for (const enrollment of enrollments) {
        if (left <= 0) break
        if (enrollment.remaining <= 0) continue
        const applied = Math.min(left, enrollment.remaining)
        enrollment.remaining = Math.round((enrollment.remaining - applied) * 100) / 100
        enrollment.paid = Math.round((enrollment.paid + applied) * 100) / 100
        enrollment.paymentParts.push({
          date: pay.transactionDate,
          amount: applied,
          recurringType: pay.recurringType,
        })
        left = Math.round((left - applied) * 100) / 100
      }
      leftover = Math.round((leftover + left) * 100) / 100
    }

    for (const enrollment of enrollments) {
      allocations.push({
        studentKey: key,
        studentName: student.displayName,
        email: student.email,
        phone: student.phone,
        courseName: enrollment.courseName,
        teacherName: enrollment.teacherName,
        courseFee: enrollment.courseFee,
        amountPaid: enrollment.paid,
        remaining: enrollment.remaining,
        paymentParts: enrollment.paymentParts,
        status:
          enrollment.paid <= 0.009
            ? "unpaid"
            : enrollment.remaining <= 0.009
              ? "paid"
              : "partially_paid",
      })
    }

    if (leftover > 0.009) {
      allocations.push({
        studentKey: key,
        studentName: student.displayName,
        email: student.email,
        phone: student.phone,
        courseName: "__OVERPAYMENT__",
        teacherName: null,
        courseFee: 0,
        amountPaid: leftover,
        remaining: 0,
        paymentParts: [],
        status: "overpayment",
      })
    }
  }

  return {
    courses: [...courses.values()].map((c) => ({
      name: c.name,
      enrollmentCount: c.enrollmentCount,
      teachers: [...c.teachers],
    })),
    teachers: [...teachers.values()].sort(),
    students: [...students.values()],
    allocations: allocations.filter((a) => a.courseName !== "__OVERPAYMENT__"),
    overpayments: allocations.filter((a) => a.courseName === "__OVERPAYMENT__"),
    unmatchedPayments,
    fuzzyMatches,
    rosterNoPayments,
    skippedStatus,
    totals: {
      rosterRows: rosterRows.length,
      uniqueStudents: students.size,
      uniqueCourses: courses.size,
      uniqueTeachers: teachers.size,
      succeededPayments: succeeded.length,
      succeededAmount: Math.round(succeeded.reduce((s, p) => s + p.amount, 0) * 100) / 100,
      unmatchedPaymentCount: unmatchedPayments.length,
      unmatchedPaymentAmount:
        Math.round(unmatchedPayments.reduce((s, p) => s + p.amount, 0) * 100) / 100,
      allocatedPaid:
        Math.round(
          allocations
            .filter((a) => a.courseName !== "__OVERPAYMENT__")
            .reduce((s, a) => s + a.amountPaid, 0) * 100
        ) / 100,
      courseFeeTotal:
        Math.round(allocations.filter((a) => a.courseName !== "__OVERPAYMENT__").reduce((s, a) => s + a.courseFee, 0) * 100) /
        100,
      overpaymentAmount:
        Math.round(allocations.filter((a) => a.courseName === "__OVERPAYMENT__").reduce((s, a) => s + a.amountPaid, 0) * 100) /
        100,
    },
  }
}

async function ensureDepartment(sb, orgId, execute) {
  const aliases = [DEPARTMENT_NAME, "Quran Institute for Ladies", "Qur'an Institute for Ladies"]
  for (const name of aliases) {
    const { data } = await sb
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .maybeSingle()
    if (data) return data
  }
  if (!execute) return { id: "dry-run:department", name: DEPARTMENT_NAME }
  const { data, error } = await sb
    .from("departments")
    .insert({
      organization_id: orgId,
      name: DEPARTMENT_NAME,
      description: "Imported from QIL 2025–26 spreadsheet",
      color: "#0ea5e9",
    })
    .select("id, name")
    .single()
  if (error) throw new Error(`department create: ${error.message}`)
  return data
}

/**
 * One year program; each course is an offering under that program.
 * Requires scripts/174_enrollment_unique_per_offering.sql (unique per offering).
 */
async function ensureProgram(sb, orgId, departmentId, execute) {
  const { data: existing } = await sb
    .from("programs")
    .select("id, name, department_id")
    .eq("organization_id", orgId)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()
  if (existing) {
    if (execute && existing.department_id !== departmentId) {
      await sb
        .from("programs")
        .update({ department_id: departmentId })
        .eq("id", existing.id)
        .eq("organization_id", orgId)
    }
    return existing
  }
  if (!execute) return { id: "dry-run:program", name: PROGRAM_NAME, department_id: departmentId }
  const { data, error } = await sb
    .from("programs")
    .insert({
      organization_id: orgId,
      department_id: departmentId,
      name: PROGRAM_NAME,
      description: "Academic year program; courses are offerings under this program.",
      start_date: PROGRAM_START,
      end_date: PROGRAM_END,
      enrollment_open_date: PROGRAM_START,
      enrollment_close_date: PROGRAM_END,
      program_type: "adult",
      gender: "Female",
      capacity: 0,
      enrolled: 0,
      waitlist: 0,
      status: "active",
      visibility: "private",
      full_program_registration_enabled: true,
      session_registration_enabled: false,
      require_guardian: false,
    })
    .select("id, name, department_id")
    .single()
  if (error) throw new Error(`program create: ${error.message}`)
  return data
}

async function ensureCourseOffering(sb, orgId, programId, courseName, execute, cache) {
  if (cache.has(courseName)) return cache.get(courseName)
  const { data: existing } = await sb
    .from("program_offerings")
    .select("id, name, program_id")
    .eq("organization_id", orgId)
    .eq("program_id", programId)
    .eq("name", courseName)
    .maybeSingle()
  if (existing) {
    cache.set(courseName, existing)
    return existing
  }
  if (!execute) {
    const placeholder = { id: `dry-run:offering:${courseName}`, name: courseName, program_id: programId }
    cache.set(courseName, placeholder)
    return placeholder
  }
  const { data, error } = await sb
    .from("program_offerings")
    .insert({
      organization_id: orgId,
      program_id: programId,
      name: courseName,
      is_default: false,
      offering_type: "academic_year",
      start_date: PROGRAM_START,
      end_date: PROGRAM_END,
      enrollment_open_date: PROGRAM_START,
      enrollment_close_date: PROGRAM_END,
      status: "closed",
    })
    .select("id, name, program_id")
    .single()
  if (error) throw new Error(`offering create (${courseName}): ${error.message}`)
  cache.set(courseName, data)
  return data
}

async function ensureContact(sb, orgId, fullName, email, phone, execute, cache) {
  const key = normalizeName(fullName)
  if (cache.has(key)) return cache.get(key)

  let query = sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", orgId)
    .eq("contact_type", "individual")
  if (email) {
    const { data: byEmail } = await query.eq("email", email).maybeSingle()
    if (byEmail) {
      cache.set(key, byEmail)
      return byEmail
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
    cache.set(key, byName)
    return byName
  }

  if (!execute) {
    const placeholder = {
      id: `dry-run:contact:${key}`,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
    }
    cache.set(key, placeholder)
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
  cache.set(key, data)
  return data
}

async function ensureStaff(sb, orgId, departmentId, teacherName, execute, contactCache, staffCache) {
  const key = normalizeName(teacherName)
  if (staffCache.has(key)) return staffCache.get(key)

  const contact = await ensureContact(sb, orgId, teacherName, null, null, execute, contactCache)
  const { first, last } = splitName(teacherName)

  const { data: existing } = await sb
    .from("staff")
    .select("id, contact_id, first_name, last_name, department_id")
    .eq("organization_id", orgId)
    .eq("contact_id", contact.id)
    .maybeSingle()

  if (existing) {
    if (execute && existing.department_id !== departmentId) {
      await sb
        .from("staff")
        .update({ department_id: departmentId })
        .eq("id", existing.id)
        .eq("organization_id", orgId)
    }
    staffCache.set(key, existing)
    return existing
  }

  if (!execute) {
    const placeholder = {
      id: `dry-run:staff:${key}`,
      contact_id: contact.id,
      first_name: first,
      last_name: last,
      department_id: departmentId,
    }
    staffCache.set(key, placeholder)
    return placeholder
  }

  const { data, error } = await sb
    .from("staff")
    .insert({
      organization_id: orgId,
      contact_id: contact.id,
      department_id: departmentId,
      first_name: first,
      last_name: last || first,
      email: contact.email || null,
      status: "active",
      staff_type: "part_time",
    })
    .select("id, contact_id, first_name, last_name, department_id")
    .single()
  if (error) throw new Error(`staff create (${teacherName}): ${error.message}`)
  staffCache.set(key, data)
  return data
}

async function ensureStaffAssignment(sb, orgId, programId, offeringId, contactId, execute) {
  if (!execute || String(offeringId).startsWith("dry-run:")) return
  const { data: existing } = await sb
    .from("program_staff_assignments")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("contact_id", contactId)
    .maybeSingle()
  if (existing) return
  const { error } = await sb.from("program_staff_assignments").insert({
    organization_id: orgId,
    program_id: programId,
    offering_id: offeringId,
    contact_id: contactId,
    assignment_role: "primary_instructor",
    is_active: true,
  })
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn(`staff assignment warn: ${error.message}`)
  }
}

async function createEnrollmentAndCharge(
  sb,
  orgId,
  programId,
  departmentId,
  offeringId,
  allocation,
  contact,
  execute
) {
  const importKey = createHash("sha1")
    .update(`${IMPORT_TAG}|${allocation.studentName}|${allocation.courseName}|${allocation.courseFee}`)
    .digest("hex")

  if (!execute) {
    return { enrollmentId: `dry-run:enr:${importKey}`, chargeId: `dry-run:chg:${importKey}` }
  }

  const { data: existingEnroll } = await sb
    .from("program_enrollments")
    .select("id, charge_id")
    .eq("organization_id", orgId)
    .eq("program_id", programId)
    .eq("offering_id", offeringId)
    .eq("participant_contact_id", contact.id)
    .maybeSingle()

  let enrollmentId = existingEnroll?.id || null
  let chargeId = existingEnroll?.charge_id || null

  if (!enrollmentId) {
    const { data: enrollment, error } = await sb
      .from("program_enrollments")
      .insert({
        organization_id: orgId,
        program_id: programId,
        offering_id: offeringId,
        department_id: departmentId,
        child_name: allocation.studentName,
        participant_contact_id: contact.id,
        registrant_contact_id: contact.id,
        payer_contact_id: contact.id,
        status: "enrolled",
        payment_status:
          allocation.status === "paid"
            ? "paid"
            : allocation.status === "partially_paid"
              ? "partial"
              : "pending",
        total_amount: allocation.courseFee,
        amount_paid: allocation.amountPaid,
        enrollment_date: ENROLLMENT_DATE,
        participant_type: "adult",
        registrant_type: "adult_self",
        parent_name: allocation.studentName,
        parent_email: allocation.email,
        parent_phone: allocation.phone,
        notes: `Imported ${IMPORT_TAG}`,
      })
      .select("id")
      .single()
    if (error) throw new Error(`enrollment (${allocation.studentName}): ${error.message}`)
    enrollmentId = enrollment.id
  }

  const chargeStatus =
    allocation.amountPaid <= 0.009
      ? "pending_payment"
      : allocation.remaining <= 0.009
        ? "paid"
        : "partially_paid"

  if (!chargeId) {
    const { data: charge, error } = await sb
      .from("program_charges")
      .insert({
        organization_id: orgId,
        enrollment_id: enrollmentId,
        charge_type: "registration",
        source_type: "manual",
        payer_contact_id: contact.id,
        registrant_contact_id: contact.id,
        participant_contact_id: contact.id,
        program_id: programId,
        offering_id: offeringId,
        currency: "USD",
        subtotal: allocation.courseFee,
        discount_total: 0,
        total: allocation.courseFee,
        due_today: allocation.courseFee,
        amount_paid: allocation.amountPaid,
        payment_required: true,
        charge_status: chargeStatus,
        checkout_status: allocation.amountPaid > 0 ? "paid" : "not_started",
        paid_at: allocation.amountPaid > 0 ? new Date().toISOString() : null,
        metadata: { import_tag: IMPORT_TAG, import_key: importKey },
        quote_snapshot: { import: IMPORT_TAG },
      })
      .select("id")
      .single()
    if (error) throw new Error(`charge (${allocation.studentName}): ${error.message}`)
    chargeId = charge.id

    await sb
      .from("program_enrollments")
      .update({ charge_id: chargeId, amount_paid: allocation.amountPaid })
      .eq("id", enrollmentId)
      .eq("organization_id", orgId)

    await sb.from("program_charge_lines").insert({
      organization_id: orgId,
      charge_id: chargeId,
      line_type: "tuition",
      label: allocation.courseName,
      quantity: 1,
      unit_amount: allocation.courseFee,
      amount: allocation.courseFee,
      sort_order: 0,
    })
  } else {
    await sb
      .from("program_charges")
      .update({
        amount_paid: allocation.amountPaid,
        charge_status: chargeStatus,
        total: allocation.courseFee,
        subtotal: allocation.courseFee,
      })
      .eq("id", chargeId)
      .eq("organization_id", orgId)
  }

  // Replace schedule rows for this charge with imported payment parts (by month).
  await sb
    .from("program_charge_schedule")
    .delete()
    .eq("organization_id", orgId)
    .eq("charge_id", chargeId)

  const scheduleRows = []
  if (allocation.paymentParts.length > 0) {
    allocation.paymentParts.forEach((part, index) => {
      scheduleRows.push({
        organization_id: orgId,
        charge_id: chargeId,
        schedule_type: "custom",
        label: `Payment ${part.date || index + 1}`,
        due_date: part.date,
        amount: part.amount,
        sequence_number: index + 1,
        status: "paid",
        charge_category: "tuition",
        paid_at: part.date ? `${part.date}T12:00:00Z` : new Date().toISOString(),
        metadata: { import_tag: IMPORT_TAG, recurring_type: part.recurringType },
      })
    })
  } else if (allocation.courseFee > 0) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: "Course fee",
      due_date: PROGRAM_START,
      amount: allocation.courseFee,
      sequence_number: 1,
      status: "scheduled",
      charge_category: "tuition",
      metadata: { import_tag: IMPORT_TAG },
    })
  }

  if (scheduleRows.length > 0) {
    const { error: scheduleError } = await sb.from("program_charge_schedule").insert(scheduleRows)
    if (scheduleError) {
      console.warn(`schedule warn (${allocation.studentName}): ${scheduleError.message}`)
    }
  }

  return { enrollmentId, chargeId }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)
  console.log(`Roster: ${args.roster}`)
  console.log(`Payments: ${args.payments}`)

  const rosterRows = loadRoster(args.roster)
  const paymentRows = loadPayments(args.payments)
  const plan = buildPlan(rosterRows, paymentRows)

  const stamp = new Date().toISOString().slice(0, 10)
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(reportDir, `qil-import-${stamp}.json`)

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    totals: plan.totals,
    courses: plan.courses,
    teachers: plan.teachers,
    fuzzyMatches: plan.fuzzyMatches,
    rosterNoPayments: plan.rosterNoPayments,
    unmatchedPayments: plan.unmatchedPayments.map((p) => ({
      customerName: p.customerName,
      amount: p.amount,
      date: p.transactionDate,
      email: p.email,
    })),
    overpayments: plan.overpayments,
    skippedStatusCount: plan.skippedStatus.length,
    created: {
      departmentId: null,
      programId: null,
      offerings: 0,
      contacts: 0,
      staff: 0,
      enrollments: 0,
    },
  }

  if (!args.execute) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log("\n=== DRY-RUN SUMMARY ===")
    console.log(JSON.stringify(plan.totals, null, 2))
    console.log(`Courses (${plan.courses.length}):`, plan.courses.map((c) => c.name).join(" | "))
    console.log(`Teachers (${plan.teachers.length}):`, plan.teachers.join(" | "))
    console.log(`Fuzzy name matches: ${plan.fuzzyMatches.length}`)
    console.log(`Roster with no payments: ${plan.rosterNoPayments.length}`)
    console.log(
      `Unmatched payment names: ${new Set(plan.unmatchedPayments.map((p) => normalizeName(p.customerName))).size} people / $${plan.totals.unmatchedPaymentAmount}`
    )
    console.log(`\nReport written: ${reportPath}`)
    console.log("Re-run with --execute to write to Supabase.")
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const orgId = args.orgId

  const department = await ensureDepartment(sb, orgId, true)
  const program = await ensureProgram(sb, orgId, department.id, true)
  report.created.departmentId = department.id
  report.created.programId = program.id

  const offeringCache = new Map()
  const contactCache = new Map()
  const staffCache = new Map()

  for (const course of plan.courses) {
    await ensureCourseOffering(sb, orgId, program.id, course.name, true, offeringCache)
    report.created.offerings += 1
  }

  for (const teacherName of plan.teachers) {
    const staff = await ensureStaff(
      sb,
      orgId,
      department.id,
      teacherName,
      true,
      contactCache,
      staffCache
    )
    report.created.staff += 1
    for (const course of plan.courses) {
      if (!course.teachers.includes(teacherName)) continue
      const offering = offeringCache.get(course.name)
      if (offering) {
        await ensureStaffAssignment(sb, orgId, program.id, offering.id, staff.contact_id, true)
      }
    }
  }

  for (const allocation of plan.allocations) {
    const contact = await ensureContact(
      sb,
      orgId,
      allocation.studentName,
      allocation.email,
      allocation.phone,
      true,
      contactCache
    )
    report.created.contacts += 1
    const offering = await ensureCourseOffering(
      sb,
      orgId,
      program.id,
      allocation.courseName,
      true,
      offeringCache
    )
    await createEnrollmentAndCharge(
      sb,
      orgId,
      program.id,
      department.id,
      offering.id,
      allocation,
      contact,
      true
    )
    report.created.enrollments += 1
  }

  // Customer affiliation (unified program-participant tag) from enrollments
  let affiliationsSynced = 0
  for (const contact of contactCache.values()) {
    if (!contact?.id || String(contact.id).startsWith("dry-run:")) continue
    const { error: syncError } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: contact.id,
    })
    if (syncError) {
      console.warn(`affiliation sync failed (${contact.full_name}):`, syncError.message)
      continue
    }
    affiliationsSynced += 1
  }
  report.created.affiliationsSynced = affiliationsSynced

  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log("\n=== EXECUTE COMPLETE ===")
  console.log(JSON.stringify(report.created, null, 2))
  console.log(`Report: ${reportPath}`)
  console.log(`Open Programs → Departments → ${department.name}`)
  console.log("Payments: Programs → Reports → Registrations")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
