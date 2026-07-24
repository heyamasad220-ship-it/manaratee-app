/**
 * Set QIL 2025–26 enrollment_date to 2025-09-01 (Roster "Registered" column).
 * Usage: node scripts/fix-qil-registered-date.mjs [--execute]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_NAME = "Quran Institute for Ladies 2025-2026"
const ENROLLMENT_DATE = "2025-09-01"

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

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: program, error } = await sb
    .from("programs")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()

  if (error || !program) {
    throw new Error(error?.message || "QIL 2025-2026 program not found")
  }

  const { data: enrollments, error: enrError } = await sb
    .from("program_enrollments")
    .select("id, enrollment_date, created_at, child_name")
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)

  if (enrError) throw new Error(enrError.message)

  const rows = enrollments || []
  const needingUpdate = rows.filter(
    (row) => String(row.enrollment_date || "").slice(0, 10) !== ENROLLMENT_DATE
  )

  const report = {
    mode: execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    program: { id: program.id, name: program.name },
    targetDate: ENROLLMENT_DATE,
    total: rows.length,
    needingUpdate: needingUpdate.length,
    sample: needingUpdate.slice(0, 10).map((row) => ({
      id: row.id,
      name: row.child_name,
      enrollment_date: row.enrollment_date,
      created_at: row.created_at,
    })),
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const reportPath = resolve(
    reportsDir,
    `qil-registered-date-${stamp}-${execute ? "execute" : "dry"}.json`
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(
    `${execute ? "EXECUTE" : "dry-run"}: ${needingUpdate.length}/${rows.length} enrollments → ${ENROLLMENT_DATE}`
  )
  console.log(`Report: ${reportPath}`)

  if (!execute) {
    console.log("Re-run with --execute to write.")
    return
  }

  let updated = 0
  for (const enrollment of needingUpdate) {
    const { error: updateError } = await sb
      .from("program_enrollments")
      .update({ enrollment_date: ENROLLMENT_DATE })
      .eq("id", enrollment.id)
      .eq("organization_id", ORG_ID)

    if (updateError) {
      console.warn(enrollment.id, updateError.message)
      continue
    }
    updated += 1
  }

  console.log(`Updated ${updated} enrollments.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
