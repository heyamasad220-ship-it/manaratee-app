/**
 * Remove incorrectly imported spreadsheet summary donor "Total" and linked ledger rows.
 *
 * Usage:
 *   node scripts/clean-mas-ledger-total-donor.mjs
 *   node scripts/clean-mas-ledger-total-donor.mjs --execute
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const IMPORT_TAG = "MAS_CAMPAIGN_LEDGER_V1"
const STAMP = new Date().toISOString().slice(0, 10)

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

async function fetchAll(table, filters = []) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + 999)
    for (const f of filters) {
      if (f.op === "eq") q = q.eq(f.col, f.val)
      if (f.op === "in") q = q.in(f.col, f.val)
      if (f.op === "ilike") q = q.ilike(f.col, f.val)
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
  const contacts = await fetchAll("contacts", [
    { op: "eq", col: "organization_id", val: MAS },
    { op: "ilike", col: "full_name", val: "Total" },
  ])
  const exactContacts = contacts.filter((c) => c.full_name?.trim().toLowerCase() === "total")

  const contactIds = exactContacts.map((c) => c.id)
  const donors = contactIds.length
    ? await fetchAll("donors", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "contact_id", val: contactIds },
      ])
    : []

  const donorIds = donors.map((d) => d.id)
  const pledges = donorIds.length
    ? await fetchAll("pledges", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []
  const payments = donorIds.length
    ? await fetchAll("payments", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []

  const pledgeIds = pledges.map((p) => p.id)
  const paymentIds = payments.map((p) => p.id)

  const recurringPlans = donorIds.length
    ? await fetchAll("recurring_donation_plans", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []

  const receiptsByPayment = paymentIds.length
    ? await fetchAll("donation_receipts", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "payment_id", val: paymentIds },
      ])
    : []
  const receiptsByDonor = donorIds.length
    ? await fetchAll("donation_receipts", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []
  const receiptIds = [
    ...new Set([...receiptsByPayment, ...receiptsByDonor].map((r) => r.id)),
  ]

  const pledgeReminders = pledgeIds.length
    ? await fetchAll("pledge_reminders", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "pledge_id", val: pledgeIds },
      ])
    : []

  const report = {
    mode: execute ? "execute" : "preview",
    organizationId: MAS,
    contacts: exactContacts.map((c) => ({ id: c.id, full_name: c.full_name })),
    donors: donors.map((d) => ({ id: d.id, full_name: d.full_name, contact_id: d.contact_id })),
    inventory: {
      pledges: pledges.length,
      payments: payments.length,
      recurringPlans: recurringPlans.length,
      receipts: receiptIds.length,
      pledgeReminders: pledgeReminders.length,
      pledgeTotal: pledges.reduce((sum, p) => sum + Number(p.amount_pledged || 0), 0),
      paymentTotal: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      taggedPledges: pledges.filter((p) => String(p.notes || "").includes(IMPORT_TAG)).length,
      taggedPayments: payments.filter((p) => String(p.memo || "").includes(IMPORT_TAG)).length,
    },
    steps: [],
  }

  if (!donorIds.length) {
    report.message = 'No donor with contact name "Total" found.'
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (execute) {
    report.steps.push({
      table: "donation_receipts",
      deleted: await deleteByIds("donation_receipts", receiptIds),
    })
    report.steps.push({
      table: "pledge_reminders",
      deleted: await deleteByIds("pledge_reminders", pledgeReminders.map((r) => r.id)),
    })
    report.steps.push({ table: "payments", deleted: await deleteByIds("payments", paymentIds) })
    report.steps.push({ table: "pledges", deleted: await deleteByIds("pledges", pledgeIds) })
    report.steps.push({
      table: "recurring_donation_plans",
      deleted: await deleteByIds("recurring_donation_plans", recurringPlans.map((r) => r.id)),
    })
    report.steps.push({ table: "donors", deleted: await deleteByIds("donors", donorIds) })

    for (const contactId of contactIds) {
      const remainingDonors = await fetchAll("donors", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "eq", col: "contact_id", val: contactId },
      ])
      if (remainingDonors.length === 0) {
        await sb.from("donation_receipts").delete().eq("organization_id", MAS).eq("contact_id", contactId)
        await sb.from("contact_roles").delete().eq("contact_id", contactId)
        await sb.from("contact_notes").delete().eq("contact_id", contactId)
        report.steps.push({
          table: "contacts",
          deleted: await deleteByIds("contacts", [contactId]),
        })
      }
    }
  } else {
    report.steps.push({ dryRun: true, wouldDelete: report.inventory })
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `mas-ledger-total-donor-cleanup-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  if (!execute) {
    console.error('Dry run only. Re-run with --execute to delete the "Total" donor and linked rows.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
