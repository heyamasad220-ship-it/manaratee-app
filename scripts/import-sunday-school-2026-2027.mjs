/**
 * Import Sunday School 2026-2027 from workbook:
 *   Master Registration Report + Rosters + Registrations + Payments
 *
 * Usage (dry-run by default):
 *   node scripts/import-sunday-school-2026-2027.mjs
 *   node scripts/import-sunday-school-2026-2027.mjs --xlsx "C:/Users/danan/Downloads/Sunday_School_Master_Registration_Report.xlsx"
 *   node scripts/import-sunday-school-2026-2027.mjs --execute
 *
 * Fee rules (confirmed Aug 2026):
 *   - $120 per student (sibling #2+ get 5% off → $114)
 *   - ADDONS_AMOUNT = $5 transaction fee (staff families are 50% of that)
 *   - Staff families: 50% staff discount
 *   - Habiba Hassan: 3% full-payment discount; tuition $234; paid $240 (extra $6)
 *   - Skip Zachie/Ihab Neel; skip withdrawn/cancelled (Walaa Hatamleh, Rosemary Admiral)
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

const IMPORT_TAG = "SUNDAY_SCHOOL_2026_27_V2"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_XLSX =
  "C:/Users/danan/Downloads/Sunday_School_Master_Registration_Report.xlsx"
const DEPARTMENT_NAME = "Education"
const PROGRAM_NAME = "Sunday School 2026-2027"
const BASE_FEE = 120
const SIBLING_FEE = 114 // 5% off
const TXN_FEE = 5
const DEFAULT_MONTHS = 9

const OFFERING_NAMES = ["Age 4-6", "Age 7-9", "Age 10-14"]

const SKIP_CHILDREN = new Set([
  "zachie neel",
  "ihab neel",
  "dan hammad hatamleh",
  "sulaiman hammad hatamleh",
  "mohamed amine soulaimani",
])

const SKIP_PARENTS = new Set(["walaa hatamleh", "rosemary admiral"])

const STAFF_PARENTS = new Set([
  "kawthar walid abed",
  "hanan ahmed",
  "yasmine ali",
  "ibrahim hassan",
  "abeer qandil",
  "mohammad mahdawi",
])

const FULL_PAY_PARENTS = new Set(["habiba hassan"])

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
  if (parts.length === 0) return { first: "Participant", last: "SundaySchool" }
  if (parts.length === 1) return { first: parts[0], last: "Participant" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function excelSerialToIso(serial) {
  const n = Number(serial)
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
  return date.toISOString().slice(0, 10)
}

function parseDob(value) {
  if (value == null || value === "") return null
  if (typeof value === "number") return excelSerialToIso(value)
  const text = norm(value)
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (mdy) {
    const mm = String(mdy[1]).padStart(2, "0")
    const dd = String(mdy[2]).padStart(2, "0")
    return `${mdy[3]}-${mm}-${dd}`
  }
  const iso = Date.parse(text)
  if (Number.isFinite(iso)) return new Date(iso).toISOString().slice(0, 10)
  return null
}

function parseDateTime(value) {
  if (value == null || value === "") return null
  if (typeof value === "number") {
    const iso = excelSerialToIso(value)
    return iso ? `${iso}T17:00:00.000Z` : null
  }
  const text = norm(value)
  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function parseRegistrationDate(value) {
  const iso = parseDateTime(value)
  return iso ? iso.slice(0, 10) : null
}

function normalizeGender(value) {
  const g = norm(value).toLowerCase()
  if (g.startsWith("f")) return "female"
  if (g.startsWith("m")) return "male"
  return null
}

function parseEmergencyBlob(value) {
  const raw = norm(value)
  if (!raw || raw === "undefined,,") return { phone: null, email: null, address: null }
  const parts = raw.split(",").map((p) => p.trim())
  const phone = formatPhone(digitsPhone(parts[0]))
  let email = null
  let address = null
  for (let i = 1; i < parts.length; i += 1) {
    const p = parts[i]
    if (!p || p === "undefined") continue
    if (!email && p.includes("@")) {
      email = normEmail(p)
      continue
    }
    if (!address) address = p
    else address = `${address}, ${p}`
  }
  return { phone, email, address }
}

function monthsInclusive(startIso, endIso) {
  if (!startIso || !endIso) return DEFAULT_MONTHS
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return DEFAULT_MONTHS
  }
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  return Math.min(Math.max(months, 1), 24)
}

function addMonthsIso(startIso, index) {
  const d = new Date(`${startIso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + index)
  return d.toISOString().slice(0, 10)
}

function importKey(row) {
  return createHash("sha1")
    .update(
      [
        IMPORT_TAG,
        normName(row.participantName),
        row.dob || "",
        row.offering || "",
        row.parentEmail || "",
        row.parentPhone || "",
      ].join("|")
    )
    .digest("hex")
    .slice(0, 16)
}

function paymentImportKey(row) {
  return createHash("sha1")
    .update(
      [
        IMPORT_TAG,
        "pay",
        normEmail(row.email) || "",
        digitsPhone(row.phone) || "",
        row.iso || "",
        String(row.amount),
        row.amountType || "",
        row.status || "",
        row.mode || "",
      ].join("|")
    )
    .digest("hex")
    .slice(0, 20)
}

function familyKey(email, phone) {
  if (email) return `email:${email}`
  if (phone) return `phone:${digitsPhone(phone)}`
  return null
}

function approxEqual(a, b, tol = 0.51) {
  return Math.abs(round2(a) - round2(b)) <= tol
}

function listTuitionForCount(count) {
  if (count <= 0) return 0
  return round2(BASE_FEE + SIBLING_FEE * (count - 1))
}

function sheetRowsFromHeader(sheet, headerValue) {
  if (!sheet) return []
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  const headerIdx = aoa.findIndex(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => String(cell || "").trim() === headerValue)
  )
  if (headerIdx < 0) return []
  const headers = (aoa[headerIdx] || []).map((h) => String(h || "").trim())
  const rows = []
  for (let i = headerIdx + 1; i < aoa.length; i += 1) {
    const raw = aoa[i] || []
    if (!raw.some((v) => v != null && String(v).trim() !== "")) continue
    const obj = {}
    headers.forEach((header, idx) => {
      if (!header) return
      obj[header] = raw[idx] ?? null
    })
    rows.push(obj)
  }
  return rows
}

function shouldSkipChild(parentName, participantName) {
  return (
    SKIP_PARENTS.has(normName(parentName)) ||
    SKIP_CHILDREN.has(normName(participantName))
  )
}

function resolvePaymentStatus(total, paid) {
  if (total <= 0.009) return "paid"
  if (paid + 0.009 >= total) return "paid"
  if (paid > 0) return "partial"
  return "pending"
}

function resolveChargeStatus(total, paid) {
  if (total <= 0.009) return "paid"
  if (paid + 0.009 >= total) return "paid"
  if (paid > 0) return "partially_paid"
  return "pending_payment"
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

  const fullName =
    norm(parent.name) ||
    (parent.childName ? `Parent of ${parent.childName}` : "Sunday School Parent")

  if (!execute) {
    const placeholder = {
      id: `dry-run:contact:${cacheKey}`,
      full_name: fullName,
      email: email || null,
      phone: formatPhone(phoneDigits) || parent.phone || null,
      person_id: null,
      _created: true,
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

  const { data: contact, error } = await sb
    .from("contacts")
    .select("id, full_name, email, phone, person_id, address")
    .eq("id", contactId)
    .single()
  if (error) throw new Error(`reload contact: ${error.message}`)

  // Enrich missing email/phone/name without overwriting good data
  const patch = {}
  if (email && !normEmail(contact.email)) patch.email = email
  if (phoneDigits && !digitsPhone(contact.phone)) {
    patch.phone = formatPhone(phoneDigits)
  }
  if (parent.address && !contact.address) patch.address = parent.address
  if (
    fullName &&
    (!contact.full_name ||
      /^parent of /i.test(contact.full_name) ||
      contact.full_name === "Sunday School Parent")
  ) {
    if (norm(parent.name)) patch.full_name = norm(parent.name)
  }
  if (Object.keys(patch).length > 0) {
    await sb
      .from("contacts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", contact.id)
      .eq("organization_id", ORG_ID)
    Object.assign(contact, patch)
  }

  // Was this a brand-new contact? Heuristic: not in preloaded indexes
  const wasKnown =
    (email && emailIndex.has(email)) ||
    (phoneDigits && phoneIndex.has(phoneDigits))
  if (!wasKnown) report.createdContacts += 1
  else report.reusedContacts += 1

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
  if (!execute) return `dry-run:child:${normName(child.name)}:${child.dob || ""}`

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
        .select("id, first_name, last_name, date_of_birth, gender")
        .eq("organization_id", ORG_ID)
        .in("id", relatedIds)
      const match = (people || []).find((p) => {
        const sameName =
          normName(`${p.first_name} ${p.last_name}`) === normName(child.name)
        if (!sameName) return false
        if (child.dob && p.date_of_birth) return p.date_of_birth === child.dob
        return true
      })
      if (match) {
        const patch = {}
        if (child.dob && !match.date_of_birth) patch.date_of_birth = child.dob
        if (child.gender && !match.gender) patch.gender = child.gender
        if (Object.keys(patch).length > 0) {
          await sb
            .from("people")
            .update(patch)
            .eq("id", match.id)
            .eq("organization_id", ORG_ID)
        }
        return match.id
      }
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
        date_of_birth: child.dob || null,
        gender: child.gender || null,
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
      .eq("relationship_type", "child")
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

  return created.id
}

/**
 * Insert tuition installments. Uses organization_id when the column exists
 * (scripts/240_program_payment_plans_organization_id.sql); otherwise enrollment-only.
 */
async function upsertEnrollmentPaymentPlans(sb, input) {
  const {
    enrollmentId,
    startDate,
    planCount,
    planInstallment,
    totalAmount,
    amountPaid,
  } = input

  const planRowsWithOrg = Array.from({ length: planCount }, (_, index) => {
    const due = addMonthsIso(startDate, index)
    // program_payment_plans_status_check does not allow "paid" — keep scheduled;
    // enrollment.amount_paid is the source of truth for receipt state.
    const amount =
      index === planCount - 1
        ? round2(totalAmount - planInstallment * (planCount - 1))
        : planInstallment
    return {
      organization_id: ORG_ID,
      enrollment_id: enrollmentId,
      installment_amount: amount,
      due_date: due,
      status: "pending",
    }
  })
  const planRowsNoOrg = planRowsWithOrg.map(
    ({ organization_id: _org, ...rest }) => rest
  )

  // Clear prior import rows for this enrollment
  let del = await sb
    .from("program_payment_plans")
    .delete()
    .eq("organization_id", ORG_ID)
    .eq("enrollment_id", enrollmentId)
  if (del.error && /organization_id does not exist/i.test(del.error.message)) {
    del = await sb
      .from("program_payment_plans")
      .delete()
      .eq("enrollment_id", enrollmentId)
  }
  if (del.error) {
    return { created: false, error: del.error.message }
  }

  let ins = await sb.from("program_payment_plans").insert(planRowsWithOrg)
  if (ins.error && /organization_id does not exist/i.test(ins.error.message)) {
    ins = await sb.from("program_payment_plans").insert(planRowsNoOrg)
  }
  if (ins.error) {
    return { created: false, error: ins.error.message }
  }
  return { created: true, error: null }
}

async function ensureOfferings(sb, program, execute, report) {
  const { data: existing } = await sb
    .from("program_offerings")
    .select("id, name, status, program_id")
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)

  const byName = new Map(
    (existing || []).map((o) => [norm(o.name).toLowerCase(), o])
  )
  const result = new Map()

  for (const name of OFFERING_NAMES) {
    const key = name.toLowerCase()
    if (byName.has(key)) {
      result.set(key, byName.get(key))
      continue
    }
    if (!execute) {
      const placeholder = {
        id: `dry-run:offering:${key}`,
        name,
        program_id: program.id,
        status: "active",
      }
      result.set(key, placeholder)
      report.createdOfferings += 1
      continue
    }
    const created = await must(
      `offering ${name}`,
      sb
        .from("program_offerings")
        .insert({
          organization_id: ORG_ID,
          program_id: program.id,
          name,
          is_default: false,
          offering_type: "academic_year",
          start_date: program.start_date,
          end_date: program.end_date,
          enrollment_open_date: program.start_date,
          enrollment_close_date: program.end_date,
          status: "active",
          capacity: 120,
        })
        .select("id, name, status, program_id")
        .single()
    )
    result.set(key, created)
    report.createdOfferings += 1
  }

  return result
}

function buildFamilies(masterRows, subRows, skipped) {
  const families = new Map()

  for (const raw of masterRows) {
    const participantName = norm(raw["Participant Name"])
    const parentName = norm(raw["Customer / Parent Name"]) || null
    if (!participantName) continue
    if (shouldSkipChild(parentName, participantName)) {
      skipped.push({
        parent: parentName,
        child: participantName,
        reason: "skipped by import rules",
      })
      continue
    }

    const ec1 = parseEmergencyBlob(raw["Emergency Contact 1"])
    const ec2 = parseEmergencyBlob(raw["Emergency Contact 2"])
    const parentEmail = normEmail(raw["Customer Email"]) || ec1.email || null
    const parentPhone =
      formatPhone(digitsPhone(raw["Customer Phone"])) || ec1.phone || null
    const offering = norm(raw.Offering)
    const dob = parseDob(raw["Date of Birth"])
    const gender = normalizeGender(raw.Gender)
    const enrollmentDate =
      parseRegistrationDate(raw["Registration Date"]) ||
      excelSerialToIso(raw["Registration Date"]) ||
      "2026-09-06"
    const allergies = [
      ...new Set(
        [raw["Medical Allergies"], raw["Any Allergies"]]
          .map((value) => {
            const text = norm(value)
              .replace(/^any\s+allergies\s*:\s*/i, "")
              .trim()
            const lower = text.toLowerCase()
            if (
              !text ||
              ["no", "none", "n/a", "na", "-", "unknown"].includes(lower)
            ) {
              return null
            }
            return text
          })
          .filter(Boolean)
      ),
    ].join("; ")
    const photoConsent = norm(raw["Photo Consent"])
    const financialRow = norm(raw["Financial Row"]).toLowerCase() === "yes"

    const fk =
      familyKey(parentEmail, parentPhone) ||
      `solo:${normName(parentName || participantName)}`

    if (!families.has(fk)) {
      families.set(fk, {
        key: fk,
        parentEmail,
        parentPhone,
        parentName,
        parentAddress: ec1.address || ec2.address || null,
        children: [],
        subscription: null,
        payments: [],
        masterFee: null,
        masterPaid: null,
        masterAddons: null,
        masterSubscriptionPaid: null,
        discountKind: null,
      })
    }

    const family = families.get(fk)
    if (!family.parentEmail && parentEmail) family.parentEmail = parentEmail
    if (!family.parentPhone && parentPhone) family.parentPhone = parentPhone
    if (!family.parentName && parentName) family.parentName = parentName
    if (!family.parentAddress && (ec1.address || ec2.address)) {
      family.parentAddress = ec1.address || ec2.address
    }

    if (financialRow) {
      family.masterFee = round2(raw["Registration Fee"] || 0)
      family.masterPaid = round2(raw["Registration Paid"] || 0)
      family.masterAddons = round2(raw["Add-ons Paid"] || 0)
      family.masterSubscriptionPaid = round2(raw["Subscription Paid"] || 0)
      family.recurringType =
        norm(raw["Recurring Type"]).toUpperCase() || "MONTHLY"
      family.subscription = {
        amount: round2(raw["Registration Fee"] || 0),
        recurringType: family.recurringType,
        startDate:
          excelSerialToIso(raw["Subscription Start"]) || "2026-09-01",
        endDate: excelSerialToIso(raw["Subscription End"]) || "2027-05-16",
        email: parentEmail,
        phone: parentPhone,
        contactName: parentName,
      }
    } else if (!family.subscription && raw["Recurring Type"]) {
      family.recurringType = norm(raw["Recurring Type"]).toUpperCase()
      family.subscription = {
        amount: 0,
        recurringType: family.recurringType,
        startDate:
          excelSerialToIso(raw["Subscription Start"]) || "2026-09-01",
        endDate: excelSerialToIso(raw["Subscription End"]) || "2027-05-16",
        email: parentEmail,
        phone: parentPhone,
        contactName: parentName,
      }
    }

    const child = {
      participantName,
      offering,
      dob,
      gender,
      enrollmentDate,
      relation: norm(raw.Relation),
      allergies: allergies || null,
      photoConsent: photoConsent || null,
      registrationRaw: raw["Registration Date"],
    }
    child.key = importKey({
      participantName,
      dob,
      offering,
      parentEmail: family.parentEmail,
      parentPhone: family.parentPhone,
    })
    family.children.push(child)
  }

  for (const raw of subRows) {
    const email = normEmail(raw["Customer Email"])
    const phone = formatPhone(digitsPhone(raw["Customer Phone"] || raw.Phone))
    const fk = familyKey(email, phone)
    let family = fk ? families.get(fk) : null
    if (!family && email) {
      family =
        [...families.values()].find((f) => f.parentEmail === email) || null
    }
    if (!family && phone) {
      const dig = digitsPhone(phone)
      family =
        [...families.values()].find(
          (f) => digitsPhone(f.parentPhone) === dig
        ) || null
    }
    if (!family) continue
    if (!family.parentEmail && email) family.parentEmail = email
    if (!family.parentPhone && phone) family.parentPhone = phone
    if (!family.parentName && norm(raw["Customer Name"])) {
      family.parentName = norm(raw["Customer Name"])
    }

    const recurringType =
      norm(raw["Recurring Type"]).toUpperCase() ||
      family.recurringType ||
      "MONTHLY"
    family.recurringType = recurringType
    family.subscription = {
      amount: round2(raw.Fee || raw.Amount || family.masterFee || 0),
      recurringType,
      startDate:
        excelSerialToIso(raw["Subscription Start Date"]) ||
        family.subscription?.startDate ||
        "2026-09-01",
      endDate:
        excelSerialToIso(raw["Subscription End Date"]) ||
        family.subscription?.endDate ||
        "2027-05-16",
      email,
      phone,
      contactName: norm(raw["Customer Name"]),
    }
  }

  for (const family of families.values()) {
    family.children.sort((a, b) => {
      const da = a.enrollmentDate || ""
      const db = b.enrollmentDate || ""
      if (da !== db) return da.localeCompare(db)
      return a.participantName.localeCompare(b.participantName)
    })
    applyFamilyFinancials(family)
  }

  return families
}

function applyFamilyFinancials(family) {
  const count = family.children.length
  const listTotal = listTuitionForCount(count)
  const parentKey = normName(family.parentName)
  const isFullPay =
    FULL_PAY_PARENTS.has(parentKey) ||
    String(family.recurringType || "").toUpperCase() === "FULL PAYMENT"
  const staffByName = STAFF_PARENTS.has(parentKey)
  const staffByAmount =
    family.masterFee != null &&
    listTotal > 0 &&
    approxEqual(family.masterFee, round2(listTotal * 0.5))

  let familyDue = family.masterFee != null ? family.masterFee : listTotal
  let familyPaid = family.masterPaid != null ? family.masterPaid : 0

  if (isFullPay) {
    family.discountKind = "full_pay"
    familyDue = round2(listTotal * 0.97)
    familyPaid = family.masterPaid != null ? family.masterPaid : familyPaid
  } else if (staffByName || staffByAmount) {
    family.discountKind = "staff"
  }

  const weights = family.children.map((_, index) =>
    index === 0 ? BASE_FEE : SIBLING_FEE
  )
  const weightSum = weights.reduce((sum, n) => sum + n, 0) || 1

  family.children.forEach((child, index) => {
    child.siblingIndex = index
    child.monthlyFee = weights[index]
    child.totalAmount = round2((familyDue * weights[index]) / weightSum)
    child.listAmount = BASE_FEE
  })
  if (family.children.length > 0) {
    const allocated = round2(
      family.children.reduce((sum, child) => sum + child.totalAmount, 0)
    )
    const drift = round2(familyDue - allocated)
    family.children[family.children.length - 1].totalAmount = round2(
      family.children[family.children.length - 1].totalAmount + drift
    )
  }

  let remainingPaid = familyPaid
  family.children.forEach((child, index) => {
    if (index === family.children.length - 1) {
      child.amountPaid = round2(Math.max(0, remainingPaid))
    } else {
      const share =
        familyDue > 0
          ? round2((familyPaid * child.totalAmount) / familyDue)
          : 0
      child.amountPaid = share
      remainingPaid = round2(remainingPaid - share)
    }
    child.discountLines = buildChildDiscountLines(child, family)
  })

  family.tuitionPaid = familyPaid
  family.planMonths = monthsInclusive(
    family.subscription?.startDate,
    family.subscription?.endDate
  )
  const monthly =
    String(family.recurringType || family.subscription?.recurringType || "")
      .toUpperCase() === "MONTHLY"
  for (const child of family.children) {
    if (monthly && family.planMonths > 1 && child.totalAmount > 0.009) {
      child.planCount = family.planMonths
      child.planInstallment = round2(child.totalAmount / family.planMonths)
    } else {
      child.planCount = 1
      child.planInstallment = child.totalAmount
    }
  }

  family.addonTotal =
    family.masterAddons != null && family.masterAddons > 0
      ? family.masterAddons
      : 0
}

function buildChildDiscountLines(child, family) {
  const list = BASE_FEE
  const due = child.totalAmount
  let remaining = round2(list - due)
  const lines = []
  if (child.siblingIndex > 0) {
    const sibling = round2(BASE_FEE - SIBLING_FEE)
    lines.push({
      lineType: "sibling_discount",
      label: "Sibling discount (5%)",
      amount: sibling,
    })
    remaining = round2(remaining - sibling)
  }
  if (remaining > 0.009 && family.discountKind === "staff") {
    lines.push({
      lineType: "discount",
      label: "Staff discount (50%)",
      amount: remaining,
    })
    remaining = 0
  } else if (remaining > 0.009 && family.discountKind === "full_pay") {
    lines.push({
      lineType: "discount",
      label: "Full payment discount (3%)",
      amount: remaining,
    })
    remaining = 0
  } else if (remaining > 0.009) {
    lines.push({
      lineType: "discount",
      label: "Discount",
      amount: remaining,
    })
  }
  return lines
}

function indexFamilies(families) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byLastName = new Map()

  function addLastName(name, family) {
    const parts = normName(name).split(" ").filter(Boolean)
    if (parts.length < 2) return
    const last = parts[parts.length - 1]
    if (last.length < 3) return
    if (!byLastName.has(last)) byLastName.set(last, [])
    const list = byLastName.get(last)
    if (!list.includes(family)) list.push(family)
  }

  for (const family of families.values()) {
    if (family.parentEmail) byEmail.set(family.parentEmail, family)
    if (family.subscription?.email) byEmail.set(family.subscription.email, family)
    const phones = [
      family.parentPhone,
      family.subscription?.phone,
    ]
      .map((p) => digitsPhone(p))
      .filter(Boolean)
    for (const dig of phones) byPhone.set(dig, family)

    if (family.parentName) addLastName(family.parentName, family)
    if (family.subscription?.contactName) {
      addLastName(family.subscription.contactName, family)
    }
    for (const child of family.children) addLastName(child.participantName, family)
  }

  return { byEmail, byPhone, byLastName }
}

function findFamily(indexes, { email, phone, name }) {
  if (email && indexes.byEmail.has(email)) return indexes.byEmail.get(email)
  const dig = digitsPhone(phone)
  if (dig && indexes.byPhone.has(dig)) return indexes.byPhone.get(dig)
  if (name) {
    const parts = normName(name).split(" ").filter(Boolean)
    const last = parts[parts.length - 1]
    if (last && indexes.byLastName.has(last)) {
      const hits = indexes.byLastName.get(last)
      if (hits.length === 1) return hits[0]
      // Prefer family whose child count × 120 matches a later payment — return first
      // with matching last name on a child
      const named = hits.find((f) =>
        f.children.some((c) => normName(c.participantName).endsWith(` ${last}`))
      )
      if (named) return named
    }
  }
  return null
}

function attachPayments(families, payRows, report) {
  const indexes = indexFamilies(families)
  const unmatched = []
  for (const raw of payRows) {
    const email = normEmail(raw["Customer Email"])
    const phone = formatPhone(digitsPhone(raw["Customer Phone"]))
    const amount = round2(raw.Amount)
    const status = norm(raw.Status).toLowerCase()
    const amountType = norm(raw["Amount Type"]).toUpperCase() || null
    const mode = norm(raw["Payment Mode"]).toUpperCase() || null
    const iso = parseDateTime(raw["Transaction Date"])
    const row = {
      customerName: norm(raw["Customer Name"]),
      email,
      phone,
      amount,
      status,
      amountType,
      mode,
      iso,
      recurringType: norm(raw["Recurring Type"]).toUpperCase() || null,
      refundReason: norm(raw["Refund Reason"]) || null,
      cardLast4: raw["Card Last 4 Digits"]
        ? String(raw["Card Last 4 Digits"])
        : null,
      transactionType: norm(raw["Transaction Type"]).toUpperCase() || null,
    }
    row.key = paymentImportKey(row)

    const family = findFamily(indexes, {
      email,
      phone,
      name: row.customerName,
    })
    if (!family) {
      unmatched.push(row)
      continue
    }
    if (!family.parentEmail && email) family.parentEmail = email
    if (!family.parentPhone && phone) family.parentPhone = phone
    if (!family.parentName && row.customerName) family.parentName = row.customerName
    // Keep indexes fresh for subsequent rows
    if (email) indexes.byEmail.set(email, family)
    if (digitsPhone(phone)) indexes.byPhone.set(digitsPhone(phone), family)
    family.payments.push(row)
  }
  report.unmatchedPayments = unmatched.length
  report.unmatchedPaymentSamples = unmatched.slice(0, 15)
}

function allocateTuitionPaid(family) {
  // Master Registration Report is the source of truth for tuition due/paid.
  // Do not fold SUBSCRIPTION_AMOUNT (e.g. Habiba $2,042.82) into program fees.
  family.addonPayments = family.payments.filter(
    (p) =>
      p.amountType === "ADDONS_AMOUNT" &&
      p.status !== "refunded" &&
      p.amount > 0
  )
  if ((!family.addonTotal || family.addonTotal <= 0) && family.addonPayments.length) {
    family.addonTotal = round2(
      family.addonPayments.reduce((sum, p) => sum + p.amount, 0)
    )
  }
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const xlsxPath = argValue("--xlsx") || DEFAULT_XLSX
  if (!existsSync(xlsxPath)) throw new Error(`File not found: ${xlsxPath}`)

  if (execute) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase env in .env.local")
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "dry-run",
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const wb = XLSX.readFile(xlsxPath)
  const masterRows = sheetRowsFromHeader(
    wb.Sheets["Master Registration Report"] || wb.Sheets.Master,
    "Financial Row"
  )
  const rosterRows = XLSX.utils.sheet_to_json(wb.Sheets.Rosters || {}, {
    defval: null,
  })
  const subRows = XLSX.utils.sheet_to_json(wb.Sheets.Registrations || {}, {
    defval: null,
  })
  const payRows = XLSX.utils.sheet_to_json(wb.Sheets.Payments || {}, {
    defval: null,
  })

  const report = {
    mode: execute ? "execute" : "dry-run",
    xlsxPath,
    generatedAt: new Date().toISOString(),
    counts: {
      master: masterRows.length,
      rosters: rosterRows.length,
      subscriptions: subRows.length,
      payments: payRows.length,
    },
    createdContacts: 0,
    reusedContacts: 0,
    createdPeople: 0,
    createdOfferings: 0,
    createdEnrollments: 0,
    skippedExisting: 0,
    skippedNoOffering: [],
    skippedNoParent: [],
    skippedByRule: [],
    createdCharges: 0,
    createdAddonCharges: 0,
    createdPlans: 0,
    errors: [],
    feeScaledFamilies: 0,
    samples: [],
    unmatchedPayments: 0,
    unmatchedPaymentSamples: [],
  }

  const { data: department } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .ilike("name", DEPARTMENT_NAME)
    .maybeSingle()
  if (!department) throw new Error(`Department not found: ${DEPARTMENT_NAME}`)

  const { data: program } = await sb
    .from("programs")
    .select("id, name, start_date, end_date, status, department_id")
    .eq("organization_id", ORG_ID)
    .eq("department_id", department.id)
    .ilike("name", PROGRAM_NAME)
    .maybeSingle()
  if (!program) throw new Error(`Program not found: ${PROGRAM_NAME}`)

  report.department = department
  report.program = program

  const offerings = await ensureOfferings(sb, program, execute, report)
  const families = buildFamilies(masterRows, subRows, report.skippedByRule)
  attachPayments(families, payRows, report)

  for (const family of families.values()) {
    allocateTuitionPaid(family)
  }

  report.staffFamilies = [...families.values()]
    .filter((family) => family.discountKind === "staff")
    .map((family) => ({
      parent: family.parentName,
      children: family.children.map((c) => c.participantName),
      due: round2(
        family.children.reduce((sum, child) => sum + child.totalAmount, 0)
      ),
      paid: family.tuitionPaid,
      addons: family.addonTotal,
    }))
  report.fullPayFamilies = [...families.values()]
    .filter((family) => family.discountKind === "full_pay")
    .map((family) => ({
      parent: family.parentName,
      children: family.children.map((c) => c.participantName),
      due: round2(
        family.children.reduce((sum, child) => sum + child.totalAmount, 0)
      ),
      paid: family.tuitionPaid,
      extraVsList: round2((family.tuitionPaid || 0) - listTuitionForCount(family.children.length)),
      subscriptionPaidNotTuition: family.masterSubscriptionPaid,
    }))

  const contactCache = new Map()
  const phoneIndex = await loadPhoneIndex(sb)
  const emailIndex = await loadEmailIndex(sb)

  for (const family of families.values()) {
    if (!family.parentEmail && !family.parentPhone && !family.parentName) {
      for (const child of family.children) {
        report.skippedNoParent.push(child.participantName)
      }
      continue
    }

    try {
      const parentContact = await ensureParentContact(
        sb,
        {
          name: family.parentName,
          email: family.parentEmail,
          phone: family.parentPhone,
          address: family.parentAddress,
          childName: family.children[0]?.participantName,
        },
        execute,
        contactCache,
        phoneIndex,
        emailIndex,
        report
      )

      const parentPersonId = await ensureParentPerson(sb, parentContact, execute)

      for (const child of family.children) {
        const offeringKey = norm(child.offering).toLowerCase()
        const offering = offerings.get(offeringKey)
        if (!offering) {
          report.skippedNoOffering.push({
            child: child.participantName,
            offering: child.offering,
          })
          continue
        }

        const notes = [
          `Imported ${IMPORT_TAG}`,
          `Import key: ${child.key}`,
          child.relation ? `Relation: ${child.relation}` : null,
          child.allergies ? `Allergies: ${child.allergies}` : null,
          child.photoConsent ? `Photo consent: ${child.photoConsent}` : null,
          child.siblingIndex > 0 ? `Sibling discount applied (5%)` : null,
          family.discountKind === "staff" ? "Staff discount (50%)" : null,
          family.discountKind === "full_pay"
            ? "Full payment discount (3%)"
            : null,
          family.masterSubscriptionPaid > 0.009
            ? `Subscription paid (not tuition): $${family.masterSubscriptionPaid.toFixed(2)}`
            : null,
          family.subscription
            ? `Payment plan: ${family.subscription.recurringType} $${child.planInstallment} × ${child.planCount}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")

        let existing = null
        if (execute) {
          const { data: byNotes } = await sb
            .from("program_enrollments")
            .select("id, charge_id, amount_paid, total_amount")
            .eq("organization_id", ORG_ID)
            .eq("offering_id", offering.id)
            .ilike("notes", `%Import key: ${child.key}%`)
            .limit(1)
            .maybeSingle()
          existing = byNotes
        }

        if (existing?.id) {
          report.skippedExisting += 1
          child.enrollmentId = existing.id
          child.chargeId = existing.charge_id

          // Enrollments from the first pass may lack plans (org_id insert failed).
          if (child.planCount > 0) {
            const planResult = await upsertEnrollmentPaymentPlans(sb, {
              enrollmentId: existing.id,
              startDate:
                family.subscription.startDate ||
                program.start_date ||
                "2026-09-01",
              planCount: child.planCount,
              planInstallment: child.planInstallment,
              totalAmount: child.totalAmount,
              amountPaid: child.amountPaid,
            })
            if (planResult.error) {
              report.errors.push({
                family: family.key,
                error: `plans ${child.participantName}: ${planResult.error}`,
              })
            } else if (planResult.created) {
              report.createdPlans += 1
            }
          }
          continue
        }

        const childPersonId = await ensureChildPerson(
          sb,
          {
            name: child.participantName,
            dob: child.dob,
            gender: child.gender,
          },
          parentPersonId,
          execute
        )
        if (execute && !String(childPersonId).startsWith("dry-run:")) {
          report.createdPeople += 1
        }

        const age = (() => {
          if (!child.dob) return null
          const born = new Date(`${child.dob}T00:00:00`)
          const asOf = new Date("2026-09-06T00:00:00")
          let years = asOf.getFullYear() - born.getFullYear()
          const m = asOf.getMonth() - born.getMonth()
          if (m < 0 || (m === 0 && asOf.getDate() < born.getDate())) years -= 1
          return years
        })()

        const paymentStatus = resolvePaymentStatus(
          child.totalAmount,
          child.amountPaid
        )

        if (!execute) {
          report.createdEnrollments += 1
          if (child.planCount > 0) report.createdPlans += 1
          report.createdCharges += 1
          if (report.samples.length < 20) {
            report.samples.push({
              child: child.participantName,
              offering: child.offering,
              parent: parentContact.full_name,
              parentEmail: parentContact.email,
              monthlyFee: child.monthlyFee,
              totalAmount: child.totalAmount,
              amountPaid: child.amountPaid,
              discountKind: family.discountKind,
              paymentStatus,
              planInstallment: child.planInstallment,
              planCount: child.planCount,
            })
          }
          continue
        }

        const payload = {
          organization_id: ORG_ID,
          program_id: program.id,
          offering_id: offering.id,
          department_id: department.id,
          child_name: child.participantName,
          child_person_id: childPersonId,
          child_age: age,
          participant_contact_id: null,
          registrant_contact_id: parentContact.id,
          payer_contact_id: parentContact.id,
          status: "enrolled",
          payment_status: paymentStatus,
          total_amount: child.totalAmount,
          amount_paid: child.amountPaid,
          enrollment_date: child.enrollmentDate,
          participant_type: "youth",
          registrant_type: "guardian",
          parent_name: parentContact.full_name,
          parent_email: parentContact.email || null,
          parent_phone: parentContact.phone || null,
          notes,
        }

        let enrollment
        try {
          enrollment = await must(
            `enrollment ${child.participantName}`,
            sb.from("program_enrollments").insert(payload).select("id").single()
          )
        } catch (err) {
          if (/unique constraint|duplicate key/i.test(String(err.message))) {
            report.skippedExisting += 1
            continue
          }
          throw err
        }

        child.enrollmentId = enrollment.id
        report.createdEnrollments += 1

        const firstPaidIso =
          family.payments.find((p) => p.amount > 0 && p.iso)?.iso ||
          (child.enrollmentDate ? `${child.enrollmentDate}T17:00:00.000Z` : null)

        const discountLines = child.discountLines || []
        const discountTotal = round2(
          discountLines.reduce((sum, line) => sum + line.amount, 0)
        )
        const listTotal = BASE_FEE

        const charge = await must(
          `charge ${child.participantName}`,
          sb
            .from("program_charges")
            .insert({
              organization_id: ORG_ID,
              enrollment_id: enrollment.id,
              charge_type: "registration",
              source_type: "manual",
              payer_contact_id: parentContact.id,
              registrant_contact_id: parentContact.id,
              participant_contact_id: null,
              program_id: program.id,
              offering_id: offering.id,
              currency: "USD",
              subtotal: listTotal,
              discount_total: discountTotal,
              total: child.totalAmount,
              due_today: Math.max(
                round2(child.totalAmount - child.amountPaid),
                0
              ),
              amount_paid: child.amountPaid,
              payment_required: child.totalAmount > 0,
              charge_status: resolveChargeStatus(
                child.totalAmount,
                child.amountPaid
              ),
              checkout_status:
                child.amountPaid > 0 || child.totalAmount <= 0
                  ? "paid"
                  : "not_started",
              paid_at: child.amountPaid > 0 ? firstPaidIso : null,
              metadata: {
                import_tag: IMPORT_TAG,
                import_key: child.key,
                registration_fee: child.monthlyFee,
                plan_installment: child.planInstallment,
                plan_count: child.planCount,
                sibling_index: child.siblingIndex,
                discount_kind: family.discountKind,
              },
              quote_snapshot: { import: IMPORT_TAG },
            })
            .select("id")
            .single()
        )

        child.chargeId = charge.id
        report.createdCharges += 1

        await sb
          .from("program_enrollments")
          .update({ charge_id: charge.id, amount_paid: child.amountPaid })
          .eq("id", enrollment.id)
          .eq("organization_id", ORG_ID)

        const lines = [
          {
            organization_id: ORG_ID,
            charge_id: charge.id,
            line_type: "tuition",
            label: `${child.offering} registration`,
            quantity: 1,
            unit_amount: listTotal,
            amount: listTotal,
            sort_order: 0,
          },
        ]
        discountLines.forEach((line, index) => {
          if (line.amount <= 0.009) return
          lines.push({
            organization_id: ORG_ID,
            charge_id: charge.id,
            line_type: line.lineType,
            label: line.label,
            quantity: 1,
            unit_amount: -line.amount,
            amount: -line.amount,
            sort_order: index + 1,
            metadata: { import_tag: IMPORT_TAG },
          })
        })
        await sb.from("program_charge_lines").insert(lines)

        if (child.planCount > 0) {
          const planResult = await upsertEnrollmentPaymentPlans(sb, {
            enrollmentId: enrollment.id,
            startDate:
              family.subscription.startDate ||
              program.start_date ||
              "2026-09-01",
            planCount: child.planCount,
            planInstallment: child.planInstallment,
            totalAmount: child.totalAmount,
            amountPaid: child.amountPaid,
          })
          if (planResult.error) {
            throw new Error(
              `plans ${child.participantName}: ${planResult.error}`
            )
          }
          if (planResult.created) report.createdPlans += 1
        }

        try {
          await sb.rpc("sync_contact_affiliations", {
            p_organization_id: ORG_ID,
            p_contact_id: parentContact.id,
          })
        } catch (err) {
          console.warn(
            `affiliation sync warn ${parentContact.id}: ${
              err instanceof Error ? err.message : err
            }`
          )
        }

        if (report.samples.length < 20) {
          report.samples.push({
            child: child.participantName,
            enrollmentId: enrollment.id,
            offering: child.offering,
            parent: parentContact.full_name,
            monthlyFee: child.monthlyFee,
            totalAmount: child.totalAmount,
            amountPaid: child.amountPaid,
          })
        }
      }

      const addonAmount = round2(family.addonTotal || 0)
      if (addonAmount > 0.009) {
        if (!execute) {
          report.createdAddonCharges += 1
        } else {
          const host = family.children.find((c) => c.enrollmentId)
          if (host?.enrollmentId) {
            const addonKey = `${IMPORT_TAG}:txn:${family.key}`
            const { data: existingAddon } = await sb
              .from("program_charges")
              .select("id")
              .eq("organization_id", ORG_ID)
              .eq("enrollment_id", host.enrollmentId)
              .eq("charge_type", "addon")
              .contains("metadata", { import_key: addonKey })
              .maybeSingle()
            if (!existingAddon) {
              const addonPaidAt =
                family.addonPayments.find((p) => p.iso)?.iso ||
                family.payments.find((p) => p.amount > 0 && p.iso)?.iso ||
                null
              const qty =
                family.children.length > 1 &&
                approxEqual(addonAmount, family.children.length * TXN_FEE)
                  ? family.children.length
                  : family.children.length > 1 &&
                      approxEqual(
                        addonAmount,
                        family.children.length * (TXN_FEE / 2)
                      )
                    ? family.children.length
                    : 1
              const addonCharge = await must(
                `addon fee ${family.parentEmail || family.parentPhone}`,
                sb
                  .from("program_charges")
                  .insert({
                    organization_id: ORG_ID,
                    enrollment_id: host.enrollmentId,
                    charge_type: "addon",
                    source_type: "manual",
                    payer_contact_id: parentContact.id,
                    registrant_contact_id: parentContact.id,
                    program_id: program.id,
                    offering_id: offerings.get(
                      norm(host.offering).toLowerCase()
                    )?.id,
                    currency: "USD",
                    subtotal: addonAmount,
                    discount_total: 0,
                    total: addonAmount,
                    due_today: 0,
                    amount_paid: addonAmount,
                    payment_required: true,
                    charge_status: "paid",
                    checkout_status: "paid",
                    paid_at: addonPaidAt,
                    metadata: {
                      import_tag: IMPORT_TAG,
                      import_key: addonKey,
                      label: "Transaction fee",
                      staff_half: family.discountKind === "staff",
                    },
                    quote_snapshot: {
                      import: IMPORT_TAG,
                      type: "transaction_fee",
                    },
                  })
                  .select("id")
                  .single()
              )
              await sb.from("program_charge_lines").insert({
                organization_id: ORG_ID,
                charge_id: addonCharge.id,
                line_type: "addon",
                label: "Transaction fee",
                quantity: qty,
                unit_amount: round2(addonAmount / qty),
                amount: addonAmount,
                sort_order: 0,
                metadata: {
                  import_tag: IMPORT_TAG,
                  addon_kind: "transaction_fee",
                },
              })
              report.createdAddonCharges += 1
            }
          }
        }
      }
    } catch (err) {
      report.errors.push({
        family: family.key,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  report.familyCount = families.size
  report.childCount = [...families.values()].reduce(
    (s, f) => s + f.children.length,
    0
  )

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const outPath = resolve(
    reportsDir,
    `sunday-school-2026-2027-${execute ? "execute" : "dry-run"}-${stamp}.json`
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        report: outPath,
        families: report.familyCount,
        children: report.childCount,
        createdContacts: report.createdContacts,
        reusedContacts: report.reusedContacts,
        createdOfferings: report.createdOfferings,
        createdEnrollments: report.createdEnrollments,
        skippedExisting: report.skippedExisting,
        createdCharges: report.createdCharges,
        createdAddonCharges: report.createdAddonCharges,
        createdPlans: report.createdPlans,
        unmatchedPayments: report.unmatchedPayments,
        skippedNoOffering: report.skippedNoOffering.length,
        skippedNoParent: report.skippedNoParent.length,
        skippedByRule: report.skippedByRule.length,
        errors: report.errors.length,
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
