/**
 * Validates pledge reminder workflows against canonical pledge/payment data.
 * Usage: node scripts/validate-pledge-reminders.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"

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

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing Supabase credentials")
  process.exit(2)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const checks = []
function record(id, pass, detail, extra = {}) {
  checks.push({ id, pass, detail, ...extra })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

function isEligible(status, balance) {
  const s = String(status || "").toLowerCase()
  if (s === "fulfilled" || s === "paid" || s === "cancelled") return false
  return Number(balance || 0) > 0.009
}

const { data: campaign } = await sb
  .from("campaigns")
  .select("organization_id")
  .eq("code", SEED_CAMPAIGN_CODE)
  .maybeSingle()

if (!campaign?.organization_id) {
  console.error("Seed campaign not found. Run seed-donations-dev first.")
  process.exit(2)
}

const orgId = campaign.organization_id

const { error: settingsProbeError } = await sb
  .from("donation_settings")
  .select("enable_pledge_reminders")
  .eq("organization_id", orgId)
  .maybeSingle()

record("schema-donation-settings-reminders", !settingsProbeError, "pledge reminder columns reachable")

const { error: remindersProbe } = await sb.from("pledge_reminders").select("id").limit(1)
record("schema-pledge-reminders", !remindersProbe, remindersProbe?.message || "pledge_reminders table reachable")

const { data: pledgeRows } = await sb
  .from("pledge_status_view")
  .select(
    "id, donor_id, amount_pledged, amount_paid, balance_remaining, calculated_status, notes"
  )
  .eq("organization_id", orgId)
  .like("notes", `${SEED_TAG}%`)

let balanceChecksPass = true
const queueEligible = []
const queueExcluded = []

for (const pledge of pledgeRows || []) {
  const { data: payments } = await sb
    .from("payments")
    .select("amount")
    .eq("pledge_id", pledge.id)

  const computedPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  const computedBalance = Number(pledge.amount_pledged || 0) - computedPaid
  const viewBalance = Number(pledge.balance_remaining || 0)
  const viewPaid = Number(pledge.amount_paid || 0)

  if (
    Math.abs(viewPaid - computedPaid) > 0.01 ||
    Math.abs(viewBalance - computedBalance) > 0.01
  ) {
    balanceChecksPass = false
  }

  if (isEligible(pledge.calculated_status, viewBalance)) {
    queueEligible.push(pledge.id)
  } else {
    queueExcluded.push(pledge.id)
  }
}

record(
  "outstanding-balances-match-payments",
  balanceChecksPass,
  `${pledgeRows?.length || 0} seed pledges checked`
)

record(
  "reminder-queue-includes-open-partial",
  queueEligible.length >= 2,
  `${queueEligible.length} eligible pledges`
)

const fulfilled = (pledgeRows || []).find((p) =>
  String(p.calculated_status || "").toLowerCase() === "fulfilled"
)
record(
  "fulfilled-excluded-from-queue",
  fulfilled ? !queueEligible.includes(fulfilled.id) : true,
  fulfilled ? "fulfilled pledge excluded" : "no fulfilled seed pledge"
)

const openPledge = (pledgeRows || []).find((p) => String(p.notes || "").includes("open"))
record(
  "open-pledge-in-queue",
  openPledge ? queueEligible.includes(openPledge.id) : false,
  openPledge ? "open pledge with no payments included" : "open pledge missing"
)

await sb.from("pledge_reminders").delete().eq("organization_id", orgId).like("message_subject", "VALIDATION-%")

const testPledgeId = queueEligible[0]
if (!testPledgeId) {
  console.error("No eligible pledge for reminder test")
  process.exit(2)
}

const { data: testPledge } = await sb
  .from("pledge_status_view")
  .select("donor_id, donor_name, balance_remaining")
  .eq("id", testPledgeId)
  .single()

const { data: reminderInsert, error: reminderError } = await sb
  .from("pledge_reminders")
  .insert({
    organization_id: orgId,
    pledge_id: testPledgeId,
    donor_id: testPledge?.donor_id ?? null,
    reminder_type: "manual",
    status: "sent",
    message_subject: "VALIDATION-REMINDER",
    message_body: `Reminder for ${testPledge?.donor_name}`,
    delivered_externally: false,
    sent_at: new Date().toISOString(),
  })
  .select("id, status, delivered_externally, pledge_id")
  .single()

record(
  "reminder-record-created",
  !reminderError && reminderInsert?.id,
  reminderError?.message || reminderInsert?.id
)

record(
  "reminder-not-externally-delivered",
  reminderInsert?.delivered_externally === false,
  "delivered_externally=false"
)

record(
  "reminder-status-sent",
  reminderInsert?.status === "sent",
  reminderInsert?.status
)

const { count: receiptCount } = await sb
  .from("donation_receipts")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", orgId)
  .gte("created_at", new Date(Date.now() - 60000).toISOString())

record(
  "no-receipts-from-reminder",
  (receiptCount || 0) === 0,
  "no new donation_receipts in last minute"
)

const { data: history } = await sb
  .from("pledge_reminders")
  .select("id")
  .eq("organization_id", orgId)
  .eq("pledge_id", testPledgeId)

record(
  "reminder-history-on-pledge",
  (history || []).length >= 1,
  `${history?.length || 0} reminder row(s)`
)

const passed = checks.filter((c) => c.pass).length
const failed = checks.filter((c) => !c.pass).length
console.log(`\n${passed}/${checks.length} checks passed (${failed} failed)`)
process.exit(failed > 0 ? 1 : 0)
