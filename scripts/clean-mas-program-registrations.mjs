/**
 * Clear experimental program registration data for MAS Dallas pilot.
 * Preserves: programs catalog, contacts (Heyam Asad), users, config.
 *
 * Usage:
 *   node scripts/clean-mas-program-registrations.mjs           # inventory + export
 *   node scripts/clean-mas-program-registrations.mjs --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const STAMP = "2026-06-16"
const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"

const OPERATIONAL_TABLES = [
  "program_payment_allocations",
  "program_charge_lines",
  "program_charge_schedule",
  "program_enrollment_status_history",
  "program_registration_lifecycle_events",
  "program_enrollment_sessions",
  "program_extended_care",
  "program_financial_assistance_documents",
  "program_financial_assistance_status_history",
  "program_financial_assistance",
  "program_charges",
  "program_checkouts",
  "registration_cart_item_fees",
  "registration_cart_items",
  "registration_carts",
  "registration_orders",
  "program_waitlist_status_history",
  "program_waitlist",
  "program_enrollments",
]

const PROTECTED = [
  "contacts",
  "people",
  "profiles",
  "organization_members",
  "organizations",
  "programs",
  "program_sessions",
  "program_offerings",
  "program_registration_options",
]

function loadEnv() {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function count(table, orgFilter = true) {
  let q = sb.from(table).select("*", { count: "exact", head: true })
  if (orgFilter) {
    const { data: sample } = await sb.from(table).select("organization_id").limit(1)
    if (sample?.length && "organization_id" in sample[0]) {
      q = q.eq("organization_id", MAS)
    }
  }
  const { count: n, error } = await q
  return { count: n ?? 0, error: error?.message ?? null }
}

async function fetchAll(table, orgFilter = true) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + 999)
    if (orgFilter) {
      const { data: sample } = await sb.from(table).select("organization_id").limit(1)
      if (sample?.length && "organization_id" in sample[0]) {
        q = q.eq("organization_id", MAS)
      }
    }
    const { data, error } = await q
    if (error) return { rows, error: error.message }
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return { rows, error: null }
}

async function deleteMasRows(table) {
  const { rows, error: fetchError } = await fetchAll(table)
  if (fetchError) return { table, deleted: 0, error: fetchError }
  if (!execute) return { table, deleted: rows.length, dryRun: true }

  let deleted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const ids = rows.slice(i, i + 100).map((r) => r.id).filter(Boolean)
    if (!ids.length) continue
    const { error } = await sb.from(table).delete().in("id", ids)
    if (error) return { table, deleted, error: error.message }
    deleted += ids.length
  }
  return { table, deleted, error: null }
}

async function resetProgramCounters() {
  if (!execute) return { dryRun: true }
  const { data: programs } = await sb.from("programs").select("id").eq("organization_id", MAS)
  for (const p of programs || []) {
    await sb.from("programs").update({ enrolled: 0, waitlist: 0 }).eq("id", p.id)
  }
  return { programsReset: programs?.length ?? 0 }
}

async function main() {
  const backupDir = resolve(root, "scripts/backups/program-registrations")
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(backupDir, { recursive: true })
  mkdirSync(reportDir, { recursive: true })

  const before = {}
  for (const t of [...OPERATIONAL_TABLES, ...PROTECTED]) {
    before[t] = await count(t, t !== "profiles" && t !== "organization_members" && t !== "organizations")
  }

  const exports = []
  for (const table of OPERATIONAL_TABLES) {
    const { rows, error } = await fetchAll(table)
    if (error) {
      exports.push({ table, error })
      continue
    }
    const file = resolve(backupDir, `${table}-mas-dallas-${STAMP}.json`)
    writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), rowCount: rows.length, rows }, null, 2))
    exports.push({ table, rowCount: rows.length, file })
  }

  console.log("=== MAS Dallas program registration cleanup ===\n")
  console.log("Before counts (MAS-scoped operational):")
  for (const t of OPERATIONAL_TABLES) {
    console.log(`  ${t}: ${before[t]?.count ?? "?"}`)
  }
  console.log(`\ncontacts (MAS): ${before.contacts?.count}`)
  console.log(`programs (MAS): ${before.programs?.count}`)

  const deletionSteps = []
  if (execute) {
    for (const table of OPERATIONAL_TABLES) {
      const step = await deleteMasRows(table)
      deletionSteps.push(step)
      console.log(`${table}: deleted ${step.deleted}${step.error ? ` ERROR ${step.error}` : ""}`)
      if (step.error) break
    }
    const counterReset = await resetProgramCounters()
    deletionSteps.push({ counterReset })
    console.log(`Program enrolled/waitlist counters reset: ${counterReset.programsReset ?? "dry-run"}`)

    await sb.rpc("sync_contact_affiliations", {
      p_organization_id: MAS,
      p_contact_id: (
        await sb
          .from("contacts")
          .select("id")
          .eq("organization_id", MAS)
          .eq("email", "heyamasad220@gmail.com")
          .maybeSingle()
      ).data?.id,
    })
  } else {
    console.log("\nDry run — re-run with --execute to delete.")
  }

  const after = {}
  for (const t of [...OPERATIONAL_TABLES, ...PROTECTED]) {
    after[t] = await count(t, t !== "profiles" && t !== "organization_members" && t !== "organizations")
  }

  const report = {
    capturedAt: new Date().toISOString(),
    execute,
    before,
    after,
    exports,
    deletionSteps,
    protectedUnchanged: PROTECTED.every((t) => before[t]?.count === after[t]?.count),
  }

  const reportPath = resolve(reportDir, `mas-program-registrations-cleanup-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nReport: ${reportPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
