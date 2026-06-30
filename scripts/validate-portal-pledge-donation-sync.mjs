/**
 * Validates S-05/S-06 portal + staff pledge donation affiliation sync wiring.
 * Usage: node scripts/validate-portal-pledge-donation-sync.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { applyDonorAffiliationMirror } from "./lib/contacts-phase1-validation.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const TAG = "PORTAL_PLEDGE_SYNC_VALIDATION"

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
function record(id, pass, detail) {
  checks.push({ id, pass, detail })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

const portalSource = readFileSync(
  resolve(root, "app/(customer)/customer/donation/page.tsx"),
  "utf8"
)
const pledgesSource = readFileSync(
  resolve(root, "app/(dashboard)/donations/(operations)/pledges/page.tsx"),
  "utf8"
)

record(
  "portal-offline-donation-sync-wired",
  portalSource.includes("portal offline one-time donation") &&
    portalSource.includes("handleDonationAffiliationSync"),
  "processOneTimeDonation calls affiliation sync"
)
record(
  "portal-pledge-payment-sync-wired",
  portalSource.includes("portal pledge payment") &&
    portalSource.includes("syncDonorAffiliationAfterDonation"),
  "processPayment calls affiliation sync"
)
record(
  "portal-pledge-creation-no-affiliation-sync",
  portalSource.includes("createPledge") &&
    !/createPledge[\s\S]*syncDonorAffiliationAfterDonation[\s\S]*portal pledge creation/.test(
      portalSource
    ),
  "createPledge does not sync donor affiliation on pledge-only save"
)
record(
  "portal-sync-failure-non-throwing",
  portalSource.includes("syncDonorAffiliationAfterDonation") &&
    portalSource.includes("try {") &&
    portalSource.includes("console.error") &&
    portalSource.includes("affiliation sync failed"),
  "portal sync wrapped with error logging"
)
function sliceFunction(source, functionName) {
  const marker = `const ${functionName} = async`
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const candidates = ["\n  const handle", "\n  const refresh", "\n  const getStatus"]
    .map((nextMarker) => source.indexOf(nextMarker, start + marker.length))
    .filter((index) => index !== -1)

  const end = candidates.length ? Math.min(...candidates) : source.length
  return source.slice(start, end)
}

record(
  "staff-pledge-creation-no-affiliation-sync",
  pledgesSource.includes("handleAddPledge") &&
    !sliceFunction(pledgesSource, "handleAddPledge").includes("handleDonationAffiliationSync"),
  "handleAddPledge does not sync donor affiliation on pledge-only save"
)
record(
  "staff-pledge-payment-sync-wired",
  pledgesSource.includes("pledge payment") &&
    pledgesSource.includes("handleDonationAffiliationSync"),
  "handleRecordPayment calls affiliation sync"
)

async function hasDonorRole(organizationId, contactId) {
  const { data, error } = await sb
    .from("contact_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", "donor")
    .limit(1)

  if (error) return { ok: false, error: error.message }
  return { ok: true, hasRole: (data || []).length > 0 }
}

async function applyDonorAffiliationMirrorForOrg(organizationId, contactId) {
  await applyDonorAffiliationMirror(sb, organizationId, contactId)
}

let { data: org } = await sb.from("organizations").select("id").limit(1).maybeSingle()

if (!org?.id) {
  console.error("No organization found for affiliation simulation")
  process.exit(2)
}

const orgId = org.id
const testEmail = `portal-pledge-sync-${Date.now()}@security.test`

const { data: contact, error: contactError } = await sb
  .from("contacts")
  .insert({
    organization_id: orgId,
    full_name: "Portal Pledge Sync Test",
    email: testEmail,
    contact_type: "individual",
    status: "active",
  })
  .select("id")
  .single()

if (contactError || !contact?.id) {
  console.error("Could not create test contact:", contactError?.message)
  process.exit(2)
}

const { data: donor, error: donorError } = await sb
  .from("donors")
  .insert({
    organization_id: orgId,
    contact_id: contact.id,
    donor_type: "individual",
    full_name: "Portal Pledge Sync Test",
    email: testEmail,
    status: "active",
  })
  .select("id, contact_id, organization_id")
  .single()

if (donorError || !donor?.id) {
  await sb.from("contacts").delete().eq("id", contact.id)
  console.error("Could not create test donor:", donorError?.message)
  process.exit(2)
}

const contactId = donor.contact_id
const pledgeDate = new Date().toISOString().slice(0, 10)

const { data: pledge, error: pledgeError } = await sb
  .from("pledges")
  .insert({
    organization_id: orgId,
    donor_id: donor.id,
    amount_pledged: 25,
    pledge_date: pledgeDate,
    pledge_type: "one_time",
    frequency: "one_time",
    status: "open",
    notes: TAG,
  })
  .select("id")
  .single()

record(
  "pledge-before-payment-simulation",
  !pledgeError && !!pledge?.id,
  pledgeError?.message || pledge?.id
)

if (pledge?.id) {
  try {
    await applyDonorAffiliationMirrorForOrg(orgId, contactId)
  } catch (error) {
    record("pledge-creation-donor-role", false, error.message)
  }

  const roleAfterPledge = await hasDonorRole(orgId, contactId)
  record(
    "pledge-creation-donor-role",
    roleAfterPledge.ok && !roleAfterPledge.hasRole,
    roleAfterPledge.error ||
      (roleAfterPledge.hasRole ? "donor role should not be assigned yet" : "no donor role (expected)")
  )

  const { data: payment, error: paymentError } = await sb
    .from("payments")
    .insert({
      organization_id: orgId,
      donor_id: donor.id,
      contact_id: contactId,
      pledge_id: pledge.id,
      amount: 10,
      payment_date: `${pledgeDate}T12:00:00`,
      source: "cash",
      source_type: "portal",
      status: "unallocated",
      is_verified: false,
      memo: TAG,
    })
    .select("id")
    .single()

  record(
    "portal-pledge-payment-simulation",
    !paymentError && !!payment?.id,
    paymentError?.message || payment?.id
  )

  await applyDonorAffiliationMirrorForOrg(orgId, contactId)
  const roleAfterPayment = await hasDonorRole(orgId, contactId)
  record(
    "pledge-payment-donor-role",
    roleAfterPayment.ok && roleAfterPayment.hasRole,
    roleAfterPayment.error || (roleAfterPayment.hasRole ? "donor role present" : "missing")
  )

  await sb.from("payments").delete().eq("id", payment?.id).eq("memo", TAG)
  await sb.from("pledges").delete().eq("id", pledge.id)
}

await sb.from("contact_roles").delete().eq("contact_id", contactId)
await sb.from("donors").delete().eq("id", donor.id)
await sb.from("contacts").delete().eq("id", contactId)

const failed = checks.filter((check) => !check.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length > 0) {
  process.exit(1)
}
