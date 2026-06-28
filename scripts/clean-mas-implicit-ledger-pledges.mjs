/**
 * Remove implicit MAS ledger pledges created when the Pledge column was blank.
 * Keeps explicit pledges (Pledge column > 0). Unlinks linked payments as one-time
 * donations (status unallocated, pledge_id null).
 *
 * Usage:
 *   node scripts/clean-mas-implicit-ledger-pledges.mjs --file "C:/path/All Campaigns.csv"
 *   node scripts/clean-mas-implicit-ledger-pledges.mjs --file "..." --contact "Fadia Salameh"
 *   node scripts/clean-mas-implicit-ledger-pledges.mjs --file "..." --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const IMPORT_TAG = "MAS_CAMPAIGN_LEDGER_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const execute = process.argv.includes("--execute")

function loadEnv() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

function parseArgs(argv) {
  const args = { file: null, contact: null, orgId: DEFAULT_ORG_ID }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--file") args.file = argv[++i]
    else if (arg === "--contact") args.contact = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeNameForMatch(value) {
  const withoutParens = normalizeText(value).replace(/\([^)]*\)/g, " ")
  return normalizeName(withoutParens).replace(/^(dr|mr|mrs|ms|sheikh)\s+/, "")
}

function parseMoney(value) {
  const cleaned = normalizeText(value).replace(/[$,]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstPositiveAmount(row, keys) {
  for (const key of keys) {
    if (row[key] === undefined || row[key] === "") continue
    const amount = parseMoney(row[key])
    if (amount > 0) return amount
  }
  return 0
}

function getLedgerAmounts(row) {
  const pledge = parseMoney(row.Pledge)
  const cash = parseMoney(row.Cash)
  const checks = parseMoney(row.Checks)
  const oneTime = firstPositiveAmount(row, ["One-time", "One Time", "CC", "One-Time"])
  const recurring = firstPositiveAmount(row, ["Recurring", "CC+", "CC +"])
  const totalPaid = cash + checks + oneTime + recurring
  return { pledge, totalPaid }
}

const LEDGER_SUMMARY_ROW_NAMES = new Set(["total", "subtotal", "grand total"])
const LEDGER_BATCH_DEPOSIT_NAMES = new Set(["square"])

function buildRowKey(rowIndex, row) {
  const campaign = normalizeText(row.Campaign)
  const name = normalizeNameForMatch(row.Name)
  const phone = normalizeText(row.phone).replace(/\D/g, "")
  const amounts = getLedgerAmounts(row)
  const payload = [
    rowIndex,
    campaign,
    name,
    phone,
    amounts.pledge.toFixed(2),
    parseMoney(row.Cash).toFixed(2),
    parseMoney(row.Checks).toFixed(2),
    firstPositiveAmount(row, ["One-time", "One Time", "CC", "One-Time"]).toFixed(2),
    firstPositiveAmount(row, ["Recurring", "CC+", "CC +"]).toFixed(2),
  ].join("|")

  const hash = createHash("sha1").update(payload).digest("hex").slice(0, 12)
  return `${IMPORT_TAG}|${hash}`
}

loadEnv()

const args = parseArgs(process.argv.slice(2))
if (!args.file) {
  console.error("Usage: node scripts/clean-mas-implicit-ledger-pledges.mjs --file <csv> [--contact name] [--execute]")
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, buildQuery) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + 999)
    q = buildQuery(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function main() {
  const csvText = readFileSync(resolve(args.file), "utf8")
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  const rows = parsed.data

  const implicitRowKeys = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const campaignName = normalizeText(row.Campaign)
    const displayName = normalizeText(row.Name)
    const amounts = getLedgerAmounts(row)

    if (!campaignName || !displayName) continue
    if (LEDGER_SUMMARY_ROW_NAMES.has(normalizeName(displayName))) continue
    if (LEDGER_BATCH_DEPOSIT_NAMES.has(normalizeName(displayName))) continue
    if (amounts.pledge > 0) continue
    if (amounts.totalPaid <= 0) continue

    if (args.contact && normalizeNameForMatch(displayName) !== normalizeNameForMatch(args.contact)) {
      continue
    }

    implicitRowKeys.push({
      rowKey: buildRowKey(index + 2, row),
      name: displayName,
      campaign: campaignName,
      totalPaid: amounts.totalPaid,
    })
  }

  if (implicitRowKeys.length === 0) {
    console.log("No implicit pledge rows found in CSV for the given filters.")
    return
  }

  const pledges = await fetchAll("pledges", (q) =>
    q.eq("organization_id", args.orgId).ilike("notes", `${IMPORT_TAG}|%`)
  )

  const payments = await fetchAll("payments", (q) =>
    q.eq("organization_id", args.orgId).ilike("memo", `${IMPORT_TAG}|%`)
  )

  const report = {
    mode: execute ? "execute" : "dry-run",
    implicitRowsInCsv: implicitRowKeys.length,
    pledgesRemoved: 0,
    paymentsUnlinked: 0,
    remindersRemoved: 0,
    samples: [],
  }

  for (const target of implicitRowKeys) {
    const matchingPledges = pledges.filter((pledge) =>
      String(pledge.notes || "").startsWith(target.rowKey)
    )

    for (const pledge of matchingPledges) {
      const linkedPayments = payments.filter((payment) => payment.pledge_id === pledge.id)

      if (report.samples.length < 12) {
        report.samples.push({
          rowKey: target.rowKey,
          name: target.name,
          campaign: target.campaign,
          pledgeId: pledge.id,
          pledgeAmount: pledge.amount_pledged,
          linkedPayments: linkedPayments.length,
        })
      }

      if (execute) {
        for (const payment of linkedPayments) {
          const { error } = await sb
            .from("payments")
            .update({ pledge_id: null, status: "unallocated" })
            .eq("id", payment.id)
            .eq("organization_id", args.orgId)
          if (error) throw new Error(`payment update ${payment.id}: ${error.message}`)
        }

        const { error: reminderError } = await sb
          .from("pledge_reminders")
          .delete()
          .eq("organization_id", args.orgId)
          .eq("pledge_id", pledge.id)
        if (reminderError && reminderError.code !== "42P01") {
          throw new Error(`pledge_reminders delete: ${reminderError.message}`)
        }

        const { error: pledgeError } = await sb
          .from("pledges")
          .delete()
          .eq("id", pledge.id)
          .eq("organization_id", args.orgId)
        if (pledgeError) throw new Error(`pledge delete ${pledge.id}: ${pledgeError.message}`)
      }

      report.paymentsUnlinked += linkedPayments.length
      report.pledgesRemoved += 1
      if (execute) report.remindersRemoved += 1
    }
  }

  const outDir = resolve(root, "scripts", "reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "mas-implicit-ledger-pledges-cleanup.json")
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${outPath}`)
  if (!execute) {
    console.log("\nDry run only. Re-run with --execute to apply changes.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
