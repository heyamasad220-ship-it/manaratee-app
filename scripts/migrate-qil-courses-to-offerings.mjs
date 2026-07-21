/**
 * Consolidate QIL course-as-programs into one year program with course offerings.
 *
 * Prerequisites: run scripts/174_enrollment_unique_per_offering.sql in Supabase.
 *
 * Usage:
 *   node scripts/migrate-qil-courses-to-offerings.mjs
 *   node scripts/migrate-qil-courses-to-offerings.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const TARGET_PROGRAM_NAME = "Quran Institute for Ladies 2025-2026"
const PROGRAM_START = "2025-08-17"
const PROGRAM_END = "2026-05-31"

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

function courseNameFromProgram(programName) {
  const text = String(programName || "").trim()
  if (text.startsWith("QIL — ")) return text.slice("QIL — ".length).trim()
  if (text.startsWith("QIL - ")) return text.slice("QIL - ".length).trim()
  return text
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`Mode: ${execute ? "EXECUTE" : "DRY-RUN"}`)

  const { data: depts, error: deptError } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .or("name.ilike.%Institute for Ladies%,name.ilike.%Qur%an Institute%")

  if (deptError) throw new Error(deptError.message)
  const department = (depts || [])[0]
  if (!department) throw new Error("QIL department not found")

  const { data: coursePrograms, error: progError } = await sb
    .from("programs")
    .select("id, name, department_id")
    .eq("organization_id", ORG_ID)
    .eq("department_id", department.id)
    .ilike("name", "QIL — %")

  if (progError) throw new Error(progError.message)

  const { data: existingTarget } = await sb
    .from("programs")
    .select("id, name, department_id")
    .eq("organization_id", ORG_ID)
    .eq("name", TARGET_PROGRAM_NAME)
    .maybeSingle()

  const plan = {
    department,
    targetProgramName: TARGET_PROGRAM_NAME,
    targetProgramId: existingTarget?.id || null,
    courses: [],
  }

  for (const program of coursePrograms || []) {
    const courseName = courseNameFromProgram(program.name)
    const { data: offerings } = await sb
      .from("program_offerings")
      .select("id, name, program_id")
      .eq("organization_id", ORG_ID)
      .eq("program_id", program.id)

    const { count: enrollmentCount } = await sb
      .from("program_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", ORG_ID)
      .eq("program_id", program.id)

    plan.courses.push({
      programId: program.id,
      programName: program.name,
      courseName,
      offerings: offerings || [],
      enrollmentCount: enrollmentCount || 0,
    })
  }

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(
    reportDir,
    `qil-courses-to-offerings-${new Date().toISOString().slice(0, 10)}.json`
  )

  if (!execute) {
    writeFileSync(reportPath, JSON.stringify({ mode: "dry-run", ...plan }, null, 2))
    console.log(JSON.stringify(plan, null, 2))
    console.log(`\nReport: ${reportPath}`)
    console.log("1) Run scripts/174_enrollment_unique_per_offering.sql in Supabase")
    console.log("2) Re-run with --execute")
    return
  }

  // Ensure schema change is in place by probing: move would fail otherwise.
  let targetId = existingTarget?.id || null
  if (!targetId) {
    const { data: created, error } = await sb
      .from("programs")
      .insert({
        organization_id: ORG_ID,
        department_id: department.id,
        name: TARGET_PROGRAM_NAME,
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
      .select("id, name")
      .single()
    if (error) throw new Error(`create target program: ${error.message}`)
    targetId = created.id
  } else if (existingTarget.department_id !== department.id) {
    await sb
      .from("programs")
      .update({ department_id: department.id })
      .eq("id", targetId)
      .eq("organization_id", ORG_ID)
  }

  plan.targetProgramId = targetId
  const migrated = []

  for (const course of plan.courses) {
    // Prefer the year offering; otherwise first offering.
    let offering =
      course.offerings.find((o) => o.name === "2025-2026") || course.offerings[0] || null

    if (!offering) {
      const { data: createdOffering, error: offErr } = await sb
        .from("program_offerings")
        .insert({
          organization_id: ORG_ID,
          program_id: targetId,
          name: course.courseName,
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
      if (offErr) throw new Error(`create offering (${course.courseName}): ${offErr.message}`)
      offering = createdOffering
    } else {
      const { error: moveErr } = await sb
        .from("program_offerings")
        .update({
          program_id: targetId,
          name: course.courseName,
          is_default: false,
          offering_type: "academic_year",
        })
        .eq("id", offering.id)
        .eq("organization_id", ORG_ID)
      if (moveErr) throw new Error(`move offering (${course.courseName}): ${moveErr.message}`)
    }

    const { error: enrErr } = await sb
      .from("program_enrollments")
      .update({
        program_id: targetId,
        offering_id: offering.id,
        department_id: department.id,
      })
      .eq("organization_id", ORG_ID)
      .eq("program_id", course.programId)

    if (enrErr) {
      if (/unique|duplicate/i.test(enrErr.message)) {
        throw new Error(
          `Enrollment unique constraint still blocks multi-course students. ` +
            `Run scripts/174_enrollment_unique_per_offering.sql in Supabase, then re-run. ` +
            `(${enrErr.message})`
        )
      }
      throw new Error(`enrollments move (${course.courseName}): ${enrErr.message}`)
    }

    const { error: chargeErr } = await sb
      .from("program_charges")
      .update({ program_id: targetId, offering_id: offering.id })
      .eq("organization_id", ORG_ID)
      .eq("program_id", course.programId)
    if (chargeErr) {
      console.warn(`charges warn (${course.courseName}): ${chargeErr.message}`)
    }

    const { error: staffErr } = await sb
      .from("program_staff_assignments")
      .update({ program_id: targetId, offering_id: offering.id })
      .eq("organization_id", ORG_ID)
      .eq("program_id", course.programId)
    if (staffErr) {
      console.warn(`staff assign warn (${course.courseName}): ${staffErr.message}`)
    }

    // Extra offerings left on the course program → move or delete
    for (const extra of course.offerings) {
      if (extra.id === offering.id) continue
      await sb
        .from("program_offerings")
        .update({ program_id: targetId })
        .eq("id", extra.id)
        .eq("organization_id", ORG_ID)
    }

    const { error: delErr } = await sb
      .from("programs")
      .delete()
      .eq("organization_id", ORG_ID)
      .eq("id", course.programId)
    if (delErr) {
      console.warn(`delete old program warn (${course.programName}): ${delErr.message}`)
    }

    migrated.push({
      courseName: course.courseName,
      offeringId: offering.id,
      fromProgramId: course.programId,
      enrollments: course.enrollmentCount,
    })
  }

  // Refresh enrolled count on target
  const { count: enrolledCount } = await sb
    .from("program_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", ORG_ID)
    .eq("program_id", targetId)
    .in("status", ["enrolled", "active", "pending", "pending_payment"])

  await sb
    .from("programs")
    .update({ enrolled: enrolledCount || 0 })
    .eq("id", targetId)
    .eq("organization_id", ORG_ID)

  const result = {
    mode: "execute",
    department,
    targetProgramId: targetId,
    targetProgramName: TARGET_PROGRAM_NAME,
    migrated,
    enrolledCount: enrolledCount || 0,
  }
  writeFileSync(reportPath, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  console.log(`\nReport: ${reportPath}`)
  console.log(`Open Programs → Departments → ${department.name} → Offerings`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
