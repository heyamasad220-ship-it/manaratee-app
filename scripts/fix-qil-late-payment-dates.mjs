/**
 * One-time: move QIL 2025–26 charge schedule payment dates after 2026-04-30
 * to 2026-04-15 so they land in that academic year (Payment transactions + P&L).
 *
 * Usage:
 *   node scripts/fix-qil-late-payment-dates.mjs
 *   node scripts/fix-qil-late-payment-dates.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_NAME = "Quran Institute for Ladies 2025-2026"
const CUTOFF = "2026-04-30"
const TARGET_DATE = "2026-04-15"
const TARGET_PAID_AT = "2026-04-15T12:00:00.000Z"
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

function dayOf(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: program, error } = await sb
    .from("programs")
    .select("id, name, start_date, end_date")
    .eq("organization_id", ORG_ID)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()

  if (error || !program) {
    throw new Error(error?.message || `Program not found: ${PROGRAM_NAME}`)
  }

  const { data: charges, error: chargeError } = await sb
    .from("program_charges")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)

  if (chargeError) throw new Error(chargeError.message)

  const chargeIds = (charges || []).map((c) => c.id)
  if (chargeIds.length === 0) {
    console.log("No charges for program.")
    return
  }

  const { data: schedules, error: scheduleError } = await sb
    .from("program_charge_schedule")
    .select("id, charge_id, label, amount, status, due_date, paid_at")
    .eq("organization_id", ORG_ID)
    .in("charge_id", chargeIds)
    .in("status", ["paid", "void", "refunded"])

  if (scheduleError) throw new Error(scheduleError.message)

  const toFix = (schedules || []).filter((row) => {
    const due = dayOf(row.due_date)
    const paid = dayOf(row.paid_at)
    return (due && due > CUTOFF) || (paid && paid > CUTOFF)
  })

  console.log(
    `${execute ? "EXECUTE" : "dry-run"}: ${toFix.length} schedule rows after ${CUTOFF} → ${TARGET_DATE}`
  )

  const report = {
    mode: execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    program: { id: program.id, name: program.name },
    cutoff: CUTOFF,
    targetDate: TARGET_DATE,
    count: toFix.length,
    rows: toFix.map((row) => ({
      id: row.id,
      label: row.label,
      amount: row.amount,
      status: row.status,
      due_date: row.due_date,
      paid_at: row.paid_at,
    })),
  }

  if (execute && toFix.length > 0) {
    const ids = toFix.map((row) => row.id)
    const chunkSize = 50
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { error: updateError } = await sb
        .from("program_charge_schedule")
        .update({
          due_date: TARGET_DATE,
          paid_at: TARGET_PAID_AT,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", ORG_ID)
        .in("id", chunk)
      if (updateError) throw new Error(updateError.message)
    }

    // Keep charge.paid_at in sync with earliest paid schedule after fix.
    for (const chargeId of chargeIds) {
      const { data: paidRows } = await sb
        .from("program_charge_schedule")
        .select("paid_at, due_date")
        .eq("organization_id", ORG_ID)
        .eq("charge_id", chargeId)
        .eq("status", "paid")
        .order("paid_at", { ascending: true })
        .limit(1)

      const first = paidRows?.[0]
      const paidAt =
        first?.paid_at ||
        (first?.due_date ? `${first.due_date}T12:00:00.000Z` : null)
      if (!paidAt) continue

      await sb
        .from("program_charges")
        .update({ paid_at: paidAt, updated_at: new Date().toISOString() })
        .eq("organization_id", ORG_ID)
        .eq("id", chargeId)
    }

    console.log(`Updated ${toFix.length} schedule rows.`)
  } else if (!execute) {
    console.log("Re-run with --execute to write.")
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const out = resolve(
    reportsDir,
    `qil-late-payment-dates-${new Date().toISOString().slice(0, 10)}${execute ? "-execute" : "-dry"}.json`
  )
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`Report: ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
