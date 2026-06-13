/**
 * Probe payments_source_check by attempting minimal inserts (rolled back via delete).
 * Usage: node scripts/inspect-payments-source-constraint.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

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

const candidates = [
  "cash",
  "check",
  "zelle",
  "venmo",
  "stripe",
  "import",
  "Cash",
  "Check",
  "Zelle",
  "Venmo",
  "Stripe",
  "Seed Zelle",
  "Seed Cash",
  "Seed Check",
  "Seed Venmo",
  "PayPal",
  "paypal",
  "manual",
  "unknown",
]

const { data: org } = await sb.from("organizations").select("id").limit(1).maybeSingle()
if (!org?.id) {
  console.error("No organization found")
  process.exit(2)
}

const { data: distinct } = await sb.from("payments").select("source").limit(500)
const inUse = [...new Set((distinct || []).map((r) => r.source).filter(Boolean))]

const { data: methods } = await sb
  .from("payment_methods")
  .select("name")
  .eq("organization_id", org.id)
  .limit(50)

const orgMethodNames = [...new Set((methods || []).map((m) => m.name).filter(Boolean))]
const allCandidates = [...new Set([...candidates, ...orgMethodNames])]

const probeResults = []
for (const source of allCandidates) {
  const { data, error } = await sb
    .from("payments")
    .insert({
      organization_id: org.id,
      amount: 0.01,
      payment_date: new Date().toISOString(),
      source,
      source_type: "portal",
      status: "pending_review",
    })
    .select("id")
    .single()

  probeResults.push({
    source,
    allowed: !error,
    error: error?.message ?? null,
    violates_source_check: error?.message?.includes("payments_source_check") ?? false,
  })

  if (data?.id) {
    await sb.from("payments").delete().eq("id", data.id)
  }
}

console.log(
  JSON.stringify(
    {
      constraint: "payments_source_check",
      sources_in_existing_rows: inUse,
      org_payment_method_names: orgMethodNames,
      probe: probeResults,
      inferred_allowed: probeResults.filter((r) => r.allowed).map((r) => r.source),
      inferred_rejected: probeResults.filter((r) => !r.allowed).map((r) => r.source),
    },
    null,
    2
  )
)
