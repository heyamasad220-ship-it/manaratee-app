import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORG = "e057e00a-e4e3-4adf-9af5-f465db1894be"

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
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fetchAllPayments() {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from("payments")
      .select("id, memo, recurring_donation_plan_id, amount, sender_name, payment_date, donor_id")
      .eq("organization_id", ORG)
      .like("memo", "MADINA_SQUARE_DONATIONS_V1%")
      .range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

const payments = await fetchAllPayments()

const linked = payments.filter((p) => p.recurring_donation_plan_id)
const unlinked = payments.filter((p) => !p.recurring_donation_plan_id)
console.log("Square payments:", payments.length)
console.log("Linked:", linked.length, "Unlinked:", unlinked.length)

const { data: plans } = await sb
  .from("recurring_donation_plans")
  .select("id, frequency, status, amount, donor_id, donors(full_name)")
  .eq("organization_id", ORG)

console.log("Plans:", plans?.length)
const byFreq = {}
for (const p of plans || []) byFreq[p.frequency] = (byFreq[p.frequency] || 0) + 1
console.log("By frequency:", byFreq)

const akram = payments.filter((p) =>
  String(p.sender_name || "").toLowerCase().includes("akram")
)
console.log("\nAkram:", akram.length, "linked:", akram.filter((p) => p.recurring_donation_plan_id).length)
const recurTypes = {}
for (const p of akram) {
  const key = p.recurring_donation_plan_id ? "linked" : "unlinked"
  recurTypes[key] = (recurTypes[key] || 0) + 1
}
console.log("Akram breakdown:", recurTypes)
for (const p of akram.slice(0, 8)) {
  console.log(" ", p.payment_date?.slice(0, 10), p.amount, p.recurring_donation_plan_id ? "LINKED" : "unlinked", p.memo?.slice(0, 60))
}

const { data: donors } = await sb
  .from("donor_summary_view")
  .select("id, full_name, total_donations")
  .eq("organization_id", ORG)
  .gte("total_donations", 8000)
  .lte("total_donations", 8100)

console.log("\nDonors ~8044:", donors?.map((d) => `${d.full_name}: $${d.total_donations}`))
