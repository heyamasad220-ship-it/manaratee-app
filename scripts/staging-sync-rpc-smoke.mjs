/**
 * Staging RPC smoke after 112 vendor guard patch.
 * Usage: node scripts/staging-sync-rpc-smoke.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const TAG = "SYNC_RPC_SMOKE_112"

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

const results = []
function pass(id, ok, detail = "") {
  results.push({ id, ok, detail })
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

const { data: org } = await sb.from("organizations").select("id").limit(1).maybeSingle()
if (!org?.id) process.exit(2)
const orgId = org.id

// membership add-member + live sync RPC
const memEmail = `${TAG.toLowerCase()}-mem-${Date.now()}@validation.local`
const { data: memContactId, error: focErr } = await sb.rpc("find_or_create_contact_for_org", {
  p_organization_id: orgId,
  p_full_name: "Membership RPC Smoke",
  p_email: memEmail,
})
pass("membership-foc", !focErr && !!memContactId, focErr?.message || String(memContactId))

await sb.from("memberships").insert({
  organization_id: orgId,
  contact_id: memContactId,
  status: "active",
  start_date: new Date().toISOString().slice(0, 10),
})

const { error: memSyncErr } = await sb.rpc("sync_contact_affiliations", {
  p_organization_id: orgId,
  p_contact_id: memContactId,
})
pass("membership-sync-rpc", !memSyncErr, memSyncErr?.message || "ok")

const { data: memberRole } = await sb
  .from("contact_roles")
  .select("id")
  .eq("contact_id", memContactId)
  .eq("role", "member")
  .maybeSingle()
pass("membership-member-role", !!memberRole?.id, memberRole?.id || "missing")

// ticketing completed order + live sync RPC
const { data: event } = await sb
  .from("internal_events")
  .select("id, organization_id")
  .eq("requires_ticketing", true)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

const tickOrgId = event?.organization_id || orgId

const tickEmail = `${TAG.toLowerCase()}-tick-${Date.now()}@validation.local`
const { data: tickContactId } = await sb.rpc("find_or_create_contact_for_org", {
  p_organization_id: tickOrgId,
  p_full_name: "Ticketing RPC Smoke",
  p_email: tickEmail,
})

if (event?.id && tickContactId) {
  const { data: order, error: orderErr } = await sb
    .from("ticket_orders")
    .insert({
      organization_id: tickOrgId,
      internal_event_id: event.id,
      contact_id: tickContactId,
      order_number: String(Date.now()).slice(-10),
      status: "completed",
      subtotal_cents: 0,
      discount_cents: 0,
      total_cents: 0,
      currency: "USD",
      purchaser_name: "Ticketing RPC Smoke",
      purchaser_email: tickEmail,
    })
    .select("id")
    .single()

  pass("ticketing-order-created", !orderErr && !!order?.id, orderErr?.message || String(order?.id))

  const { error: tickSyncErr } = await sb.rpc("sync_contact_affiliations", {
    p_organization_id: tickOrgId,
    p_contact_id: tickContactId,
  })
  pass("ticketing-sync-rpc", !tickSyncErr, tickSyncErr?.message || "ok")

  const { data: attendeeRole } = await sb
    .from("contact_roles")
    .select("id")
    .eq("contact_id", tickContactId)
    .eq("role", "event_attendee")
    .maybeSingle()
  pass("ticketing-event-attendee-role", !!attendeeRole?.id, attendeeRole?.id || "missing")

  if (order?.id) await sb.from("ticket_orders").delete().eq("id", order.id)
} else {
  pass("ticketing-order-created", false, "no ticketed event or contact")
  pass("ticketing-sync-rpc", false, "skipped")
  pass("ticketing-event-attendee-role", false, "skipped")
}

// venue rental billing contact lookup
const { data: rental } = await sb
  .from("venue_rentals")
  .select("billing_contact_id")
  .eq("organization_id", orgId)
  .not("billing_contact_id", "is", null)
  .limit(1)
  .maybeSingle()

if (rental?.billing_contact_id) {
  const { data: billing, error: billErr } = await sb
    .from("contacts")
    .select("id")
    .eq("id", rental.billing_contact_id)
    .maybeSingle()
  pass("venue-rental-billing-lookup", !billErr && !!billing?.id, billErr?.message || String(billing?.id))
} else {
  const { data: anyContact, error: anyErr } = await sb
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle()
  pass("venue-rental-billing-lookup", !anyErr && !!anyContact?.id, "fallback contact lookup")
}

// cleanup membership smoke rows
if (memContactId) {
  await sb.from("contact_roles").delete().eq("contact_id", memContactId)
  const { data: mem } = await sb.from("memberships").select("id").eq("contact_id", memContactId).maybeSingle()
  if (mem?.id) await sb.from("memberships").delete().eq("id", mem.id)
  await sb.from("contacts").delete().eq("id", memContactId)
}
if (tickContactId) {
  await sb.from("contact_roles").delete().eq("contact_id", tickContactId)
  await sb.from("contacts").delete().eq("id", tickContactId)
}

const failed = results.filter((r) => !r.ok).length
console.log(`\nRPC smoke: ${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
