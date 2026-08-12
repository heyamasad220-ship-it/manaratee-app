/**
 * Clear Sunday School 2026-2027 registration/billing operational data.
 *
 * Keeps: contacts, people, person_relationships, tags/contact_tags,
 *         program row, offerings (Age 4-6 / 7-9 / 10-14).
 * Removes: enrollments, charges, charge lines/schedules, payment plans,
 *          waitlist, FA awards, attendance, and related child rows for
 *          that program only.
 *
 * Usage:
 *   node scripts/cleanup-sunday-school-2026-2027-registrations.mjs
 *   node scripts/cleanup-sunday-school-2026-2027-registrations.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_NAME = "Sunday School 2026-2027"
const IMPORT_TAG = "SUNDAY_SCHOOL_2026_27_V1"
const CHUNK = 100

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

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function fetchAll(sb, table, build) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + 999)
    q = build(q)
    const { data, error } = await q
    if (error) throw new Error(`${table} fetch: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function deleteByIds(sb, table, ids, execute) {
  if (!ids.length) return { table, matched: 0, deleted: 0 }
  if (!execute) return { table, matched: ids.length, deleted: 0, dryRun: true }
  let deleted = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { error } = await sb.from(table).delete().in("id", chunk)
    if (error) throw new Error(`${table} delete: ${error.message}`)
    deleted += chunk.length
  }
  return { table, matched: ids.length, deleted }
}

async function deleteByColumnIn(sb, table, column, values, execute) {
  if (!values.length) return { table, matched: 0, deleted: 0 }
  // Fetch ids first so we can report accurately and chunk deletes.
  const rows = await fetchAll(sb, table, (q) => q.in(column, values))
  const ids = rows.map((r) => r.id).filter(Boolean)
  // Some child tables may lack id — delete by column in chunks.
  if (!ids.length && rows.length) {
    if (!execute) {
      return { table, matched: rows.length, deleted: 0, dryRun: true }
    }
    let deleted = 0
    for (let i = 0; i < values.length; i += CHUNK) {
      const chunk = values.slice(i, i + CHUNK)
      const { error, count } = await sb
        .from(table)
        .delete({ count: "exact" })
        .in(column, chunk)
      if (error) throw new Error(`${table} delete by ${column}: ${error.message}`)
      deleted += count ?? chunk.length
    }
    return { table, matched: rows.length, deleted }
  }
  return deleteByIds(sb, table, ids, execute)
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
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
    mode: execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    orgId: ORG_ID,
    programName: PROGRAM_NAME,
    importTag: IMPORT_TAG,
    kept: [
      "contacts",
      "people",
      "person_relationships",
      "tags / contact_tags",
      "programs (Sunday School 2026-2027 row)",
      "program_offerings (Age 4-6 / 7-9 / 10-14)",
    ],
    counts: {},
    deletes: [],
    warnings: [],
  }

  const program = await must(
    "load program",
    sb
      .from("programs")
      .select("id, name, enrolled, waitlist")
      .eq("organization_id", ORG_ID)
      .eq("name", PROGRAM_NAME)
      .maybeSingle()
  )
  if (!program?.id) {
    throw new Error(`Program not found: ${PROGRAM_NAME}`)
  }
  report.programId = program.id

  const offerings = await must(
    "load offerings",
    sb
      .from("program_offerings")
      .select("id, name")
      .eq("organization_id", ORG_ID)
      .eq("program_id", program.id)
  )
  report.offeringsKept = offerings.map((o) => ({ id: o.id, name: o.name }))

  // All enrollments for this program (import-tagged and any manual ones).
  const enrollments = await fetchAll(sb, "program_enrollments", (q) =>
    q.eq("organization_id", ORG_ID).eq("program_id", program.id)
  )
  const enrollmentIds = enrollments.map((e) => e.id)
  const taggedCount = enrollments.filter((e) =>
    String(e.notes || "").includes(IMPORT_TAG)
  ).length
  report.counts.enrollments = enrollments.length
  report.counts.enrollmentsWithImportTag = taggedCount

  // Charges linked by enrollment OR by program_id (covers orphans / addons).
  const chargesByEnrollment =
    enrollmentIds.length > 0
      ? await fetchAll(sb, "program_charges", (q) =>
          q.eq("organization_id", ORG_ID).in("enrollment_id", enrollmentIds)
        )
      : []
  const chargesByProgram = await fetchAll(sb, "program_charges", (q) =>
    q.eq("organization_id", ORG_ID).eq("program_id", program.id)
  )
  const chargeById = new Map()
  for (const c of [...chargesByEnrollment, ...chargesByProgram]) {
    chargeById.set(c.id, c)
  }
  const charges = [...chargeById.values()]
  const chargeIds = charges.map((c) => c.id)
  report.counts.charges = charges.length
  report.counts.addonCharges = charges.filter(
    (c) => c.charge_type === "addon"
  ).length

  // Waitlist for this program
  const waitlist = await fetchAll(sb, "program_waitlist", (q) =>
    q.eq("organization_id", ORG_ID).eq("program_id", program.id)
  )
  const waitlistIds = waitlist.map((w) => w.id)
  report.counts.waitlist = waitlist.length

  // Payment plans for these enrollments
  let plans = []
  if (enrollmentIds.length) {
    try {
      plans = await fetchAll(sb, "program_payment_plans", (q) =>
        q.in("enrollment_id", enrollmentIds)
      )
    } catch (err) {
      report.warnings.push(
        `program_payment_plans fetch: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
  report.counts.paymentPlans = plans.length

  // Backup snapshot before delete
  const backupDir = resolve(
    root,
    "scripts/backups/sunday-school-2026-2027-cleanup"
  )
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupFile = resolve(backupDir, `snapshot-${stamp}.json`)
  writeFileSync(
    backupFile,
    JSON.stringify(
      {
        program,
        offerings,
        enrollments,
        charges,
        waitlist,
        paymentPlans: plans,
      },
      null,
      2
    )
  )
  report.backupFile = backupFile

  const results = []

  // 1) Charge children
  if (chargeIds.length) {
    for (const table of [
      "program_payment_allocations",
      "program_charge_schedule",
      "program_charge_lines",
    ]) {
      try {
        results.push(
          await deleteByColumnIn(sb, table, "charge_id", chargeIds, execute)
        )
      } catch (err) {
        report.warnings.push(
          `${table}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  }

  // 2) Enrollment children
  if (enrollmentIds.length) {
    for (const table of [
      "program_payment_plans",
      "program_attendance",
      "program_registration_session_access",
      "program_enrollment_sessions",
      "program_enrollment_status_history",
      "program_registration_lifecycle_events",
      "program_extended_care",
      "program_enrollment_fa_awards",
      "program_financial_assistance",
      "program_billing_overrides",
    ]) {
      try {
        results.push(
          await deleteByColumnIn(
            sb,
            table,
            "enrollment_id",
            enrollmentIds,
            execute
          )
        )
      } catch (err) {
        report.warnings.push(
          `${table}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  }

  // 3) Waitlist children then waitlist
  if (waitlistIds.length) {
    try {
      results.push(
        await deleteByColumnIn(
          sb,
          "program_waitlist_status_history",
          "waitlist_id",
          waitlistIds,
          execute
        )
      )
    } catch (err) {
      report.warnings.push(
        `program_waitlist_status_history: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
    results.push(await deleteByIds(sb, "program_waitlist", waitlistIds, execute))
  }

  // 4) Break enrollment ↔ charge circular FK, then delete charges + enrollments
  if (execute && enrollmentIds.length) {
    for (let i = 0; i < enrollmentIds.length; i += CHUNK) {
      const chunk = enrollmentIds.slice(i, i + CHUNK)
      const { error } = await sb
        .from("program_enrollments")
        .update({ charge_id: null })
        .in("id", chunk)
      if (error) {
        throw new Error(`null enrollment.charge_id: ${error.message}`)
      }
    }
    results.push({
      table: "program_enrollments.charge_id→null",
      matched: enrollmentIds.length,
      deleted: enrollmentIds.length,
    })
  } else if (enrollmentIds.length) {
    results.push({
      table: "program_enrollments.charge_id→null",
      matched: enrollmentIds.length,
      deleted: 0,
      dryRun: true,
    })
  }

  results.push(await deleteByIds(sb, "program_charges", chargeIds, execute))
  results.push(
    await deleteByIds(sb, "program_enrollments", enrollmentIds, execute)
  )

  // 5) Reset program counters
  if (execute) {
    await must(
      "reset program counters",
      sb
        .from("programs")
        .update({ enrolled: 0, waitlist: 0 })
        .eq("id", program.id)
        .eq("organization_id", ORG_ID)
    )
    results.push({
      table: "programs.enrolled/waitlist",
      matched: 1,
      deleted: 1,
      note: "reset to 0",
    })
  }

  report.deletes = results

  // Verify preserved identity sample (contact count unchanged intentionally — we don't touch them)
  const { count: contactCount } = await sb
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_ID)
  report.counts.contactsStillInOrg = contactCount ?? 0

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const outPath = resolve(
    reportsDir,
    `sunday-school-2026-2027-cleanup-${execute ? "execute" : "dry-run"}-${stamp.slice(0, 10)}.json`
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  report.reportFile = outPath

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        programId: report.programId,
        enrollments: report.counts.enrollments,
        charges: report.counts.charges,
        paymentPlans: report.counts.paymentPlans,
        waitlist: report.counts.waitlist,
        offeringsKept: report.offeringsKept?.length,
        contactsStillInOrg: report.counts.contactsStillInOrg,
        deletes: report.deletes.map((d) => ({
          table: d.table,
          matched: d.matched,
          deleted: d.deleted,
          dryRun: d.dryRun || false,
        })),
        warnings: report.warnings,
        backupFile: report.backupFile,
        reportFile: outPath,
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
