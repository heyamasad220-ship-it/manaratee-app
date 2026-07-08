/**
 * Merge duplicate CRM contacts (and their donor extensions) into one canonical record.
 *
 * Typical use: two organization names for the same donor (e.g. "MSAADA" →
 * "MSAADA Educational Foundation"). Keeps the target contact, moves pledges/payments,
 * donor rows, notes, roles, and other contact_id links, then deletes the source.
 *
 * Usage:
 *   node scripts/merge-donor-contacts.mjs --search "MSAADA"
 *   node scripts/merge-donor-contacts.mjs --target "MSAADA Educational Foundation" --source "MSAADA"
 *   node scripts/merge-donor-contacts.mjs --target-id <uuid> --source-id <uuid>
 *   node scripts/merge-donor-contacts.mjs --target-id <uuid> --source-id <uuid> --execute
 *   node scripts/merge-donor-contacts.mjs --target-id <uuid> --source-id <uuid1> --source-id <uuid2> --execute
 *   node scripts/merge-donor-contacts.mjs --target-id <uuid> --source-id <uuid> --rename "Marvels" --execute
 *
 * Options:
 *   --org <uuid>     Organization (default: MAS Dallas)
 *   --search <text>  List matching contacts (no merge)
 *   --rename <text>  Set target full_name after merge (e.g. shorten group name)
 *   --execute        Apply changes (default: preview only)
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const STAMP = new Date().toISOString().slice(0, 10)

function parseArgs(argv) {
  const args = {
    orgId: DEFAULT_ORG_ID,
    targetId: null,
    targetName: null,
    sourceIds: [],
    sourceNames: [],
    search: null,
    rename: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === "--org") args.orgId = argv[++index]
    else if (token === "--target-id") args.targetId = argv[++index]
    else if (token === "--source-id") args.sourceIds.push(argv[++index])
    else if (token === "--target") args.targetName = argv[++index]
    else if (token === "--source") args.sourceNames.push(argv[++index])
    else if (token === "--search") args.search = argv[++index]
    else if (token === "--rename") args.rename = argv[++index]
  }

  return args
}

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

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, build) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + 999)
    q = build(q)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function countRows(table, orgId, column, value) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq(column, value)

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return 0
    console.error(`countRows failed for ${table}.${column}:`, error.message)
    return 0
  }
  return count ?? 0
}

function formatError(error) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    return JSON.stringify(error)
  }
  return String(error)
}

async function resolveContact(orgId, { id, name }) {
  if (id) {
    const { data, error } = await sb
      .from("contacts")
      .select(
        "id, organization_id, full_name, email, phone, contact_type, primary_contact_name, status, notes"
      )
      .eq("organization_id", orgId)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!data) return { error: `Contact not found: ${id}` }
    return { contact: data }
  }

  if (!name) return { error: "Missing contact id or name" }

  const { data, error } = await sb
    .from("contacts")
    .select(
      "id, organization_id, full_name, email, phone, contact_type, primary_contact_name, status, notes"
    )
    .eq("organization_id", orgId)
    .ilike("full_name", name)

  if (error) throw error
  if (!data?.length) return { error: `No contact named "${name}"` }
  if (data.length > 1) {
    return {
      error: `Multiple contacts match "${name}" — use --target-id / --source-id`,
      matches: data,
    }
  }
  return { contact: data[0] }
}

async function findDonorForContact(orgId, contactId) {
  const { data, error } = await sb
    .from("donors")
    .select("id, full_name, email, phone, donor_type, contact_id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (error && error.code !== "42P01") throw error
  return data ?? null
}

async function inventoryContact(orgId, contactId) {
  const tables = [
    ["payments", "contact_id"],
    ["pledges", "contact_id"],
    ["recurring_donation_plans", "contact_id"],
    ["donation_checkout_sessions", "contact_id"],
    ["donation_receipts", "contact_id"],
    ["pledge_reminders", "contact_id"],
    ["contact_notes", "contact_id"],
    ["contact_roles", "contact_id"],
    ["volunteers", "contact_id"],
    ["staff", "contact_id"],
    ["applications", "contact_id"],
    ["ticket_orders", "contact_id"],
    ["memberships", "contact_id"],
    ["program_enrollments", "participant_contact_id"],
    ["program_enrollments", "registrant_contact_id"],
    ["program_enrollments", "payer_contact_id"],
  ]

  const counts = {}
  for (const [table, column] of tables) {
    counts[`${table}.${column}`] = await countRows(table, orgId, column, contactId)
  }
  return counts
}

async function inventoryDonor(orgId, donorId) {
  const tables = [
    ["payments", "donor_id"],
    ["pledges", "donor_id"],
    ["recurring_donation_plans", "donor_id"],
    ["donation_checkout_sessions", "donor_id"],
    ["donation_receipts", "donor_id"],
    ["pledge_reminders", "donor_id"],
  ]

  const counts = {}
  for (const [table, column] of tables) {
    counts[`${table}.${column}`] = await countRows(table, orgId, column, donorId)
  }
  return counts
}

function pickContactPatch(target, source) {
  const patch = {}
  if (!target.email && source.email) patch.email = source.email
  if (!target.phone && source.phone) patch.phone = source.phone
  if (!target.primary_contact_name && source.primary_contact_name) {
    patch.primary_contact_name = source.primary_contact_name
  }
  if (!target.notes && source.notes) patch.notes = source.notes
  return patch
}

async function reassignContactColumn(orgId, table, column, sourceContactId, targetContactId) {
  const { count } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq(column, sourceContactId)

  const rowCount = count ?? 0
  if (rowCount === 0) return 0
  if (!execute) return rowCount

  const { error } = await sb
    .from(table)
    .update({ [column]: targetContactId })
    .eq("organization_id", orgId)
    .eq(column, sourceContactId)

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return 0
    throw new Error(`${table}.${column}: ${error.message}`)
  }
  return rowCount
}

async function reassignGroupMembers(orgId, sourceGroupId, targetGroupId) {
  const sourceRows = await fetchAll("contact_group_members", (query) =>
    query.eq("organization_id", orgId).eq("group_contact_id", sourceGroupId)
  )
  if (!sourceRows.length) return 0

  const targetRows = await fetchAll("contact_group_members", (query) =>
    query.eq("organization_id", orgId).eq("group_contact_id", targetGroupId)
  )
  const targetMemberIds = new Set(targetRows.map((row) => row.member_contact_id))

  let moved = 0
  let deduped = 0

  for (const row of sourceRows) {
    if (targetMemberIds.has(row.member_contact_id)) {
      deduped += 1
      if (execute) {
        const { error } = await sb.from("contact_group_members").delete().eq("id", row.id)
        if (error && error.code !== "42P01") {
          throw new Error(`contact_group_members dedupe: ${error.message}`)
        }
      }
      continue
    }

    moved += 1
    if (execute) {
      const { error } = await sb
        .from("contact_group_members")
        .update({ group_contact_id: targetGroupId })
        .eq("id", row.id)
      if (error && error.code !== "42P01") {
        throw new Error(`contact_group_members reassign: ${error.message}`)
      }
    }
    targetMemberIds.add(row.member_contact_id)
  }

  return moved + deduped
}

async function mergeDonorIntoTarget(orgId, sourceDonorId, targetDonorId, targetContactId) {
  const paymentPatch = { donor_id: targetDonorId, contact_id: targetContactId }
  const donorPatch = { donor_id: targetDonorId, contact_id: targetContactId }
  const pledgePatch = { donor_id: targetDonorId }

  const tables = [
    { table: "payments", patch: paymentPatch },
    { table: "pledges", patch: pledgePatch },
    { table: "recurring_donation_plans", patch: donorPatch },
    { table: "donation_checkout_sessions", patch: donorPatch },
    { table: "donation_receipts", patch: donorPatch },
    { table: "pledge_reminders", patch: donorPatch },
  ]

  const steps = []
  for (const { table, patch } of tables) {
    const { count } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("donor_id", sourceDonorId)

    const rowCount = count ?? 0
    if (rowCount === 0) continue

    if (execute) {
      const { error } = await sb
        .from(table)
        .update(patch)
        .eq("organization_id", orgId)
        .eq("donor_id", sourceDonorId)
      if (error && error.code !== "42P01") {
        throw new Error(`${table} donor merge: ${error.message}`)
      }
    }
    steps.push({ table, rows: rowCount })
  }

  if (execute) {
    const { error } = await sb.from("donors").delete().eq("id", sourceDonorId)
    if (error) throw new Error(`donor delete (${sourceDonorId}): ${error.message}`)
  }

  steps.push({ table: "donors", deleted: 1 })
  return steps
}

async function relinkDonorToTarget(orgId, donorId, targetContactId) {
  if (!execute) return { table: "donors", relinked: 1 }

  const { error: donorError } = await sb
    .from("donors")
    .update({ contact_id: targetContactId })
    .eq("organization_id", orgId)
    .eq("id", donorId)

  if (donorError) throw new Error(`donor relink: ${donorError.message}`)

  const { error: paymentError } = await sb
    .from("payments")
    .update({ contact_id: targetContactId })
    .eq("organization_id", orgId)
    .eq("donor_id", donorId)

  if (paymentError && paymentError.code !== "42P01") {
    throw new Error(`payments contact relink: ${paymentError.message}`)
  }

  return { table: "donors", relinked: 1 }
}

async function syncAffiliation(orgId, contactId) {
  if (!execute) return
  const { error } = await sb.rpc("sync_contact_affiliations", {
    p_organization_id: orgId,
    p_contact_id: contactId,
  })
  if (error) throw new Error(`sync_contact_affiliations: ${error.message}`)
}

async function mergeSourceIntoTarget(orgId, target, source, renameTarget = null) {
  if (target.id === source.id) {
    return { error: "Target and source contact are the same record." }
  }

  const targetDonor = await findDonorForContact(orgId, target.id)
  const sourceDonor = await findDonorForContact(orgId, source.id)

  const report = {
    target: {
      id: target.id,
      full_name: target.full_name,
      email: target.email,
      phone: target.phone,
      donor_id: targetDonor?.id ?? null,
    },
    source: {
      id: source.id,
      full_name: source.full_name,
      email: source.email,
      phone: source.phone,
      donor_id: sourceDonor?.id ?? null,
    },
    contactInventory: await inventoryContact(orgId, source.id),
    donorInventory: sourceDonor ? await inventoryDonor(orgId, sourceDonor.id) : {},
    contactPatch: pickContactPatch(target, source),
    steps: [],
  }

  if (targetDonor && sourceDonor) {
    if (targetDonor.id === sourceDonor.id) {
      report.steps.push({ table: "donors", note: "same donor row already linked" })
    } else {
      report.steps.push(
        ...(await mergeDonorIntoTarget(orgId, sourceDonor.id, targetDonor.id, target.id))
      )
    }
  } else if (sourceDonor) {
    report.steps.push(await relinkDonorToTarget(orgId, sourceDonor.id, target.id))
  }

  const contactColumns = [
    ["payments", "contact_id"],
    ["pledges", "contact_id"],
    ["recurring_donation_plans", "contact_id"],
    ["donation_checkout_sessions", "contact_id"],
    ["donation_receipts", "contact_id"],
    ["pledge_reminders", "contact_id"],
    ["contact_notes", "contact_id"],
    ["contact_roles", "contact_id"],
    ["volunteers", "contact_id"],
    ["staff", "contact_id"],
    ["applications", "contact_id"],
    ["ticket_orders", "contact_id"],
    ["memberships", "contact_id"],
    ["program_enrollments", "participant_contact_id"],
    ["program_enrollments", "registrant_contact_id"],
    ["program_enrollments", "payer_contact_id"],
  ]

  for (const [table, column] of contactColumns) {
    const rows = await reassignContactColumn(orgId, table, column, source.id, target.id)
    if (rows > 0) report.steps.push({ table, column, rows })
  }

  const groupMemberRows = await reassignGroupMembers(orgId, source.id, target.id)
  if (groupMemberRows > 0) {
    report.steps.push({ table: "contact_group_members", group_contact_id: groupMemberRows })
  }

  if (renameTarget && renameTarget !== target.full_name) {
    report.contactPatch.full_name = renameTarget
  }

  if (Object.keys(report.contactPatch).length > 0) {
    if (execute) {
      const { error } = await sb
        .from("contacts")
        .update(report.contactPatch)
        .eq("organization_id", orgId)
        .eq("id", target.id)
      if (error) throw new Error(`target contact patch: ${error.message}`)
    }
    report.steps.push({ table: "contacts", patched: report.contactPatch })
  }

  if (execute) {
    const { error: deleteError } = await sb
      .from("contacts")
      .delete()
      .eq("organization_id", orgId)
      .eq("id", source.id)
    if (deleteError) throw new Error(`source contact delete: ${deleteError.message}`)
    await syncAffiliation(orgId, target.id)
  }

  report.steps.push({ table: "contacts", deletedSource: source.id })
  report.steps.push({ table: "sync_contact_affiliations", contactId: target.id })

  return report
}

async function searchContacts(orgId, query) {
  const { data, error } = await sb
    .from("contacts")
    .select("id, full_name, email, phone, contact_type, primary_contact_name, created_at")
    .eq("organization_id", orgId)
    .ilike("full_name", `%${query}%`)
    .order("full_name")

  if (error) throw error

  const results = []
  for (const contact of data || []) {
    const donor = await findDonorForContact(orgId, contact.id)
    const paymentCount = await countRows("payments", orgId, "contact_id", contact.id)
    const pledgeCount = await countRows("pledges", orgId, "contact_id", contact.id)
    results.push({
      ...contact,
      donor_id: donor?.id ?? null,
      payments: paymentCount,
      pledges: pledgeCount,
    })
  }
  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.search) {
    const matches = await searchContacts(args.orgId, args.search)
    console.log(
      JSON.stringify(
        {
          mode: "search",
          organizationId: args.orgId,
          query: args.search,
          matches,
        },
        null,
        2
      )
    )
    return
  }

  const targetResolved = await resolveContact(args.orgId, {
    id: args.targetId,
    name: args.targetName,
  })
  if (targetResolved.error) {
    console.log(JSON.stringify({ mode: execute ? "execute" : "preview", error: targetResolved.error, matches: targetResolved.matches }, null, 2))
    process.exit(1)
  }

  const sourceSpecs = []
  if (args.sourceIds.length) {
    for (const id of args.sourceIds) sourceSpecs.push({ id })
  } else if (args.sourceNames.length) {
    for (const name of args.sourceNames) sourceSpecs.push({ name })
  } else {
    console.error("Provide --source or --source-id (or --search to find contacts).")
    process.exit(1)
  }

  const report = {
    mode: execute ? "execute" : "preview",
    organizationId: args.orgId,
    target: targetResolved.contact,
    merges: [],
    errors: [],
  }

  for (const spec of sourceSpecs) {
    const sourceResolved = await resolveContact(args.orgId, spec)
    if (sourceResolved.error) {
      report.errors.push({ spec, error: sourceResolved.error, matches: sourceResolved.matches })
      continue
    }

    try {
      const mergeReport = await mergeSourceIntoTarget(
        args.orgId,
        targetResolved.contact,
        sourceResolved.contact,
        args.rename
      )
      if (mergeReport.error) {
        report.errors.push({ source: sourceResolved.contact.full_name, error: mergeReport.error })
      } else {
        report.merges.push(mergeReport)
      }
    } catch (error) {
      report.errors.push({
        source: sourceResolved.contact.full_name,
        message: formatError(error),
      })
    }
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `merge-donor-contacts-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  if (!execute) {
    console.error("\nDry run only. Re-run with --execute to merge.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
