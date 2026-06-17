/**
 * Clean MAS Dallas seed donor contacts and fix Heyam Asad affiliations.
 * Usage: node scripts/clean-mas-contacts-pilot.mjs [--dry-run]
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const dryRun = process.argv.includes("--dry-run")

const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const HEYAM_EMAIL = "heyamasad220@gmail.com"
const SEED_EMAILS = ["donations-seed-individual@dev.test", "donations-seed-org@dev.test"]
const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"

function loadEnvLocal() {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function count(table, filters = []) {
  let q = sb.from(table).select("*", { count: "exact", head: true })
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "in") q = q.in(f.col, f.val)
  }
  const { count: n, error } = await q
  return { count: n ?? 0, error: error?.message ?? null }
}

async function fetchRows(table, select, filters = []) {
  let q = sb.from(table).select(select)
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "in") q = q.in(f.col, f.val)
  }
  const { data, error } = await q
  return { rows: data ?? [], error: error?.message ?? null }
}

async function del(table, filters) {
  if (dryRun) return { ok: true, dryRun: true, table, filters }
  let q = sb.from(table).delete()
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "in") q = q.in(f.col, f.val)
    if (f.op === "like") q = q.like(f.col, f.val)
  }
  const { error } = await q
  return { ok: !error, error: error?.message ?? null, table }
}

async function main() {
  const report = { dryRun, steps: [], before: {}, after: {} }

  const { rows: masContacts } = await fetchRows("contacts", "id, email, full_name, person_id, notes", [
    { op: "eq", col: "organization_id", val: MAS },
  ])
  report.before.contacts = masContacts

  const heyam = masContacts.find((c) => c.email === HEYAM_EMAIL)
  const seedContacts = masContacts.filter((c) => SEED_EMAILS.includes(c.email))
  if (!heyam) throw new Error("Heyam Asad contact not found on MAS Dallas")
  if (seedContacts.length === 0) report.steps.push({ note: "No seed contacts found — may already be cleaned" })

  const heyamContactId = heyam.id
  const { rows: heyamRoles } = await fetchRows("contact_roles", "id, role", [
    { op: "eq", col: "contact_id", val: heyamContactId },
    { op: "eq", col: "organization_id", val: MAS },
  ])
  const { rows: heyamMemberships } = await fetchRows("memberships", "id, status, membership_type_id", [
    { op: "eq", col: "contact_id", val: heyamContactId },
    { op: "eq", col: "organization_id", val: MAS },
  ])
  const { rows: heyamStaff } = await fetchRows("staff", "id, status", [
    { op: "eq", col: "contact_id", val: heyamContactId },
    { op: "eq", col: "organization_id", val: MAS },
  ])

  report.before.heyam = { contact: heyam, roles: heyamRoles, memberships: heyamMemberships, staff: heyamStaff }

  // --- Clean seed contacts (donation ledger + contacts) ---
  const seedContactIds = seedContacts.map((c) => c.id)
  const seedPersonIds = seedContacts.map((c) => c.person_id).filter(Boolean)

  if (seedContactIds.length) {
    const { rows: seedDonors } = await fetchRows("donors", "id", [
      { op: "eq", col: "organization_id", val: MAS },
      { op: "in", col: "contact_id", val: seedContactIds },
    ])
    const donorIds = seedDonors.map((d) => d.id)

    if (donorIds.length) {
      const { rows: seedPledges } = await fetchRows("pledges", "id", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: donorIds },
      ])
      const pledgeIds = seedPledges.map((p) => p.id)
      if (pledgeIds.length) {
        report.steps.push(await del("payments", [
          { op: "eq", col: "organization_id", val: MAS },
          { op: "in", col: "pledge_id", val: pledgeIds },
        ]))
      }
    }

    report.steps.push(await del("payments", [{ op: "eq", col: "organization_id", val: MAS }, { op: "eq", col: "memo", val: SEED_TAG }]))
    report.steps.push(await del("payments", [{ op: "eq", col: "organization_id", val: MAS }, { op: "like", col: "sender_name", val: "Seed Import%" }]))

    if (donorIds.length) {
      const { rows: pledges } = await fetchRows("pledges", "id", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: donorIds },
      ])
      if (pledges.length) {
        report.steps.push(await del("pledges", [{ op: "in", col: "id", val: pledges.map((p) => p.id) }]))
      }
      report.steps.push(await del("donors", [{ op: "in", col: "id", val: donorIds }]))
    }

    for (const cid of seedContactIds) {
      report.steps.push(await del("payments", [{ op: "eq", col: "organization_id", val: MAS }, { op: "eq", col: "contact_id", val: cid }]))
      report.steps.push(await del("donation_receipts", [{ op: "eq", col: "organization_id", val: MAS }, { op: "eq", col: "contact_id", val: cid }]))
    }

    for (const cid of seedContactIds) {
      report.steps.push(await del("contact_roles", [{ op: "eq", col: "contact_id", val: cid }]))
      report.steps.push(await del("contact_notes", [{ op: "eq", col: "contact_id", val: cid }]))
      report.steps.push(await del("contact_activities", [{ op: "eq", col: "contact_id", val: cid }]))
      report.steps.push(await del("contacts", [{ op: "eq", col: "id", val: cid }]))
    }

    if (seedPersonIds.length) {
      report.steps.push(await del("people", [{ op: "in", col: "id", val: seedPersonIds }]))
    }
  }

  report.steps.push(await del("campaigns", [{ op: "eq", col: "organization_id", val: MAS }, { op: "eq", col: "code", val: SEED_CAMPAIGN_CODE }]))

  // --- Fix Heyam: remove member affiliation, keep employee if staff ---
  for (const m of heyamMemberships) {
    report.steps.push(await del("memberships", [{ op: "eq", col: "id", val: m.id }]))
  }

  const memberRoles = heyamRoles.filter((r) => r.role === "member")
  for (const r of memberRoles) {
    report.steps.push(await del("contact_roles", [{ op: "eq", col: "id", val: r.id }]))
  }

  // Re-sync affiliations for Heyam via RPC if not dry run
  if (!dryRun) {
    const { error: syncError } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: MAS,
      p_contact_id: heyamContactId,
    })
    report.steps.push({ sync_contact_affiliations: syncError?.message ?? "ok" })
  }

  const { rows: afterContacts } = await fetchRows("contacts", "id, email, full_name", [
    { op: "eq", col: "organization_id", val: MAS },
  ])
  const { rows: afterHeyamRoles } = await fetchRows("contact_roles", "id, role", [
    { op: "eq", col: "contact_id", val: heyamContactId },
    { op: "eq", col: "organization_id", val: MAS },
  ])
  const { rows: afterMemberships } = await fetchRows("memberships", "id, status", [
    { op: "eq", col: "contact_id", val: heyamContactId },
    { op: "eq", col: "organization_id", val: MAS },
  ])

  report.after = {
    contacts: afterContacts,
    heyamRoles: afterHeyamRoles,
    heyamMemberships: afterMemberships,
    contactsCount: afterContacts.length,
  }

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "mas-contacts-pilot-cleanup.json")
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport: ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
