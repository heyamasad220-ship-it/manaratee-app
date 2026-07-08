/**
 * Remove payments imported from MadinaDonationsActive07032026.csv
 * (memo tag MADINA_SQUARE_DONATIONS_V1) and related Square recurring plans.
 *
 * Usage:
 *   node scripts/remove-madina-square-donations-import.mjs
 *   node scripts/remove-madina-square-donations-import.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PAYMENT_IMPORT_TAG = "MADINA_SQUARE_DONATIONS_V1"
const STAMP = new Date().toISOString().slice(0, 10)

function loadEnv() {
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
  const args = { orgId: DEFAULT_ORG_ID, execute: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--org") args.orgId = argv[++i]
  }
  return args
}

loadEnv()
const args = parseArgs(process.argv.slice(2))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, buildQuery) {
  const rows = []
  let from = 0
  while (true) {
    let query = sb.from(table).select("*").range(from, from + 999)
    query = buildQuery(query)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function fetchByIdsInChunks(table, idColumn, ids, buildQuery = (q) => q) {
  const rows = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const batch = await fetchAll(table, (q) => buildQuery(q.in(idColumn, chunk)))
    rows.push(...batch)
  }
  return rows
}

async function deleteByIds(table, ids) {
  if (!ids.length) return 0
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { error } = await sb.from(table).delete().in("id", chunk)
    if (error) throw new Error(`${table} delete: ${error.message}`)
    deleted += chunk.length
  }
  return deleted
}

function isSquareLinkPlan(plan) {
  const notes = String(plan.notes || "")
  return (
    plan.external_processor === "square" &&
    (notes.includes("Imported from Square") ||
      notes.includes("Inferred recurring from Square"))
  )
}

async function main() {
  const payments = await fetchAll("payments", (q) =>
    q.eq("organization_id", args.orgId).like("memo", `${PAYMENT_IMPORT_TAG}|%`)
  )

  const paymentIds = payments.map((p) => p.id)
  const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const linkedPlanIds = [
    ...new Set(
      payments
        .map((p) => p.recurring_donation_plan_id)
        .filter((id) => Boolean(id))
    ),
  ]

  const receipts = paymentIds.length
    ? await fetchByIdsInChunks("donation_receipts", "payment_id", paymentIds, (q) =>
        q.eq("organization_id", args.orgId)
      )
    : []

  const squarePlans = await fetchAll("recurring_donation_plans", (q) =>
    q.eq("organization_id", args.orgId).eq("external_processor", "square")
  )

  const planIdsFromLinkScript = squarePlans
    .filter(isSquareLinkPlan)
    .map((p) => p.id)

  const planIdsToDelete = [
    ...new Set([...linkedPlanIds, ...planIdsFromLinkScript]),
  ]

  const report = {
    execute: args.execute,
    organizationId: args.orgId,
    paymentImportTag: PAYMENT_IMPORT_TAG,
    paymentsFound: payments.length,
    paymentTotalAmount: paymentTotal,
    donationReceiptsFound: receipts.length,
    recurringPlansToDelete: planIdsToDelete.length,
    errors: [],
    deleted: {
      donation_receipts: 0,
      payments: 0,
      recurring_donation_plans: 0,
    },
    samples: payments.slice(0, 5).map((p) => ({
      id: p.id,
      amount: p.amount,
      payment_date: p.payment_date,
      donor_id: p.donor_id,
      memo: p.memo,
    })),
  }

  console.log(args.execute ? "EXECUTE" : "DRY RUN")
  console.log(JSON.stringify(report, null, 2))

  if (!args.execute) {
    console.log("\nDry run only. Re-run with --execute to remove imported payments.")
    return
  }

  if (receipts.length) {
    report.deleted.donation_receipts = await deleteByIds(
      "donation_receipts",
      receipts.map((r) => r.id)
    )
  }

  if (paymentIds.length) {
    report.deleted.payments = await deleteByIds("payments", paymentIds)
  }

  if (planIdsToDelete.length) {
    const remainingPlans = []
    for (const planId of planIdsToDelete) {
      const { count, error } = await sb
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", args.orgId)
        .eq("recurring_donation_plan_id", planId)

      if (error) {
        report.errors.push({ planId, error: error.message })
        continue
      }

      if ((count || 0) === 0) {
        remainingPlans.push(planId)
      }
    }

    report.deleted.recurring_donation_plans = await deleteByIds(
      "recurring_donation_plans",
      remainingPlans
    )
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(
    reportsDir,
    `madina-square-donations-removal-${STAMP}.json`
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log("\nDeleted:", report.deleted)
  console.log("Report:", reportPath)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
