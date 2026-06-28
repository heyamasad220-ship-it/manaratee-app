/**
 * Repair MAS campaign ledger imports: create implicit pledges and allocate payments.
 *
 * Business rules (MAS spreadsheet):
 * - Blank Pledge column + payment(s) → implicit fulfilled pledge = sum of payments
 * - Explicit Pledge column → pledge commitment; Cash/Checks/CC/CC+ are payments toward it
 * - CC (One-time) = one-time card payment toward pledge
 * - CC+ (Recurring) = installment payments toward pledge
 *
 * This script groups imported payments by ledger row tag (memo prefix) and:
 * 1. Creates a missing pledge when the row had payments but no explicit pledge was imported
 * 2. Links unallocated payments to the correct pledge (status = allocated)
 *
 * Does NOT delete or re-import. Safe to dry-run first.
 *
 * Usage:
 *   node scripts/repair-mas-ledger-implicit-pledges.mjs
 *   node scripts/repair-mas-ledger-implicit-pledges.mjs --execute
 *   node scripts/repair-mas-ledger-implicit-pledges.mjs --org <uuid> --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const IMPORT_TAG = "MAS_CAMPAIGN_LEDGER_V1"
const ROW_TAG_RE = new RegExp(`^${IMPORT_TAG}\\|[a-f0-9]{12}`)
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

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

function extractRowTag(memo) {
  const text = String(memo || "")
  const match = text.match(ROW_TAG_RE)
  return match ? match[0] : null
}

function paymentNetAmount(payment) {
  const amount = Number(payment.amount || 0)
  const refunded = Number(payment.refunded_amount || 0)
  return Math.max(amount - refunded, 0)
}

function isVoided(status) {
  return String(status || "").toLowerCase() === "voided"
}

function resolvePledgeStatus(amountPledged, amountPaid) {
  if (amountPaid >= amountPledged) return "fulfilled"
  if (amountPaid > 0) return "partial"
  return "open"
}

function resolvePledgeFrequency(payments) {
  const hasRecurringPayment = payments.some((payment) =>
    String(payment.memo || "").toLowerCase().includes("|recurring|")
  )
  return hasRecurringPayment ? "monthly" : "one_time"
}

async function fetchAll(sb, table, buildQuery) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await buildQuery(sb).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }

  return rows
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

async function main() {
  const report = {
    mode: execute ? "execute" : "dry-run",
    orgId: args.orgId,
    paymentGroups: 0,
    pledgesCreated: 0,
    pledgesUpdated: 0,
    paymentsAllocated: 0,
    alreadyCorrect: 0,
    skippedNoDonor: 0,
    warnings: [],
    samples: [],
  }

  const payments = await fetchAll(sb, "payments", (client) =>
    client
      .from("payments")
      .select(
        "id, organization_id, donor_id, contact_id, campaign_id, pledge_id, amount, refunded_amount, status, memo, payment_date, sender_name"
      )
      .eq("organization_id", args.orgId)
      .ilike("memo", `${IMPORT_TAG}|%`)
  )

  const groups = new Map()

  for (const payment of payments) {
    if (isVoided(payment.status)) continue

    const rowTag = extractRowTag(payment.memo)
    if (!rowTag) continue

    const bucket = groups.get(rowTag) || { rowTag, payments: [] }
    bucket.payments.push(payment)
    groups.set(rowTag, bucket)
  }

  report.paymentGroups = groups.size

  const pledges = await fetchAll(sb, "pledges", (client) =>
    client
      .from("pledges")
      .select("id, donor_id, campaign_id, amount_pledged, pledge_date, frequency, status, notes")
      .eq("organization_id", args.orgId)
      .ilike("notes", `%${IMPORT_TAG}|%`)
  )

  const pledgesByRowTag = new Map()
  for (const pledge of pledges) {
    const rowTag = extractRowTag(pledge.notes)
    if (!rowTag) continue
    if (pledgesByRowTag.has(rowTag)) {
      report.warnings.push({
        rowTag,
        message: "Multiple pledges share the same ledger row tag; using first match",
      })
      continue
    }
    pledgesByRowTag.set(rowTag, pledge)
  }

  for (const group of groups.values()) {
    const activePayments = group.payments.filter((payment) => !isVoided(payment.status))
    const unallocated = activePayments.filter(
      (payment) => !payment.pledge_id || String(payment.status || "").toLowerCase() === "unallocated"
    )

    if (unallocated.length === 0) {
      report.alreadyCorrect += 1
      continue
    }

    const anchor = activePayments.find((payment) => payment.donor_id && payment.campaign_id)
    if (!anchor?.donor_id || !anchor.campaign_id) {
      report.skippedNoDonor += 1
      continue
    }

    const totalPaid = activePayments.reduce((sum, payment) => sum + paymentNetAmount(payment), 0)
    let pledge = pledgesByRowTag.get(group.rowTag) || null

    if (!pledge) {
      const pledgeDate = String(anchor.payment_date || "").slice(0, 10) || "2023-12-31"
      const frequency = resolvePledgeFrequency(activePayments)
      const amountPledged = totalPaid
      const status = resolvePledgeStatus(amountPledged, totalPaid)

      if (execute) {
        const { data: created, error } = await sb
          .from("pledges")
          .insert({
            organization_id: args.orgId,
            donor_id: anchor.donor_id,
            campaign_id: anchor.campaign_id,
            amount_pledged: amountPledged,
            pledge_date: pledgeDate,
            pledge_type: frequency,
            frequency,
            status,
            notes: `${group.rowTag} | repaired implicit pledge`,
          })
          .select("id, amount_pledged")
          .single()

        if (error) {
          report.warnings.push({ rowTag: group.rowTag, message: error.message })
          continue
        }

        pledge = created
        pledgesByRowTag.set(group.rowTag, created)
      }

      report.pledgesCreated += 1

      if (report.samples.length < 10) {
        report.samples.push({
          action: "create_pledge",
          rowTag: group.rowTag,
          donor: anchor.sender_name,
          amountPledged: totalPaid,
          payments: unallocated.length,
        })
      }
    } else if (execute) {
      const nextStatus = resolvePledgeStatus(Number(pledge.amount_pledged || 0), totalPaid)
      if (nextStatus !== pledge.status) {
        const { error } = await sb
          .from("pledges")
          .update({ status: nextStatus })
          .eq("id", pledge.id)
          .eq("organization_id", args.orgId)

        if (error) {
          report.warnings.push({ rowTag: group.rowTag, message: error.message })
        } else {
          report.pledgesUpdated += 1
        }
      }
    }

    if (!execute) {
      report.paymentsAllocated += unallocated.length
      continue
    }

    if (!pledge?.id) continue

    for (const payment of unallocated) {
      const { error } = await sb
        .from("payments")
        .update({
          pledge_id: pledge.id,
          donor_id: payment.donor_id || anchor.donor_id,
          contact_id: payment.contact_id || anchor.contact_id,
          campaign_id: payment.campaign_id || anchor.campaign_id,
          status: "allocated",
          reconciled_at: payment.reconciled_at || new Date().toISOString(),
        })
        .eq("id", payment.id)
        .eq("organization_id", args.orgId)

      if (error) {
        report.warnings.push({ rowTag: group.rowTag, paymentId: payment.id, message: error.message })
        continue
      }

      report.paymentsAllocated += 1
    }
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const reportPath = resolve(reportsDir, `mas-ledger-implicit-pledge-repair-${stamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)

  if (!execute) {
    console.log("\nDry run only. Re-run with --execute to apply repairs.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
