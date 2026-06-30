/**
 * Export Tier 2 legacy staging/backup tables, optionally delete rows, repair orphan payments.
 *
 * Tier 1 table drops are in scripts/140_drop_legacy_donation_and_staging_tables.sql
 * Tier 2 table drops are in scripts/141_drop_payment_import_rows_and_backup_tables.sql
 *
 * Usage:
 *   node scripts/cleanup-legacy-donation-staging-tables.mjs
 *     Export JSON archives + inventory report (dry run)
 *
 *   node scripts/cleanup-legacy-donation-staging-tables.mjs --execute
 *     Export, delete all rows from Tier 2 tables, repair payments missing donor_id
 *
 *   node scripts/cleanup-legacy-donation-staging-tables.mjs --execute --repair-only
 *     Only repair payments missing donor_id (no export/delete)
 *
 * After --execute, apply on Supabase:
 *   npx supabase db query --linked -f scripts/140_drop_legacy_donation_and_staging_tables.sql
 *   npx supabase db query --linked -f scripts/141_drop_payment_import_rows_and_backup_tables.sql
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const execute = process.argv.includes("--execute")
const repairOnly = process.argv.includes("--repair-only")
const STAMP = new Date().toISOString().slice(0, 10)

const TIER2_TABLES = [
  "payment_import_rows",
  "backup_donation_payments_2026_05_24",
  "backup_donation_pledges_2026_05_24",
  "backup_donors_2026_05_24",
  "backup_payments_2026_05_24",
  "backup_pledges_2026_05_24",
]

const TIER1_TABLES = [
  "donation_payments",
  "donation_pledges",
  "donation_amount_options",
  "donor_import_rows",
  "donor_import_batches",
  "contact_import_staging",
  "organization_settings",
]

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) throw new Error(".env.local not found")
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

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Missing Supabase credentials")

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function tableExists(table) {
  const { error } = await sb.from(table).select("*", { count: "exact", head: true })
  if (!error) return true
  if (error.message?.includes("does not exist") || error.code === "42P01") return false
  return { error: error.message }
}

async function countRows(table) {
  const exists = await tableExists(table)
  if (exists === false) return { exists: false, count: 0 }
  if (typeof exists === "object") return { exists: false, error: exists.error }

  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true })
  if (error) return { exists: true, error: error.message }
  return { exists: true, count: count ?? 0 }
}

async function fetchAllRows(table, pageSize = 1000) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`${table} fetch: ${error.message}`)

    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function exportTable(table, outDir) {
  const exists = await tableExists(table)
  if (exists === false) {
    return { table, skipped: true, reason: "table_missing" }
  }
  if (typeof exists === "object") {
    return { table, skipped: true, reason: exists.error }
  }

  let rows = []
  try {
    rows = await fetchAllRows(table)
  } catch (err) {
    return {
      table,
      skipped: true,
      reason: err instanceof Error ? err.message : String(err),
    }
  }

  const fileName = `${table}-${STAMP}.json`
  const filePath = resolve(outDir, fileName)
  writeFileSync(filePath, JSON.stringify(rows, null, 2))

  return { table, rowCount: rows.length, file: filePath }
}

async function deleteAllRows(table) {
  const exists = await tableExists(table)
  if (exists === false) return { table, deleted: 0, skipped: true, reason: "table_missing" }

  let deleted = 0

  while (true) {
    const { data, error } = await sb.from(table).select("id").limit(500)
    if (error) return { table, deleted, error: error.message }

    const ids = (data ?? []).map((row) => row.id).filter(Boolean)
    if (ids.length === 0) break

    const { error: deleteError, count } = await sb
      .from(table)
      .delete({ count: "exact" })
      .in("id", ids)

    if (deleteError) return { table, deleted, error: deleteError.message }
    deleted += count ?? ids.length
  }

  const { count: remaining } = await sb.from(table).select("*", { count: "exact", head: true })
  return { table, deleted, remaining: remaining ?? 0 }
}

async function repairPaymentsMissingDonorId() {
  const { data: payments, error } = await sb
    .from("payments")
    .select("id, organization_id, contact_id, donor_id, sender_name")
    .is("donor_id", null)
    .limit(100)

  if (error) return { error: error.message, repaired: [] }

  const repaired = []
  for (const payment of payments ?? []) {
    if (!payment.contact_id) {
      repaired.push({
        payment_id: payment.id,
        status: "skipped",
        reason: "no contact_id to derive donor",
      })
      continue
    }

    const { data: existingDonor } = await sb
      .from("donors")
      .select("id")
      .eq("organization_id", payment.organization_id)
      .eq("contact_id", payment.contact_id)
      .maybeSingle()

    let donorId = existingDonor?.id ?? null

    if (!donorId) {
      const { data: contact } = await sb
        .from("contacts")
        .select("id, full_name, email, contact_type")
        .eq("id", payment.contact_id)
        .maybeSingle()

      if (!contact) {
        repaired.push({
          payment_id: payment.id,
          status: "skipped",
          reason: "contact not found",
        })
        continue
      }

      const donorType =
        contact.contact_type === "organization" || contact.contact_type === "group"
          ? "organization"
          : "individual"

      const { data: created, error: createError } = await sb
        .from("donors")
        .insert({
          organization_id: payment.organization_id,
          contact_id: payment.contact_id,
          donor_type: donorType,
          display_name: contact.full_name,
          email: contact.email,
        })
        .select("id")
        .single()

      if (createError) {
        repaired.push({
          payment_id: payment.id,
          status: "failed",
          reason: createError.message,
        })
        continue
      }
      donorId = created.id
    }

    if (!(execute || repairOnly)) {
      repaired.push({
        payment_id: payment.id,
        status: "would_repair",
        donor_id: donorId,
      })
      continue
    }

    const { error: updateError } = await sb
      .from("payments")
      .update({ donor_id: donorId })
      .eq("id", payment.id)

    repaired.push({
      payment_id: payment.id,
      status: updateError ? "failed" : "repaired",
      donor_id: donorId,
      error: updateError?.message ?? null,
    })
  }

  return { repaired, count: payments?.length ?? 0 }
}

async function main() {
  const outDir = resolve(root, "scripts/backups/legacy-cleanup")
  mkdirSync(outDir, { recursive: true })

  const report = {
    capturedAt: new Date().toISOString(),
    mode: repairOnly ? "repair-only" : execute ? "execute" : "dry-run",
    tier1Inventory: {},
    tier2Inventory: {},
    exports: [],
    deletions: [],
    repair: null,
    nextSteps: [],
  }

  for (const table of TIER1_TABLES) {
    report.tier1Inventory[table] = await countRows(table)
  }
  for (const table of TIER2_TABLES) {
    report.tier2Inventory[table] = await countRows(table)
  }

  if (!repairOnly) {
    console.log("Exporting Tier 2 tables...")
    for (const table of TIER2_TABLES) {
      const result = await exportTable(table, outDir)
      report.exports.push(result)
      if (result.file) {
        console.log(`  ${table}: ${result.rowCount} rows → ${result.file}`)
      } else {
        console.log(`  ${table}: skipped (${result.reason})`)
      }
    }

    const manifestPath = resolve(outDir, `legacy-cleanup-manifest-${STAMP}.json`)
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          exportedAt: report.capturedAt,
          exports: report.exports,
          tier2Inventory: report.tier2Inventory,
        },
        null,
        2
      )
    )
    report.manifestPath = manifestPath
  }

  report.repair = await repairPaymentsMissingDonorId()

  if (execute && !repairOnly) {
    console.log("\nDeleting Tier 2 rows...")
    for (const table of TIER2_TABLES) {
      const result = await deleteAllRows(table)
      report.deletions.push(result)
      console.log(`  ${table}:`, result)
    }
  }

  const tier1Pending = Object.entries(report.tier1Inventory).filter(
    ([, v]) => v.exists !== false && (v.count ?? 0) >= 0
  )
  const tier2HasRows = Object.entries(report.tier2Inventory).filter(
    ([, v]) => v.exists !== false && (v.count ?? 0) > 0
  )

  if (!execute) {
    report.nextSteps.push(
      "Review exports in scripts/backups/legacy-cleanup/",
      "Apply Tier 1: npx supabase db query --linked -f scripts/140_drop_legacy_donation_and_staging_tables.sql",
      "Run with --execute to delete Tier 2 rows and repair orphan payments",
      "Apply Tier 2: npx supabase db query --linked -f scripts/141_drop_payment_import_rows_and_backup_tables.sql"
    )
  } else {
    report.nextSteps.push(
      "Apply SQL migrations 140 and 141 on Supabase if not already applied",
      "Re-run verify-donations-priority1.mjs to confirm canonical ledger integrity"
    )
    if (tier2HasRows.length && report.deletions.some((d) => (d.remaining ?? 0) > 0)) {
      report.nextSteps.push("Some Tier 2 rows may remain — apply migration 141 to drop tables")
    }
  }

  const reportPath = resolve(root, "scripts/reports", `legacy-donation-cleanup-${STAMP}.json`)
  mkdirSync(resolve(root, "scripts/reports"), { recursive: true })
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log("\n=== Legacy donation cleanup report ===\n")
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport: ${reportPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
