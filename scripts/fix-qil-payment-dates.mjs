/**
 * Backfill QIL imported charges: set paid_at / due_today from program_charge_schedule.
 * Usage: node scripts/fix-qil-payment-dates.mjs --execute
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_NAME = "Quran Institute for Ladies 2025-2026"
const execute = process.argv.includes("--execute")

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

async function main() {
  loadEnvLocal()
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: program, error } = await sb
    .from("programs")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()
  if (error || !program) throw new Error(error?.message || "Program not found")

  const { data: charges, error: chargeError } = await sb
    .from("program_charges")
    .select("id, amount_paid, total, paid_at, due_today, metadata")
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)

  if (chargeError) throw new Error(chargeError.message)

  const chargeIds = (charges || []).map((c) => c.id)
  const { data: schedules } = await sb
    .from("program_charge_schedule")
    .select("charge_id, amount, due_date, paid_at, status")
    .eq("organization_id", ORG_ID)
    .in("charge_id", chargeIds)
    .eq("status", "paid")
    .order("paid_at", { ascending: true })

  const schedulesByCharge = new Map()
  for (const row of schedules || []) {
    if (!schedulesByCharge.has(row.charge_id)) schedulesByCharge.set(row.charge_id, [])
    schedulesByCharge.get(row.charge_id).push(row)
  }

  let updated = 0
  for (const charge of charges || []) {
    const paidRows = schedulesByCharge.get(charge.id) || []
    const firstPaid = paidRows[0]
    const paidAt =
      firstPaid?.paid_at ||
      (firstPaid?.due_date ? `${firstPaid.due_date}T12:00:00Z` : null)
    const total = Number(charge.total || 0)
    const paid = Number(charge.amount_paid || 0)
    const dueToday = Math.max(total - paid, 0)

    if (!execute) {
      if (paidAt || dueToday !== Number(charge.due_today || 0)) updated += 1
      continue
    }

    const { error: updateError } = await sb
      .from("program_charges")
      .update({
        ...(paidAt ? { paid_at: paidAt } : {}),
        due_today: dueToday,
      })
      .eq("id", charge.id)
      .eq("organization_id", ORG_ID)

    if (updateError) {
      console.warn(charge.id, updateError.message)
      continue
    }
    updated += 1
  }

  console.log({
    charges: charges?.length || 0,
    withPaidSchedules: schedulesByCharge.size,
    updated,
    mode: execute ? "execute" : "dry-run",
  })
  if (!execute) console.log("Re-run with --execute to apply.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
