/**
 * Remove all DONATIONS_DEV_SEED_V1 donation ledger/config from MAS Dallas pilot org.
 * Handles orphan payments when seed contacts were already deleted.
 *
 * Usage:
 *   node scripts/clean-mas-donations-seed.mjs           # inventory
 *   node scripts/clean-mas-donations-seed.mjs --execute
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const STAMP = "2026-06-16"
const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"
const SEED_EMAILS = ["donations-seed-individual@dev.test", "donations-seed-org@dev.test"]
const SEED_CATEGORY_NAMES = ["Seed Zakat", "Seed Sadaqah"]
const SEED_METHOD_NAMES = ["Seed Cash", "Seed Zelle", "Seed Venmo", "Seed Check"]

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

async function count(table, filters = []) {
  let q = sb.from(table).select("*", { count: "exact", head: true })
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "in") q = q.in(f.col, f.val)
    if (f.op === "ilike") q = q.ilike(f.col, f.val)
    if (f.op === "like") q = q.like(f.col, f.val)
  }
  const { count: n, error } = await q
  return { count: n ?? 0, error: error?.message ?? null }
}

async function fetchAll(table, filters = []) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + 999)
    for (const f of filters) {
      if (f.op === "eq") q = q.eq(f.col, f.val)
      if (f.op === "in") q = q.in(f.col, f.val)
      if (f.op === "ilike") q = q.ilike(f.col, f.val)
      if (f.op === "like") q = q.like(f.col, f.val)
    }
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function deleteByIds(table, ids) {
  if (!ids.length) return 0
  if (!execute) return ids.length
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { error } = await sb.from(table).delete().in("id", chunk)
    if (error) throw new Error(`${table} delete: ${error.message}`)
    deleted += chunk.length
  }
  return deleted
}

async function main() {
  const report = { capturedAt: new Date().toISOString(), execute, MAS, steps: [], before: {}, after: {} }

  const orgFilter = [{ op: "eq", col: "organization_id", val: MAS }]

  report.before = {
    payments: await count("payments", orgFilter),
    pledges: await count("pledges", orgFilter),
    donors: await count("donors", orgFilter),
    donation_receipts: await count("donation_receipts", orgFilter),
    contacts: await count("contacts", orgFilter),
    seedContacts: await count("contacts", [...orgFilter, { op: "in", col: "email", val: SEED_EMAILS }]),
    seedPaymentsByMemo: await count("payments", [...orgFilter, { op: "ilike", col: "memo", val: `%${SEED_TAG}%` }]),
    seedPaymentsBySender: await count("payments", [...orgFilter, { op: "ilike", col: "sender_name", val: "Seed %" }]),
  }

  const { data: overviewBefore } = await sb.rpc("donation_org_reports_overview", { p_org_id: MAS })
  report.before.reportsOverview = overviewBefore?.[0] ?? overviewBefore

  const seedContacts = await fetchAll("contacts", [...orgFilter, { op: "in", col: "email", val: SEED_EMAILS }])
  const seedContactIds = seedContacts.map((c) => c.id)
  const seedPersonIds = seedContacts.map((c) => c.person_id).filter(Boolean)

  const seedDonors = seedContactIds.length
    ? await fetchAll("donors", [...orgFilter, { op: "in", col: "contact_id", val: seedContactIds }])
    : []
  const seedDonorIds = seedDonors.map((d) => d.id)

  const seedPledgesByDonor = seedDonorIds.length
    ? await fetchAll("pledges", [...orgFilter, { op: "in", col: "donor_id", val: seedDonorIds }])
    : []
  const seedPledgesByNotes = await fetchAll("pledges", [...orgFilter, { op: "ilike", col: "notes", val: `%${SEED_TAG}%` }])
  const seedPledgeIds = [...new Set([...seedPledgesByDonor, ...seedPledgesByNotes].map((p) => p.id))]

  const seedPaymentsByPledge = seedPledgeIds.length
    ? await fetchAll("payments", [...orgFilter, { op: "in", col: "pledge_id", val: seedPledgeIds }])
    : []
  const seedPaymentsByMemo = await fetchAll("payments", [...orgFilter, { op: "ilike", col: "memo", val: `%${SEED_TAG}%` }])
  const seedPaymentsBySender = await fetchAll("payments", [...orgFilter, { op: "ilike", col: "sender_name", val: "Seed %" }])
  const seedPaymentsByContact = seedContactIds.length
    ? await fetchAll("payments", [...orgFilter, { op: "in", col: "contact_id", val: seedContactIds }])
    : []
  const seedPaymentIds = [
    ...new Set(
      [...seedPaymentsByPledge, ...seedPaymentsByMemo, ...seedPaymentsBySender, ...seedPaymentsByContact].map((p) => p.id)
    ),
  ]

  const importBatches = await fetchAll("payment_import_batches", [
    ...orgFilter,
    { op: "like", col: "file_name", val: "donations-import-test%" },
  ])
  const importBatchIds = importBatches.map((b) => b.id)
  const importRows = []

  if (importBatchIds.length) {
    const { data: rowProbe, error: rowProbeError } = await sb
      .from("payment_import_rows")
      .select("id")
      .limit(1)
    if (!rowProbeError) {
      const fetched = await fetchAll("payment_import_rows", [
        { op: "in", col: "batch_id", val: importBatchIds },
      ])
      importRows.push(...fetched)
    }
  }

  const seedCategories = await fetchAll("donation_categories", [
    ...orgFilter,
    { op: "in", col: "name", val: SEED_CATEGORY_NAMES },
  ])
  const seedCategoryIds = seedCategories.map((c) => c.id)
  const seedSubcategories = seedCategoryIds.length
    ? await fetchAll("donation_subcategories", [...orgFilter, { op: "in", col: "category_id", val: seedCategoryIds }])
    : []

  const seedMethods = await fetchAll("payment_methods", [
    ...orgFilter,
    { op: "in", col: "name", val: SEED_METHOD_NAMES },
  ])

  const seedCampaigns = await fetchAll("campaigns", [
    ...orgFilter,
    { op: "eq", col: "code", val: SEED_CAMPAIGN_CODE },
  ])

  report.inventory = {
    seedPaymentIds: seedPaymentIds.length,
    seedPledgeIds: seedPledgeIds.length,
    seedDonorIds: seedDonorIds.length,
    seedContactIds: seedContactIds.length,
    importRows: importRows.length,
    seedCategories: seedCategories.length,
    seedMethods: seedMethods.length,
    seedCampaigns: seedCampaigns.length,
  }

  if (execute) {
    report.steps.push({ table: "payments", deleted: await deleteByIds("payments", seedPaymentIds) })
    report.steps.push({ table: "pledges", deleted: await deleteByIds("pledges", seedPledgeIds) })
    report.steps.push({ table: "payment_import_rows", deleted: await deleteByIds("payment_import_rows", importRows.map((r) => r.id)) })
    report.steps.push({ table: "payment_import_batches", deleted: await deleteByIds("payment_import_batches", importBatchIds) })
    report.steps.push({ table: "donors", deleted: await deleteByIds("donors", seedDonorIds) })

    for (const contactId of seedContactIds) {
      await sb.from("donation_receipts").delete().eq("organization_id", MAS).eq("contact_id", contactId)
      await sb.from("contact_roles").delete().eq("contact_id", contactId)
      await sb.from("contact_notes").delete().eq("contact_id", contactId)
      await sb.from("contact_activities").delete().eq("contact_id", contactId)
    }
    report.steps.push({ table: "contacts", deleted: await deleteByIds("contacts", seedContactIds) })
    report.steps.push({ table: "people", deleted: await deleteByIds("people", seedPersonIds) })
    report.steps.push({
      table: "donation_subcategories",
      deleted: await deleteByIds("donation_subcategories", seedSubcategories.map((s) => s.id)),
    })
    report.steps.push({ table: "donation_categories", deleted: await deleteByIds("donation_categories", seedCategoryIds) })
    report.steps.push({ table: "payment_methods", deleted: await deleteByIds("payment_methods", seedMethods.map((m) => m.id)) })
    report.steps.push({ table: "campaigns", deleted: await deleteByIds("campaigns", seedCampaigns.map((c) => c.id)) })

    const remainingPayments = await count("payments", orgFilter)
    if (remainingPayments.count === 0) {
      const orphanReceipts = await fetchAll("donation_receipts", orgFilter)
      report.steps.push({
        table: "donation_receipts",
        deleted: await deleteByIds("donation_receipts", orphanReceipts.map((r) => r.id)),
      })
    }
  } else {
    report.steps.push({ dryRun: true, inventory: report.inventory })
  }

  report.after = {
    payments: await count("payments", orgFilter),
    pledges: await count("pledges", orgFilter),
    donors: await count("donors", orgFilter),
    donation_receipts: await count("donation_receipts", orgFilter),
    contacts: await count("contacts", orgFilter),
    seedContacts: await count("contacts", [...orgFilter, { op: "in", col: "email", val: SEED_EMAILS }]),
    seedPaymentsBySender: await count("payments", [...orgFilter, { op: "ilike", col: "sender_name", val: "Seed %" }]),
  }

  const { data: overviewAfter } = await sb.rpc("donation_org_reports_overview", { p_org_id: MAS })
  report.after.reportsOverview = overviewAfter?.[0] ?? overviewAfter

  const backupDir = resolve(root, "scripts/backups/donations-seed")
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(backupDir, { recursive: true })
  mkdirSync(reportDir, { recursive: true })

  if (seedPaymentIds.length) {
    writeFileSync(
      resolve(backupDir, `payments-mas-dallas-${STAMP}.json`),
      JSON.stringify({ exportedAt: report.capturedAt, ids: seedPaymentIds }, null, 2)
    )
  }

  const reportPath = resolve(reportDir, `mas-donations-seed-cleanup-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport: ${reportPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
