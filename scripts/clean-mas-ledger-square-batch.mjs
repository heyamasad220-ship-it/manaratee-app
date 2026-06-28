/**
 * Remove incorrectly imported "Square" donor (payment terminal batch) and re-record
 * the amount as a campaign batch deposit (no People contact).
 *
 * Usage:
 *   node scripts/clean-mas-ledger-square-batch.mjs
 *   node scripts/clean-mas-ledger-square-batch.mjs --execute
 *   node scripts/clean-mas-ledger-square-batch.mjs --org <uuid> --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const BATCH_NAME = "square"
const STAMP = new Date().toISOString().slice(0, 10)

function parseArgs(argv) {
  const args = { orgId: DEFAULT_ORG_ID }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--org") args.orgId = argv[++index]
  }
  return args
}

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

function buildBatchMemo(campaignName, importTag) {
  const tag = importTag || "MAS_CAMPAIGN_LEDGER_V1"
  const campaign = String(campaignName || "campaign").trim()
  return `${tag}|batch|square|${campaign}`
}

async function main() {
  const { orgId } = parseArgs(process.argv.slice(2))

  const contacts = await fetchAll("contacts", [
    { op: "eq", col: "organization_id", val: orgId },
    { op: "ilike", col: "full_name", val: BATCH_NAME },
  ])
  const exactContacts = contacts.filter((c) => c.full_name?.trim().toLowerCase() === BATCH_NAME)

  const contactIds = exactContacts.map((c) => c.id)
  const donors = contactIds.length
    ? await fetchAll("donors", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "in", col: "contact_id", val: contactIds },
      ])
    : []

  const donorIds = donors.map((d) => d.id)
  const pledges = donorIds.length
    ? await fetchAll("pledges", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []
  const payments = donorIds.length
    ? await fetchAll("payments", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []

  const pledgeIds = pledges.map((p) => p.id)
  const paymentIds = payments.map((p) => p.id)

  const receiptsByPayment = paymentIds.length
    ? await fetchAll("donation_receipts", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "in", col: "payment_id", val: paymentIds },
      ])
    : []
  const receiptsByDonor = donorIds.length
    ? await fetchAll("donation_receipts", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []
  const receiptIds = [...new Set([...receiptsByPayment, ...receiptsByDonor].map((r) => r.id))]

  const pledgeReminders = pledgeIds.length
    ? await fetchAll("pledge_reminders", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "in", col: "pledge_id", val: pledgeIds },
      ])
    : []

  const recurringPlans = donorIds.length
    ? await fetchAll("recurring_donation_plans", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "in", col: "donor_id", val: donorIds },
      ])
    : []

  const batchPaymentsToCreate = payments
    .filter((p) => String(p.status || "").toLowerCase() !== "voided")
    .map((p) => {
      const campaignId = p.campaign_id || pledges.find((pl) => pl.id === p.pledge_id)?.campaign_id || null
      return {
        organization_id: orgId,
        donor_id: null,
        contact_id: null,
        pledge_id: null,
        campaign_id: campaignId,
        sender_name: null,
        amount: Number(p.amount || 0),
        payment_date: p.payment_date,
        source: "manual",
        source_type: "import",
        status: "unallocated",
        memo: buildBatchMemo(
          p.memo?.split("|").pop()?.trim() ||
            pledges.find((pl) => pl.id === p.pledge_id)?.notes?.split("|").pop(),
          String(p.memo || "").split("|")[0]
        ),
        is_verified: false,
      }
    })

  const report = {
    mode: execute ? "execute" : "preview",
    organizationId: orgId,
    contacts: exactContacts.map((c) => ({ id: c.id, full_name: c.full_name })),
    donors: donors.map((d) => ({ id: d.id, full_name: d.full_name, contact_id: d.contact_id })),
    inventory: {
      pledges: pledges.length,
      payments: payments.length,
      recurringPlans: recurringPlans.length,
      receipts: receiptIds.length,
      pledgeReminders: pledgeReminders.length,
      paymentTotal: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    },
    batchPaymentsToCreate,
    steps: [],
  }

  if (!donorIds.length) {
    report.message = 'No donor with contact name "Square" found.'
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
        { op: "eq", col: "organization_id", val: orgId },
        { op: "eq", col: "contact_id", val: contactId },
      ])
      if (remainingDonors.length === 0) {
        if (execute) {
          await sb.from("donation_receipts").delete().eq("organization_id", orgId).eq("contact_id", contactId)
          await sb.from("contact_roles").delete().eq("contact_id", contactId)
          await sb.from("contact_notes").delete().eq("contact_id", contactId)
        }
        report.steps.push({
          table: "contacts",
          deleted: await deleteByIds("contacts", [contactId]),
        })
      }
    }

    const createdPayments = []
    for (const payload of batchPaymentsToCreate) {
      if (payload.amount <= 0 || !payload.campaign_id) {
        report.steps.push({
          table: "payments",
          skipped: payload,
          reason: "missing campaign or zero amount",
        })
        continue
      }

      const { data, error } = await sb.from("payments").insert(payload).select("id, amount, campaign_id, memo").single()
      if (error) throw new Error(`batch payment insert: ${error.message}`)
      createdPayments.push(data)
    }

    report.steps.push({
      table: "payments",
      created: createdPayments.length,
      rows: createdPayments,
    })
  } else {
    report.steps.push({ dryRun: true, wouldDelete: report.inventory, wouldCreate: batchPaymentsToCreate })
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `mas-ledger-square-batch-cleanup-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  if (!execute) {
    console.error('Dry run only. Re-run with --execute to migrate "Square" to a campaign batch deposit.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
