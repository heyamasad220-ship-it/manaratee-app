/**
 * Remove archived "Summer Camp Two (merged)" leftover after the camp merge.
 *
 * Dual-camp kids left cancelled enrollments on Camp Two (charges already
 * retargeted to Summer Camp). Those rows block app delete and clutter Archived.
 *
 * Usage:
 *   node scripts/delete-summer-camp-two-merged.mjs
 *   node scripts/delete-summer-camp-two-merged.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const YEAR_PROGRAM_ID = "e6436c28-666c-4327-b3c1-4234d2379a42"
const SURVIVOR_OFFERING_ID = "6700239e-bbf5-49ae-90e6-0412b88a22c3"
const CAMP2_ALIASES = [
  "Summer Camp Two (merged)",
  "Summer Camp Two",
  "Summer Camp Two (6/29 - 7/23)",
  "2026 MAS Summer Camp Two (6/29 - 7/23)",
]

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
  const execute = argv.includes("--execute")
  const orgIdx = argv.indexOf("--org")
  const orgId =
    orgIdx >= 0 && argv[orgIdx + 1] ? argv[orgIdx + 1] : DEFAULT_ORG_ID
  return { execute, orgId }
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const report = {
    mode: args.execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    orgId: args.orgId,
    actions: [],
    warnings: [],
    counts: {},
  }

  const year = await must(
    "load year program",
    sb
      .from("programs")
      .select("id, name")
      .eq("organization_id", args.orgId)
      .eq("id", YEAR_PROGRAM_ID)
      .maybeSingle()
  )
  if (!year) {
    throw new Error(`Year program not found: ${YEAR_PROGRAM_ID}`)
  }
  report.yearProgramId = year.id
  report.yearProgramName = year.name

  const offerings = await must(
    "load offerings",
    sb
      .from("program_offerings")
      .select("id, name, status, is_default")
      .eq("organization_id", args.orgId)
      .eq("program_id", year.id)
  )

  const survivor =
    offerings.find((o) => o.id === SURVIVOR_OFFERING_ID) ||
    offerings.find(
      (o) =>
        o.status !== "archived" &&
        String(o.name).toLowerCase().includes("summer camp") &&
        !String(o.name).toLowerCase().includes("two")
    ) ||
    null
  const camp2 =
    offerings.find((o) => CAMP2_ALIASES.includes(o.name)) ||
    offerings.find(
      (o) =>
        o.id !== SURVIVOR_OFFERING_ID &&
        String(o.name).toLowerCase().includes("camp two")
    ) ||
    null

  if (!camp2) {
    report.actions.push("No Summer Camp Two offering found — nothing to delete.")
    report.offerings = offerings.map((o) => ({
      id: o.id,
      name: o.name,
      status: o.status,
    }))
    writeReport(report)
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (camp2.id === SURVIVOR_OFFERING_ID || (survivor && camp2.id === survivor.id)) {
    throw new Error("Refusing to delete survivor Summer Camp offering")
  }

  report.camp2OfferingId = camp2.id
  report.camp2Name = camp2.name
  report.survivorOfferingId = survivor?.id ?? SURVIVOR_OFFERING_ID

  const enrollments = await must(
    "load camp2 enrollments",
    sb
      .from("program_enrollments")
      .select("id, status, participant_contact_id")
      .eq("organization_id", args.orgId)
      .eq("offering_id", camp2.id)
  )
  report.counts.enrollments = enrollments.length
  report.counts.cancelledEnrollments = enrollments.filter(
    (e) => e.status === "cancelled"
  ).length
  report.counts.activeEnrollments = enrollments.filter(
    (e) => e.status !== "cancelled"
  ).length

  if (report.counts.activeEnrollments > 0) {
    throw new Error(
      `Camp Two still has ${report.counts.activeEnrollments} non-cancelled enrollment(s). Aborting.`
    )
  }

  const enrollmentIds = enrollments.map((e) => e.id)

  const { count: chargeCount } = await sb
    .from("program_charges")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", args.orgId)
    .in(
      "enrollment_id",
      enrollmentIds.length > 0 ? enrollmentIds : ["00000000-0000-0000-0000-000000000000"]
    )

  report.counts.chargesOnCamp2Enrollments = chargeCount ?? 0

  report.actions.push(
    `Delete archived offering "${camp2.name}" (${camp2.id})`,
    `Remove ${enrollments.length} cancelled leftover enrollment(s); charges keep history (enrollment_id → null via FK)`
  )

  if (!args.execute) {
    report.actions.push("Dry-run only — re-run with --execute to apply.")
    writeReport(report)
    console.log(JSON.stringify(report, null, 2))
    return
  }

  // Session access rows for leftover enrollments
  if (enrollmentIds.length > 0) {
    await must(
      "delete session access",
      sb
        .from("program_registration_session_access")
        .delete()
        .in("enrollment_id", enrollmentIds)
    )
  }

  // Ensure charges already point at survivor (or stay linked after enrollment delete)
  if (survivor && enrollmentIds.length > 0) {
    await must(
      "repoint charges to survivor offering",
      sb
        .from("program_charges")
        .update({
          offering_id: survivor.id,
          updated_at: new Date().toISOString(),
        })
        .in("enrollment_id", enrollmentIds)
        .eq("organization_id", args.orgId)
    )
  }

  if (enrollmentIds.length > 0) {
    await must(
      "delete cancelled camp2 enrollments",
      sb.from("program_enrollments").delete().in("id", enrollmentIds)
    )
  }

  // Clear any remaining children that might block delete
  const childTables = [
    "program_waitlist",
    "program_staff_assignments",
    "program_schedule_items",
    "program_capacity_groups",
    "program_sessions",
    "program_registration_options",
    "program_offering_fee_plans",
    "program_offering_discount_rules",
  ]
  for (const table of childTables) {
    const { error } = await sb
      .from(table)
      .delete()
      .eq("offering_id", camp2.id)
      .eq("organization_id", args.orgId)
    if (error) {
      // Some tables may not have organization_id or may not exist — note and continue
      report.warnings.push(`${table} cleanup: ${error.message}`)
      const retry = await sb.from(table).delete().eq("offering_id", camp2.id)
      if (retry.error) {
        report.warnings.push(`${table} retry: ${retry.error.message}`)
      }
    }
  }

  if (camp2.is_default) {
    await must(
      "clear is_default",
      sb
        .from("program_offerings")
        .update({
          is_default: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", camp2.id)
    )
  }

  await must(
    "delete camp2 offering",
    sb.from("program_offerings").delete().eq("id", camp2.id)
  )

  report.actions.push("Deleted Summer Camp Two offering.")
  writeReport(report)
  console.log(JSON.stringify(report, null, 2))
}

function writeReport(report) {
  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const path = resolve(dir, `summer-camp-two-delete-${stamp}.json`)
  writeFileSync(path, JSON.stringify(report, null, 2))
  report.reportPath = path
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
