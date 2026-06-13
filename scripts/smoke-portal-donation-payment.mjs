/**
 * Simulates one customer portal one-time donation using a real seed payment method name.
 * Usage: node scripts/smoke-portal-donation-payment.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { normalizePaymentSourceChannel } from "./lib/payment-source-channel.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const SEED_EMAIL = "donations-seed-individual@dev.test"

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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: contact } = await sb
  .from("contacts")
  .select("id, full_name, email, organization_id")
  .eq("email", SEED_EMAIL)
  .maybeSingle()

if (!contact?.id) {
  console.error("Seed contact not found. Run seed-donations-dev first.")
  process.exit(1)
}

const { data: method } = await sb
  .from("payment_methods")
  .select("id, name")
  .eq("organization_id", contact.organization_id)
  .eq("name", "Seed Zelle")
  .maybeSingle()

const paymentMethodDisplay = method?.name || "Seed Zelle"
const source = normalizePaymentSourceChannel(paymentMethodDisplay)

const { data: donor } = await sb
  .from("donors")
  .select("id")
  .eq("organization_id", contact.organization_id)
  .eq("contact_id", contact.id)
  .maybeSingle()

const paymentDate = new Date().toISOString().split("T")[0]
const payload = {
  organization_id: contact.organization_id,
  contact_id: contact.id,
  donor_id: donor?.id ?? null,
  pledge_id: null,
  sender_name: contact.full_name || contact.email,
  amount: 19.99,
  payment_date: `${paymentDate}T12:00:00`,
  source,
  source_type: "portal",
  status: "unallocated",
  is_verified: false,
  memo: "PORTAL_SMOKE_ONE_TIME",
}

const { data: inserted, error } = await sb
  .from("payments")
  .insert(payload)
  .select("id, source, source_type, amount")
  .single()

if (error) {
  console.log(JSON.stringify({ ok: false, paymentMethodDisplay, source, error: error.message }, null, 2))
  process.exit(1)
}

await sb.from("payments").delete().eq("id", inserted.id)

console.log(
  JSON.stringify(
    {
      ok: true,
      paymentMethodDisplay,
      normalizedSource: source,
      inserted,
      cleanedUp: true,
      message: "Portal one-time payment path is safe for Seed Zelle",
    },
    null,
    2
  )
)
