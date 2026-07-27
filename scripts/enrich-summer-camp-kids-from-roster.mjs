/**
 * Enrich Summer Camp 2026 kids from the registration roster CSV:
 * DOB, gender, upcoming grade → people (+ child_age on enrollments).
 *
 * Only fills empty fields (does not overwrite existing values).
 *
 * Prerequisites:
 *   - Prefer running scripts/198_people_grade.sql first (for grade).
 *
 * Usage:
 *   node scripts/enrich-summer-camp-kids-from-roster.mjs
 *   node scripts/enrich-summer-camp-kids-from-roster.mjs --execute
 *   node scripts/enrich-summer-camp-kids-from-roster.mjs --csv "C:/Users/danan/Downloads/Summer Camp 2026.csv" --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "e6436c28-666c-4327-b3c1-4234d2379a42"
const DEFAULT_CSV = "C:/Users/danan/Downloads/Summer Camp 2026.csv"

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

function normName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normEmail(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
}

function parseDob(value) {
  const raw = String(value || "").trim()
  if (!raw) return null
  // M/D/YYYY or MM/DD/YYYY
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const month = Number(m[1])
    const day = Number(m[2])
    const year = Number(m[3])
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2026) {
      return null
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  const iso = new Date(raw)
  if (Number.isNaN(iso.getTime())) return null
  return iso.toISOString().slice(0, 10)
}

function normalizeGender(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (!raw) return null
  if (raw.startsWith("f")) return "Female"
  if (raw.startsWith("m")) return "Male"
  return null
}

function normalizeGrade(value) {
  const raw = String(value || "").trim()
  if (!raw) return null
  const lower = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ")

  const aliases = {
    pk: "Pre-K",
    "pre-k": "Pre-K",
    prek: "Pre-K",
    "pre k": "Pre-K",
    k: "Kindergarten",
    kg: "Kindergarten",
    kinder: "Kindergarten",
    kindergarten: "Kindergarten",
  }
  if (aliases[lower]) return aliases[lower]

  // Keep band labels like "1st - 3rd" as-is (camp registration groups).
  if (lower.includes("-") || lower.includes("to")) {
    return raw.replace(/\s+/g, " ").trim()
  }

  const nth = lower.match(/^(\d+)(st|nd|rd|th)?(\s*grade)?$/)
  if (nth) {
    const n = Number(nth[1])
    if (n >= 1 && n <= 12) {
      const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"
      return `${n}${suffix} Grade`
    }
  }

  return raw
}

function ageYearsFromDob(dob) {
  if (!dob) return null
  const birth = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age < 130 ? age : null
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function probeHasGradeColumn(sb) {
  const { error } = await sb.from("people").select("grade").eq("organization_id", ORG_ID).limit(1)
  if (!error) return true
  const msg = (error.message || "").toLowerCase()
  if (msg.includes("grade") && (msg.includes("does not exist") || error.code === "42703" || error.code === "PGRST204")) {
    return false
  }
  // Unexpected — treat as missing to avoid breaking DOB/gender path
  console.warn(`grade probe warning: ${error.message}`)
  return false
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const csvPath = argValue("--csv") || DEFAULT_CSV

  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const hasGrade = await probeHasGradeColumn(sb)
  if (!hasGrade) {
    console.warn(
      "people.grade column missing — run scripts/198_people_grade.sql to store grades. Continuing with DOB/gender only."
    )
  }

  const text = readFileSync(csvPath, "utf8")
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (parsed.errors?.length) {
    console.warn(`CSV parse warnings: ${parsed.errors.length}`)
  }

  const rosterRows = []
  for (const row of parsed.data || []) {
    const childName = String(row["Child Name"] || "").trim()
    if (!childName) continue
    rosterRows.push({
      childName,
      childKey: normName(childName),
      parentName: String(row["Parent Name"] || "").trim(),
      parentEmail: normEmail(row["Parent Email"]),
      parentPhone: String(row["Parent Contact Number"] || "").trim(),
      gender: normalizeGender(row["Gender"]),
      dob: parseDob(row["Date of Birth"]),
      relation: String(row["Relation"] || "").trim(),
      grade: normalizeGrade(row["Upcoming Grade Level (2026-2027)"]),
    })
  }

  const enrollments = await must(
    "enrollments",
    sb
      .from("program_enrollments")
      .select(
        "id, child_person_id, child_name, child_age, registrant_contact_id, participant_contact_id, status"
      )
      .eq("organization_id", ORG_ID)
      .eq("program_id", PROGRAM_ID)
      .not("status", "in", "(cancelled,withdrawn,transferred)")
  )

  const registrantIds = [
    ...new Set(
      (enrollments || [])
        .map((e) => e.registrant_contact_id || e.participant_contact_id)
        .filter(Boolean)
    ),
  ]
  const contactsById = new Map()
  for (let i = 0; i < registrantIds.length; i += 100) {
    const chunk = registrantIds.slice(i, i + 100)
    const rows = await must(
      "contacts",
      sb
        .from("contacts")
        .select("id, email, full_name, phone")
        .eq("organization_id", ORG_ID)
        .in("id", chunk)
    )
    for (const row of rows || []) contactsById.set(row.id, row)
  }

  const personIds = [
    ...new Set((enrollments || []).map((e) => e.child_person_id).filter(Boolean)),
  ]
  const peopleById = new Map()
  const peopleSelect = hasGrade
    ? "id, first_name, last_name, date_of_birth, gender, grade"
    : "id, first_name, last_name, date_of_birth, gender"
  for (let i = 0; i < personIds.length; i += 100) {
    const chunk = personIds.slice(i, i + 100)
    const rows = await must(
      "people",
      sb.from("people").select(peopleSelect).eq("organization_id", ORG_ID).in("id", chunk)
    )
    for (const row of rows || []) peopleById.set(row.id, row)
  }

  // Index enrollments for matching
  const byEmailChild = new Map()
  const byChildOnly = new Map()
  for (const enrollment of enrollments || []) {
    const personId = enrollment.child_person_id
    if (!personId) continue
    const person = peopleById.get(personId)
    const childName =
      enrollment.child_name ||
      `${person?.first_name || ""} ${person?.last_name || ""}`.trim()
    const childKey = normName(childName)
    if (!childKey) continue

    const contactId = enrollment.registrant_contact_id || enrollment.participant_contact_id
    const email = normEmail(contactsById.get(contactId)?.email)
    if (email) {
      const key = `${email}::${childKey}`
      if (!byEmailChild.has(key)) byEmailChild.set(key, [])
      byEmailChild.get(key).push(enrollment)
    }
    if (!byChildOnly.has(childKey)) byChildOnly.set(childKey, [])
    byChildOnly.get(childKey).push(enrollment)
  }

  const report = {
    mode: execute ? "execute" : "dry-run",
    csvPath,
    hasGradeColumn: hasGrade,
    rosterRows: rosterRows.length,
    enrollments: (enrollments || []).length,
    matched: 0,
    unmatched: [],
    ambiguous: [],
    wouldUpdatePeople: 0,
    updatedPeople: 0,
    wouldUpdateEnrollments: 0,
    updatedEnrollments: 0,
    fieldFills: { dob: 0, gender: 0, grade: 0, child_age: 0 },
    samples: [],
  }

  const touchedPeople = new Set()

  for (const roster of rosterRows) {
    let candidates = []
    if (roster.parentEmail) {
      candidates = byEmailChild.get(`${roster.parentEmail}::${roster.childKey}`) || []
    }
    if (candidates.length === 0) {
      candidates = byChildOnly.get(roster.childKey) || []
    }

    // Unique person ids among candidates
    const byPerson = new Map()
    for (const enrollment of candidates) {
      if (!enrollment.child_person_id) continue
      if (!byPerson.has(enrollment.child_person_id)) {
        byPerson.set(enrollment.child_person_id, [])
      }
      byPerson.get(enrollment.child_person_id).push(enrollment)
    }

    if (byPerson.size === 0) {
      report.unmatched.push({
        child: roster.childName,
        parentEmail: roster.parentEmail || null,
      })
      continue
    }
    if (byPerson.size > 1) {
      report.ambiguous.push({
        child: roster.childName,
        parentEmail: roster.parentEmail || null,
        personIds: [...byPerson.keys()],
      })
      continue
    }

    const [personId, personEnrollments] = [...byPerson.entries()][0]
    const person = peopleById.get(personId)
    if (!person) {
      report.unmatched.push({
        child: roster.childName,
        parentEmail: roster.parentEmail || null,
        reason: "person missing",
      })
      continue
    }

    report.matched += 1

    const personPatch = {}
    if (roster.dob && !person.date_of_birth) {
      personPatch.date_of_birth = roster.dob
      report.fieldFills.dob += 1
    }
    if (roster.gender && !person.gender) {
      personPatch.gender = roster.gender
      report.fieldFills.gender += 1
    }
    if (hasGrade && roster.grade && !person.grade) {
      personPatch.grade = roster.grade
      report.fieldFills.grade += 1
    }

    const age = ageYearsFromDob(personPatch.date_of_birth || person.date_of_birth)
    const enrollmentIdsNeedingAge = []
    if (age != null) {
      for (const enrollment of personEnrollments) {
        if (enrollment.child_age == null) {
          enrollmentIdsNeedingAge.push(enrollment.id)
        }
      }
    }

    if (Object.keys(personPatch).length === 0 && enrollmentIdsNeedingAge.length === 0) {
      continue
    }

    if (report.samples.length < 15) {
      report.samples.push({
        child: roster.childName,
        personId,
        personPatch,
        setChildAge: enrollmentIdsNeedingAge.length > 0 ? age : null,
        enrollmentCount: personEnrollments.length,
      })
    }

    if (Object.keys(personPatch).length > 0) {
      report.wouldUpdatePeople += 1
    }
    if (enrollmentIdsNeedingAge.length > 0) {
      report.wouldUpdateEnrollments += enrollmentIdsNeedingAge.length
      report.fieldFills.child_age += enrollmentIdsNeedingAge.length
    }

    if (!execute) continue

    if (Object.keys(personPatch).length > 0 && !touchedPeople.has(personId)) {
      const { error } = await sb
        .from("people")
        .update(personPatch)
        .eq("organization_id", ORG_ID)
        .eq("id", personId)
      if (error) {
        console.warn(`people update failed ${personId}: ${error.message}`)
      } else {
        report.updatedPeople += 1
        touchedPeople.add(personId)
        Object.assign(person, personPatch)
      }
    }

    if (enrollmentIdsNeedingAge.length > 0 && age != null) {
      const { error } = await sb
        .from("program_enrollments")
        .update({ child_age: age })
        .eq("organization_id", ORG_ID)
        .in("id", enrollmentIdsNeedingAge)
      if (error) {
        console.warn(`enrollment age update failed: ${error.message}`)
      } else {
        report.updatedEnrollments += enrollmentIdsNeedingAge.length
        for (const enrollment of personEnrollments) {
          if (enrollmentIdsNeedingAge.includes(enrollment.id)) {
            enrollment.child_age = age
          }
        }
      }
    }
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = resolve(reportsDir, `enrich-summer-camp-kids-${stamp}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        hasGradeColumn: report.hasGradeColumn,
        rosterRows: report.rosterRows,
        matched: report.matched,
        unmatched: report.unmatched.length,
        ambiguous: report.ambiguous.length,
        wouldUpdatePeople: report.wouldUpdatePeople,
        updatedPeople: report.updatedPeople,
        wouldUpdateEnrollments: report.wouldUpdateEnrollments,
        updatedEnrollments: report.updatedEnrollments,
        fieldFills: report.fieldFills,
        report: outPath,
        unmatchedSample: report.unmatched.slice(0, 10),
        samples: report.samples,
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
