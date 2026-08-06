/**
 * Find duplicate Vendor Hub contacts (role=vendor) by normalized phone / email.
 * Dry-run by default. Optionally merge pairs with --execute (keeps richer target).
 *
 *   node scripts/find-merge-vendor-duplicates.mjs
 *   node scripts/find-merge-vendor-duplicates.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const execute = process.argv.includes("--execute")

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

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return null
  // US: drop leading 1 if 11 digits
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  if (digits.length >= 10) return digits.slice(-10)
  return digits.length >= 7 ? digits : null
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase()
  return email.includes("@") ? email : null
}

function normalizeBusiness(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function scoreContact(contact) {
  let score = 0
  if (contact.email) score += 2
  if (contact.phone) score += 2
  if (contact.business_name) score += 3
  if (contact.last_activity_at) score += 2
  if (contact.full_name && contact.full_name.split(/\s+/).length > 1) score += 1
  score += Math.min(5, contact.payment_count || 0)
  score += Math.min(3, contact.application_count || 0)
  return score
}

async function loadVendors(sb, orgId) {
  const { data: roleRows, error: roleError } = await sb
    .from("contact_roles")
    .select("contact_id")
    .eq("organization_id", orgId)
    .eq("role", "vendor")

  if (roleError) throw new Error(roleError.message)

  const contactIds = [...new Set((roleRows || []).map((r) => r.contact_id).filter(Boolean))]
  const contacts = []
  const chunkSize = 200

  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, status, last_activity_at, created_at")
      .eq("organization_id", orgId)
      .in("id", chunk)
    if (error) throw new Error(error.message)
    contacts.push(...(data || []))
  }

  const businessByContact = new Map()
  const appCountByContact = new Map()
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const { data: apps } = await sb
      .from("applications")
      .select("contact_id, form_data")
      .eq("organization_id", orgId)
      .eq("application_type", "vendor")
      .in("contact_id", chunk)

    for (const app of apps || []) {
      appCountByContact.set(
        app.contact_id,
        (appCountByContact.get(app.contact_id) || 0) + 1
      )
      if (businessByContact.has(app.contact_id)) continue
      const form =
        app.form_data && typeof app.form_data === "object" ? app.form_data : {}
      const business =
        typeof form.business_name === "string" ? form.business_name.trim() : ""
      if (business) businessByContact.set(app.contact_id, business)
    }
  }

  const paymentCountByContact = new Map()
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const { data: payments } = await sb
      .from("vendor_hub_payments")
      .select("contact_id")
      .in("contact_id", chunk)
    for (const payment of payments || []) {
      if (!payment.contact_id) continue
      paymentCountByContact.set(
        payment.contact_id,
        (paymentCountByContact.get(payment.contact_id) || 0) + 1
      )
    }
  }

  return contacts.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    status: c.status,
    last_activity_at: c.last_activity_at,
    created_at: c.created_at,
    business_name: businessByContact.get(c.id) || null,
    application_count: appCountByContact.get(c.id) || 0,
    payment_count: paymentCountByContact.get(c.id) || 0,
    phone_key: normalizePhone(c.phone),
    email_key: normalizeEmail(c.email),
    business_key: normalizeBusiness(businessByContact.get(c.id) || ""),
  }))
}

function buildDuplicateGroups(vendors) {
  /** @type {Map<string, object[]>} */
  const byPhone = new Map()
  /** @type {Map<string, object[]>} */
  const byEmail = new Map()

  for (const vendor of vendors) {
    if (vendor.phone_key) {
      const list = byPhone.get(vendor.phone_key) || []
      list.push(vendor)
      byPhone.set(vendor.phone_key, list)
    }
    if (vendor.email_key) {
      const list = byEmail.get(vendor.email_key) || []
      list.push(vendor)
      byEmail.set(vendor.email_key, list)
    }
  }

  const groups = []
  const seen = new Set()

  for (const [phone, list] of byPhone) {
    if (list.length < 2) continue
    const ids = list.map((v) => v.id).sort().join("|")
    if (seen.has(ids)) continue
    seen.add(ids)
    groups.push({
      reason: "phone",
      key: phone,
      members: list.sort((a, b) => scoreContact(b) - scoreContact(a)),
    })
  }

  for (const [email, list] of byEmail) {
    if (list.length < 2) continue
    const ids = list.map((v) => v.id).sort().join("|")
    if (seen.has(`email:${ids}`) || seen.has(ids)) continue
    // skip if already covered by a phone group containing same ids
    const already = groups.some(
      (g) => g.members.map((m) => m.id).sort().join("|") === ids
    )
    if (already) continue
    seen.add(`email:${ids}`)
    groups.push({
      reason: "email",
      key: email,
      members: list.sort((a, b) => scoreContact(b) - scoreContact(a)),
    })
  }

  return groups
}

async function mergePair(sb, orgId, target, source) {
  // Prefer importing merge logic via dynamic subprocess of merge-donor-contacts
  // Use RPC-free approach: call the same script as a child for reliability.
  const { spawnSync } = await import("node:child_process")
  const script = resolve(root, "scripts/merge-donor-contacts.mjs")
  const args = [
    script,
    "--org",
    orgId,
    "--target-id",
    target.id,
    "--source-id",
    source.id,
  ]
  if (execute) args.push("--execute")

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  })

  return {
    targetId: target.id,
    sourceId: source.id,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing Supabase env")
    process.exit(1)
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const orgId = DEFAULT_ORG_ID
  const vendors = await loadVendors(sb, orgId)
  const groups = buildDuplicateGroups(vendors)

  const plannedMerges = []
  for (const group of groups) {
    const [target, ...sources] = group.members
    for (const source of sources) {
      plannedMerges.push({
        reason: group.reason,
        key: group.key,
        target: {
          id: target.id,
          full_name: target.full_name,
          email: target.email,
          phone: target.phone,
          business_name: target.business_name,
          score: scoreContact(target),
        },
        source: {
          id: source.id,
          full_name: source.full_name,
          email: source.email,
          phone: source.phone,
          business_name: source.business_name,
          score: scoreContact(source),
        },
      })
    }
  }

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const summary = {
    mode: execute ? "execute" : "dry-run",
    orgId,
    vendorCount: vendors.length,
    duplicateGroups: groups.length,
    plannedMerges: plannedMerges.length,
    merges: plannedMerges,
  }

  if (!execute) {
    const out = resolve(reportDir, "vendor-duplicates-dry-run.json")
    writeFileSync(out, JSON.stringify(summary, null, 2))
    console.log(JSON.stringify(summary, null, 2))
    console.log(`\nDry-run report: ${out}`)
    console.log("Re-run with --execute to merge (keeps higher-score contact as target).")
    return
  }

  const results = []
  for (const merge of plannedMerges) {
    console.log(
      `Merging ${merge.source.full_name} (${merge.source.id}) → ${merge.target.full_name} (${merge.target.id}) [${merge.reason}=${merge.key}]`
    )
    const result = await mergePair(sb, orgId, merge.target, merge.source)
    results.push({
      ...merge,
      mergeStatus: result.status,
      stderr: result.stderr?.slice(0, 500) || null,
    })
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout)
    }
  }

  const out = resolve(reportDir, "vendor-duplicates-execute.json")
  writeFileSync(
    out,
    JSON.stringify({ ...summary, results }, null, 2)
  )
  console.log(JSON.stringify({ ...summary, resultCount: results.length }, null, 2))
  console.log(`\nExecute report: ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
