/**
 * Import QLH (Education) year registrations from QLH_Registrations.xlsx.
 *
 * Maps Year → existing programs "QLH 2024-2025" / "QLH 2025-2026",
 * creates a default offering per year, parents from emergency-contact email,
 * minors as people under parents, enrollments with child_person_id.
 *
 * Usage:
 *   node scripts/import-qlh-registrations.mjs
 *   node scripts/import-qlh-registrations.mjs --xlsx "C:/Users/danan/Downloads/QLH_Registrations.xlsx"
 *   node scripts/import-qlh-registrations.mjs --execute
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

const IMPORT_TAG = "QLH_REGISTRATIONS_V1"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_XLSX = "C:/Users/danan/Downloads/QLH_Registrations.xlsx"
const DEPARTMENT_NAME = "Education"
const OFFERING_NAME = "QLH Registration"

const YEAR_TO_PROGRAM = {
  "qlh 2024-2025": "QLH 2024-2025",
  "qlh 2025-2026": "QLH 2025-2026",
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
  if (parts.length === 0) return { first: "Participant", last: "QLH" }
  if (parts.length === 1) return { first: parts[0], last: "Participant" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

function excelSerialToIso(serial) {
  const n = Number(serial)
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null
  // Excel epoch 1899-12-30
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
  return date.toISOString().slice(0, 10)
}

function parseDob(row) {
  const text = norm(row["Date of Birth_1"] || row["Date of Birth"])
  if (text) {
    const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
    if (mdy) {
      let a = Number(mdy[1])
      let b = Number(mdy[2])
      const yyyy = Number(mdy[3])
      // Prefer MM/DD; if first > 12 treat as DD/MM
      let mm = a
      let dd = b
      if (a > 12 && b >= 1 && b <= 12) {
        dd = a
        mm = b
      }
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yyyy >= 1990 && yyyy <= 2030) {
        // Reject impossible calendar dates via Date round-trip
        const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
        const check = new Date(`${iso}T12:00:00Z`)
        if (
          !Number.isNaN(check.getTime()) &&
          check.getUTCFullYear() === yyyy &&
          check.getUTCMonth() + 1 === mm &&
          check.getUTCDate() === dd
        ) {
          return iso
        }
      }
    }
  }
  if (row["Date of Birth"] != null && row["Date of Birth"] !== "") {
    const iso = excelSerialToIso(row["Date of Birth"])
    if (iso) return iso
  }
  return null
}

function parseRegistrationDate(value) {
  const text = norm(value)
  if (!text) return null
  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function normalizeGender(value) {
  const raw = norm(value).toLowerCase()
  if (!raw) return null
  if (raw.startsWith("f")) return "Female"
  if (raw.startsWith("m")) return "Male"
  return null
}

function ageYears(dob) {
  if (!dob) return null
  const birth = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

function parseEmergencyBlob(raw) {
  const text = norm(raw)
  if (!text || text === ", ," || text === ",,") return null
  const parts = text.split(",").map((p) => p.trim())
  let phone = null
  let email = null
  const addressParts = []
  for (const part of parts) {
    if (!part || part.toLowerCase() === "undefined") continue
    if (!phone && digitsPhone(part)) {
      phone = formatPhone(digitsPhone(part))
      continue
    }
    if (!email && part.includes("@")) {
      email = normEmail(part)
      continue
    }
    addressParts.push(part)
  }
  const address = addressParts.join(", ").trim() || null
  if (!phone && !email && !address) return null
  return { phone, email, address }
}

function displayNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || ""
  const cleaned = local.replace(/[._+\-]+/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned || cleaned.length < 2) return null
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

function parentDisplayName({ name, email, phone, childName }) {
  if (norm(name)) return norm(name)
  const fromEmail = displayNameFromEmail(email)
  if (fromEmail) return fromEmail
  const childLast = splitName(childName || "").last
  if (childLast && childLast !== "Participant") return `${childLast} Parent`
  if (phone) return `Parent ${phone}`
  return "QLH Parent"
}

function importKey(row) {
  return createHash("sha256")
    .update(
      [
        IMPORT_TAG,
        norm(row.year),
        normName(row.memberName),
        row.dob || "",
        row.parentEmail || "",
        digitsPhone(row.parentPhone) || "",
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

async function ensureDefaultOffering(sb, program, execute) {
  const { data: existing } = await sb
    .from("program_offerings")
    .select("id, name, program_id")
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)
    .eq("name", OFFERING_NAME)
    .maybeSingle()
  if (existing) return existing
  if (!execute) {
    return { id: `dry-run:offering:${program.id}`, name: OFFERING_NAME, program_id: program.id }
  }
  const { data, error } = await sb
    .from("program_offerings")
    .insert({
      organization_id: ORG_ID,
      program_id: program.id,
      name: OFFERING_NAME,
      is_default: true,
      offering_type: "academic_year",
      start_date: program.start_date,
      end_date: program.end_date,
      enrollment_open_date: program.start_date,
      enrollment_close_date: program.end_date,
      status: "closed",
    })
    .select("id, name, program_id")
    .single()
  if (error) throw new Error(`offering create (${program.name}): ${error.message}`)
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

async function ensureParentContact(sb, parent, execute, cache, phoneIndex) {
  const email = parent.email
  const phoneDigits = digitsPhone(parent.phone)
  const cacheKey = email
    ? `email:${email}`
    : phoneDigits
      ? `phone:${phoneDigits}`
      : `name:${normName(parent.name || "Parent")}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  if (email) {
    const { data: byEmail } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, person_id, address")
      .eq("organization_id", ORG_ID)
      .ilike("email", email)
      .limit(1)
      .maybeSingle()
    if (byEmail) {
      cache.set(cacheKey, byEmail)
      const existingPhone = digitsPhone(byEmail.phone) || phoneDigits
      if (existingPhone) phoneIndex?.set(existingPhone, byEmail)
      return byEmail
    }
  }

  if (phoneDigits && phoneIndex?.has(phoneDigits)) {
    const byPhone = phoneIndex.get(phoneDigits)
    cache.set(cacheKey, byPhone)
    return byPhone
  }

  const fullName = parentDisplayName(parent)
  if (!execute) {
    const placeholder = {
      id: `dry-run:contact:${cacheKey}`,
      full_name: fullName,
      email: email || null,
      phone: parent.phone || null,
      person_id: null,
    }
    cache.set(cacheKey, placeholder)
    if (phoneDigits) phoneIndex?.set(phoneDigits, placeholder)
    return placeholder
  }

  const insert = {
    organization_id: ORG_ID,
    full_name: fullName,
    email: email || null,
    phone: parent.phone || null,
    address: parent.address || null,
    contact_type: "individual",
    status: "active",
  }
  const { data, error } = await sb
    .from("contacts")
    .insert(insert)
    .select("id, full_name, email, phone, person_id, address")
    .single()
  if (error) throw new Error(`contact create (${fullName}): ${error.message}`)
  cache.set(cacheKey, data)
  if (phoneDigits) phoneIndex?.set(phoneDigits, data)
  return data
}

async function ensureParentPerson(sb, contact, execute) {
  if (contact.person_id) return contact.person_id
  if (!execute || String(contact.id).startsWith("dry-run:")) return `dry-run:person:${contact.id}`

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
  if (!execute) return `dry-run:child:${normName(child.name)}`

  // Prefer existing child under this parent with same name
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
      const match = (people || []).find(
        (p) => normName(`${p.first_name} ${p.last_name}`) === normName(child.name)
      )
      if (match) {
        const patch = {}
        if (child.dob && !match.date_of_birth) patch.date_of_birth = child.dob
        if (child.gender && !match.gender) patch.gender = child.gender
        if (Object.keys(patch).length > 0) {
          await sb.from("people").update(patch).eq("id", match.id).eq("organization_id", ORG_ID)
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
        date_of_birth: child.dob,
        gender: child.gender,
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

  return created.id
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const xlsxPath = argValue("--xlsx") || DEFAULT_XLSX
  if (!existsSync(xlsxPath)) throw new Error(`File not found: ${xlsxPath}`)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const wb = XLSX.readFile(xlsxPath)
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("qlh")) || wb.SheetNames[0]
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" })

  const { data: department } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .ilike("name", DEPARTMENT_NAME)
    .maybeSingle()
  if (!department) throw new Error(`Department not found: ${DEPARTMENT_NAME}`)

  const { data: programs } = await sb
    .from("programs")
    .select("id, name, start_date, end_date, department_id, status")
    .eq("organization_id", ORG_ID)
    .eq("department_id", department.id)

  const programByName = new Map((programs || []).map((p) => [norm(p.name).toLowerCase(), p]))
  const offeringByProgramId = new Map()
  for (const program of programs || []) {
    offeringByProgramId.set(program.id, await ensureDefaultOffering(sb, program, execute))
  }

  const report = {
    mode: execute ? "execute" : "dry-run",
    xlsxPath,
    sheetName,
    rawRows: rawRows.length,
    department,
    byYear: {},
    createdContacts: 0,
    reusedContacts: 0,
    createdPeople: 0,
    createdEnrollments: 0,
    skippedExisting: 0,
    skippedNoProgram: [],
    skippedNoParent: [],
    errors: [],
    samples: [],
  }

  const contactCache = new Map()
  const phoneIndex = await loadPhoneIndex(sb)
  const seenKeys = new Set()

  for (const raw of rawRows) {
    const yearLabel = norm(raw.Year)
    const programName = YEAR_TO_PROGRAM[yearLabel.toLowerCase()]
    const program = programName ? programByName.get(programName.toLowerCase()) : null
    if (!program) {
      report.skippedNoProgram.push({ year: yearLabel, member: norm(raw["Member Name"]) })
      continue
    }

    const yearKey = program.name
    if (!report.byYear[yearKey]) {
      report.byYear[yearKey] = { rows: 0, enrolled: 0, skipped: 0 }
    }
    report.byYear[yearKey].rows += 1

    const memberName = norm(raw["Member Name"])
    if (!memberName) {
      report.byYear[yearKey].skipped += 1
      continue
    }

    const ec1 = parseEmergencyBlob(raw["Emergency Contact Details 1"])
    const ec2 = parseEmergencyBlob(raw["Emergency Contact Details 2"])
    const parentEmail =
      normEmail(raw["Parent Email"]) || ec1?.email || ec2?.email || null
    const parentPhone =
      formatPhone(digitsPhone(raw["Parent Contact Number"])) ||
      ec1?.phone ||
      ec2?.phone ||
      null
    const parentName = norm(raw["Parent Name"]) || null
    const dob = parseDob(raw)
    const gender = normalizeGender(raw.Gender)
    const enrollmentDate =
      parseRegistrationDate(raw["Registration Date"]) || program.start_date
    const age = ageYears(dob)

    if (!parentEmail && !parentName && !parentPhone) {
      // Adult self-registration fallback when no parent fields
      if (age != null && age >= 18) {
        // treat member as adult contact participant
      } else {
        report.skippedNoParent.push({ year: yearLabel, member: memberName })
        report.byYear[yearKey].skipped += 1
        continue
      }
    }

    const row = {
      year: yearLabel,
      memberName,
      dob,
      gender,
      parentEmail,
      parentPhone,
      parentName,
      parentAddress: ec1?.address || ec2?.address || null,
      enrollmentDate,
      age,
      relation: norm(raw.Relation),
    }
    const key = importKey(row)
    if (seenKeys.has(key)) {
      report.byYear[yearKey].skipped += 1
      continue
    }
    seenKeys.add(key)

    const offering = offeringByProgramId.get(program.id)
    const isAdultSelf = !parentEmail && !parentName && !parentPhone && age != null && age >= 18

    try {
      let parentContact
      if (isAdultSelf) {
        parentContact = await ensureParentContact(
          sb,
          {
            name: memberName,
            email: ec1?.email || null,
            phone: parentPhone || ec1?.phone || null,
            address: row.parentAddress,
            childName: memberName,
          },
          execute,
          contactCache,
          phoneIndex
        )
      } else {
        parentContact = await ensureParentContact(
          sb,
          {
            name: parentName,
            email: parentEmail,
            phone: parentPhone,
            address: row.parentAddress,
            childName: memberName,
          },
          execute,
          contactCache,
          phoneIndex
        )
      }

      // Track create vs reuse via cache miss on first ensure — refine:
      if (execute && !String(parentContact.id).startsWith("dry-run:")) {
        // filled after ensure; count once per unique contact in report at end
      }

      const parentPersonId = await ensureParentPerson(sb, parentContact, execute)

      let childPersonId = null
      let participantContactId = null
      if (isAdultSelf) {
        participantContactId = parentContact.id
      } else {
        childPersonId = await ensureChildPerson(
          sb,
          { name: memberName, dob, gender },
          parentPersonId,
          execute
        )
        if (execute && !String(childPersonId).startsWith("dry-run:")) {
          report.createdPeople += 1
        }
      }

      const notes = [
        `Imported ${IMPORT_TAG}`,
        `Source year: ${yearLabel}`,
        row.relation ? `Relation: ${row.relation}` : null,
        `Import key: ${key}`,
      ]
        .filter(Boolean)
        .join("\n")

      // Idempotent: match by notes import key or child+offering
      let existing = null
      if (execute) {
        const { data: byNotes } = await sb
          .from("program_enrollments")
          .select("id")
          .eq("organization_id", ORG_ID)
          .eq("offering_id", offering.id)
          .ilike("notes", `%Import key: ${key}%`)
          .limit(1)
          .maybeSingle()
        existing = byNotes
        if (!existing && childPersonId) {
          const { data: byChild } = await sb
            .from("program_enrollments")
            .select("id")
            .eq("organization_id", ORG_ID)
            .eq("offering_id", offering.id)
            .eq("child_person_id", childPersonId)
            .is("end_date", null)
            .limit(1)
            .maybeSingle()
          existing = byChild
        }
      }

      if (existing?.id) {
        report.skippedExisting += 1
        report.byYear[yearKey].skipped += 1
        continue
      }

      if (!execute) {
        report.createdEnrollments += 1
        report.byYear[yearKey].enrolled += 1
        if (report.samples.length < 12) {
          report.samples.push({
            year: yearLabel,
            member: memberName,
            parent: parentContact.full_name,
            parentEmail: parentContact.email,
            dob,
            gender,
            enrollmentDate,
          })
        }
        continue
      }

      const payload = {
        organization_id: ORG_ID,
        program_id: program.id,
        offering_id: offering.id,
        department_id: department.id,
        child_name: memberName,
        child_person_id: childPersonId,
        child_age: age,
        participant_contact_id: participantContactId,
        registrant_contact_id: parentContact.id,
        payer_contact_id: parentContact.id,
        status: "enrolled",
        payment_status: "paid",
        total_amount: 0,
        amount_paid: 0,
        enrollment_date: enrollmentDate,
        participant_type: isAdultSelf ? "adult" : "youth",
        registrant_type: isAdultSelf ? "adult_self" : "guardian",
        parent_name: parentContact.full_name,
        parent_email: parentContact.email || null,
        parent_phone: parentContact.phone || null,
        notes,
      }

      const { data: enrollment, error } = await sb
        .from("program_enrollments")
        .insert(payload)
        .select("id")
        .single()
      if (error) {
        if (/unique constraint|duplicate key/i.test(error.message)) {
          report.skippedExisting += 1
          report.byYear[yearKey].skipped += 1
          continue
        }
        throw new Error(error.message)
      }

      report.createdEnrollments += 1
      report.byYear[yearKey].enrolled += 1

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

      if (report.samples.length < 12) {
        report.samples.push({
          year: yearLabel,
          member: memberName,
          enrollmentId: enrollment.id,
          parent: parentContact.full_name,
          parentEmail: parentContact.email,
        })
      }
    } catch (err) {
      report.errors.push({
        member: memberName,
        year: yearLabel,
        error: err instanceof Error ? err.message : String(err),
      })
      report.byYear[yearKey].skipped += 1
    }
  }

  // Contact create/reuse counts from cache size vs matched emails is approximate
  report.uniqueParents = contactCache.size

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = resolve(reportsDir, `import-qlh-registrations-${stamp}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        sheetName: report.sheetName,
        rawRows: report.rawRows,
        byYear: report.byYear,
        uniqueParents: report.uniqueParents,
        createdEnrollments: report.createdEnrollments,
        skippedExisting: report.skippedExisting,
        skippedNoParent: report.skippedNoParent.length,
        skippedNoProgram: report.skippedNoProgram.length,
        errors: report.errors.length,
        report: outPath,
        samples: report.samples,
        skippedNoParentSample: report.skippedNoParent.slice(0, 10),
        errorSample: report.errors.slice(0, 5),
      },
      null,
      2
    )
  )

  if (execute) {
    console.log(
      "\nNext: node scripts/sync-summer-camp-households.mjs --all-parents --execute"
    )
    console.log(
      "(or a QLH-specific household sync) to fold kids into parent households."
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
