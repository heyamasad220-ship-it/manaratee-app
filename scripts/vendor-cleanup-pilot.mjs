/**
 * Vendor pilot cleanup — export, inventory, FK-safe deletion, post-report.
 *
 * Usage:
 *   node scripts/vendor-cleanup-pilot.mjs                 # inventory + export + safety check
 *   node scripts/vendor-cleanup-pilot.mjs --execute       # run cleanup after review
 *   node scripts/vendor-cleanup-pilot.mjs --execute --report-only
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const STAMP = "2026-06-16"
const execute = process.argv.includes("--execute")
const reportOnly = process.argv.includes("--report-only")

const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const ASAD = "95c4eb7d-b151-4aa1-a489-a3c1e1289c7e"

/** Operational — exported then deleted on --execute */
const OPERATIONAL_TABLES = [
  "vendor_hub_participation_evaluations",
  "vendor_hub_payments",
  "vendor_hub_announcement_recipients",
  "vendor_hub_booth_assignments",
  "vendor_hub_participant_status",
  "vendor_hub_announcements",
  "vendor_hub_event_reminder_log",
  "vendor_hub_vendors",
  "vendors",
]

/** Catalog / config — never deleted */
const PRESERVE_TABLES = [
  "vendor_categories",
  "vendor_hub_vendor_types",
  "vendor_hub_booth_attributes",
  "vendor_hub_booth_types",
  "vendor_hub_booths",
  "vendor_hub_events",
  "vendor_hub_booth_setup_templates",
  "vendor_hub_booth_setup_template_lines",
  "vendor_hub_booth_type_attributes",
  "vendor_hub_booth_attribute_links",
  "modules",
  "organization_modules",
  "organization_roles",
  "role_permissions",
  "organizations",
  "profiles",
  "organization_members",
  "organization_users",
  "platform_admins",
  "platform_settings",
  "application_type_definitions",
]

/** Protected identity tables — row counts must not decrease */
const PROTECTED_TABLES = [
  "auth.users",
  "profiles",
  "contacts",
  "organization_members",
  "organization_users",
  "organizations",
  "organization_roles",
  "role_permissions",
  "platform_admins",
  "platform_settings",
  "modules",
  "organization_modules",
  "organization_sidebar_modules",
  "plans",
  "plan_modules",
  "plan_limits",
]

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) throw new Error(".env.local not found")
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

async function countTable(table, filters = []) {
  let q = sb.from(table).select("*", { count: "exact", head: true })
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "in") q = q.in(f.col, f.val)
  }
  const { count, error } = await q
  return { count: count ?? 0, error: error?.message ?? null }
}

async function fetchAll(table, select = "*", filters = [], pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select(select).range(from, from + pageSize - 1)
    for (const f of filters) {
      if (f.op === "eq") q = q.eq(f.col, f.val)
      if (f.op === "in") q = q.in(f.col, f.val)
    }
    const { data, error } = await q
    if (error) return { rows, error: error.message }
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { rows, error: null }
}

async function exportTable(table, outDir, filters = []) {
  const { rows, error } = await fetchAll(table, "*", filters)
  if (error) return { table, error, rowCount: 0, file: null }
  const file = resolve(outDir, `${table}-${STAMP}.json`)
  writeFileSync(file, JSON.stringify(rows, null, 2))
  return { table, rowCount: rows.length, file, error: null }
}

async function countAuthUsers() {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return { count: data?.users?.length ?? null, error: error?.message ?? null }
}

async function inventoryCounts() {
  const allTables = [...OPERATIONAL_TABLES, ...PRESERVE_TABLES]
  const counts = {}
  for (const table of allTables) {
    counts[table] = await countTable(table)
  }
  counts.vendor_applications = await countTable("applications", [
    { op: "eq", col: "application_type", val: "vendor" },
  ])
  counts.contact_roles_vendor = await countTable("contact_roles", [
    { op: "eq", col: "role", val: "vendor" },
  ])
  counts.byOrg = {}
  for (const [label, orgId] of [
    ["MAS_DALLAS", MAS],
    ["ASAD_REALTY", ASAD],
  ]) {
    counts.byOrg[label] = {
      vendors: await countTable("vendors", [{ op: "eq", col: "organization_id", val: orgId }]),
      vendor_hub_vendors: await countTable("vendor_hub_vendors", [
        { op: "eq", col: "organization_id", val: orgId },
      ]),
      vendor_applications: await countTable("applications", [
        { op: "eq", col: "organization_id", val: orgId },
        { op: "eq", col: "application_type", val: "vendor" },
      ]),
    }
  }
  return counts
}

async function analyzeVendorContactOverlap() {
  const { rows: vendorRows } = await fetchAll(
    "vendors",
    "id, organization_id, contact_id, email, business_name, company_name, full_name, created_at"
  )
  const contactIds = [...new Set(vendorRows.map((r) => r.contact_id).filter(Boolean))]
  let linkedContacts = []
  if (contactIds.length) {
    const { rows } = await fetchAll("contacts", "id, email, full_name, organization_id", [
      { op: "in", col: "id", val: contactIds },
    ])
    linkedContacts = rows
  }

  const profileEmails = new Set()
  const { rows: profiles } = await fetchAll("profiles", "id, email")
  for (const p of profiles) {
    if (p.email) profileEmails.add(String(p.email).toLowerCase())
  }

  const protectedContactIds = new Set()
  for (const c of linkedContacts) {
    const email = (c.email || "").toLowerCase()
    if (email && profileEmails.has(email)) protectedContactIds.add(c.id)
  }

  return {
    vendorRows: vendorRows.length,
    vendorsWithContactId: vendorRows.filter((r) => r.contact_id).length,
    uniqueLinkedContacts: contactIds.length,
    linkedContactsSample: linkedContacts.slice(0, 5),
    contactsLinkedToProfiles: protectedContactIds.size,
    vendorsLinkedToProfileContacts: vendorRows.filter((r) =>
      protectedContactIds.has(r.contact_id)
    ).length,
  }
}

async function findOrphansAfter(countsAfter) {
  const orphans = []

  if (countsAfter.vendor_hub_booth_assignments?.count > 0) {
    orphans.push({ table: "vendor_hub_booth_assignments", count: countsAfter.vendor_hub_booth_assignments.count })
  }

  const vendorRoles = await countTable("contact_roles", [{ op: "eq", col: "role", val: "vendor" }])
  if (vendorRoles.count > 0) {
    orphans.push({
      table: "contact_roles (role=vendor)",
      count: vendorRoles.count,
      note: "Contact records preserved; vendor role rows may remain until affiliation sync",
    })
  }

  const vendorApps = await countTable("applications", [{ op: "eq", col: "application_type", val: "vendor" }])
  if (vendorApps.count > 0) {
    orphans.push({ table: "applications (type=vendor)", count: vendorApps.count })
  }

  return orphans
}

async function deleteAllRows(table, filters = []) {
  const { rows, error: fetchError } = await fetchAll(table, "id", filters)
  if (fetchError) return { table, deleted: 0, error: fetchError }

  let deleted = 0
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => r.id)
    const { error } = await sb.from(table).delete().in("id", batch)
    if (error) return { table, deleted, error: error.message }
    deleted += batch.length
  }
  return { table, deleted, error: null }
}

async function runCleanup() {
  const steps = []
  for (const table of OPERATIONAL_TABLES) {
    const result = await deleteAllRows(table)
    steps.push(result)
    if (result.error) break
  }
  return steps
}

async function validateVendorHubOperational() {
  const checks = []

  const preserveOk = []
  for (const table of PRESERVE_TABLES) {
    const c = await countTable(table)
    preserveOk.push({ table, count: c.count, error: c.error })
  }
  checks.push({ id: "preserve_catalog_tables_readable", pass: preserveOk.every((t) => !t.error), tables: preserveOk })

  const appTypes = await countTable("application_type_definitions")
  const vendorType = await sb
    .from("application_type_definitions")
    .select("id, label, module_owner")
    .eq("id", "vendor")
    .maybeSingle()
  checks.push({
    id: "vendor_application_type_exists",
    pass: !vendorType.error && Boolean(vendorType.data),
    detail: vendorType.data?.id ?? vendorType.error?.message,
  })

  const events = await countTable("vendor_hub_events")
  checks.push({ id: "vendor_hub_events_accessible", pass: !events.error, count: events.count })

  const boothTypes = await countTable("vendor_hub_booth_types")
  checks.push({ id: "vendor_hub_booth_types_accessible", pass: !boothTypes.error, count: boothTypes.count })

  const vendorsRemaining = await countTable("vendors")
  checks.push({ id: "vendors_operational_cleared", pass: vendorsRemaining.count === 0, count: vendorsRemaining.count })

  return checks
}

async function main() {
  const outDir = resolve(root, "scripts/backups/vendor-cleanup")
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  mkdirSync(reportDir, { recursive: true })

  console.log("=== Vendor Pilot Cleanup ===\n")
  console.log(`Mode: ${execute ? "EXECUTE" : "INVENTORY + EXPORT ONLY"}\n`)

  const before = await inventoryCounts()
  const beforeAuth = await countAuthUsers()
  const beforeProtected = {}
  for (const table of PROTECTED_TABLES.filter((t) => t !== "auth.users")) {
    beforeProtected[table] = await countTable(table)
  }

  const contactOverlap = await analyzeVendorContactOverlap()

  console.log("--- Inventory (before) ---")
  for (const table of OPERATIONAL_TABLES) {
    const c = before[table]
    console.log(`${table}: ${c.count}${c.error ? ` ERROR ${c.error}` : ""}`)
  }
  console.log(`vendor applications: ${before.vendor_applications.count}`)
  console.log(`contact_roles (vendor): ${before.contact_roles_vendor.count}`)
  console.log(`auth.users: ${beforeAuth.count}`)

  console.log("\n--- Export ---")
  const exports = []
  for (const table of OPERATIONAL_TABLES) {
    const result = await exportTable(table, outDir)
    exports.push(result)
    console.log(
      `${table}: exported ${result.rowCount} rows${result.error ? ` ERROR ${result.error}` : ""}`
    )
  }

  const vendorAppsExport = await exportTable("applications", outDir, [
    { op: "eq", col: "application_type", val: "vendor" },
  ])
  exports.push({ ...vendorAppsExport, table: "applications_vendor_type" })

  const safety = {
    contactsWillBeDeleted: false,
    profilesWillBeDeleted: false,
    authUsersWillBeDeleted: false,
    organizationMembersWillBeDeleted: false,
    configurationTablesWillBeDeleted: false,
    vendorContactOverlap: contactOverlap,
    note:
      "Only operational vendor tables are targeted. Contact rows are preserved even when linked from vendors.contact_id.",
  }

  const expectedDeletes = {}
  for (const table of OPERATIONAL_TABLES) {
    expectedDeletes[table] = { before: before[table].count, after: 0, delete: before[table].count }
  }

  const preReport = {
    capturedAt: new Date().toISOString(),
    mode: execute ? "execute" : "pre-flight",
    before,
    beforeAuth,
    beforeProtected,
    contactOverlap,
    exports,
    safety,
    expectedDeletes,
    preserveTablesBefore: Object.fromEntries(
      PRESERVE_TABLES.map((t) => [t, before[t]])
    ),
    deletionOrder: OPERATIONAL_TABLES,
  }

  const prePath = resolve(reportDir, `vendor-cleanup-pre-${STAMP}.json`)
  writeFileSync(prePath, JSON.stringify(preReport, null, 2))
  console.log(`\nPre-report: ${prePath}`)

  console.log("\n--- Safety confirmation ---")
  console.log(`contacts deleted: ${safety.contactsWillBeDeleted}`)
  console.log(`profiles deleted: ${safety.profilesWillBeDeleted}`)
  console.log(`auth.users deleted: ${safety.authUsersWillBeDeleted}`)
  console.log(`configuration tables deleted: ${safety.configurationTablesWillBeDeleted}`)
  console.log(
    `vendors linked to profile emails (vendors only deleted, contacts kept): ${contactOverlap.vendorsLinkedToProfileContacts}`
  )

  if (!execute) {
    console.log("\nDry run complete. Re-run with --execute to perform deletion.")
    return
  }

  if (reportOnly) return

  console.log("\n--- Executing FK-safe deletion ---")
  const deletionSteps = await runCleanup()
  for (const step of deletionSteps) {
    console.log(
      `${step.table}: deleted ${step.deleted}${step.error ? ` ERROR ${step.error}` : ""}`
    )
    if (step.error) {
      process.exit(1)
    }
  }

  const after = await inventoryCounts()
  const afterAuth = await countAuthUsers()
  const afterProtected = {}
  for (const table of PROTECTED_TABLES.filter((t) => t !== "auth.users")) {
    afterProtected[table] = await countTable(table)
  }

  const protectedDiff = {}
  for (const table of Object.keys(beforeProtected)) {
    protectedDiff[table] = {
      before: beforeProtected[table].count,
      after: afterProtected[table].count,
      delta: afterProtected[table].count - beforeProtected[table].count,
    }
  }

  const orphans = await findOrphansAfter(after)
  const validation = await validateVendorHubOperational()

  const postReport = {
    capturedAt: new Date().toISOString(),
    deletionSteps,
    before,
    after,
    rowCountChanges: Object.fromEntries(
      OPERATIONAL_TABLES.map((t) => [
        t,
        {
          before: before[t].count,
          after: after[t].count,
          deleted: before[t].count - after[t].count,
        },
      ])
    ),
    protectedDiff,
    authUsers: { before: beforeAuth.count, after: afterAuth.count },
    orphans,
    validation,
    vendorHubOperational:
      validation.every((c) => c.pass) && orphans.filter((o) => !o.note).length === 0,
    selfRegistrationArchitecture: {
      applicationTypeVendor: validation.find((c) => c.id === "vendor_application_type_exists")?.pass,
      vendorHubEvents: validation.find((c) => c.id === "vendor_hub_events_accessible")?.pass,
      contactCentricModel: "New vendors register via applications → contact_id (see lib/vendor-hub/contact-centric-model.ts)",
    },
  }

  const postPath = resolve(reportDir, `vendor-cleanup-post-${STAMP}.json`)
  writeFileSync(postPath, JSON.stringify(postReport, null, 2))
  console.log(`\nPost-report: ${postPath}`)
  console.log("\n--- Validation ---")
  for (const check of validation) {
    console.log(`[${check.pass ? "PASS" : "FAIL"}] ${check.id}${check.detail ? ` — ${check.detail}` : ""}`)
  }
  console.log("\n--- Protected table deltas (expect 0) ---")
  for (const [table, diff] of Object.entries(protectedDiff)) {
    console.log(`${table}: ${diff.before} → ${diff.after} (delta ${diff.delta})`)
  }
  if (orphans.length) {
    console.log("\n--- Orphans / follow-up ---")
    for (const o of orphans) {
      console.log(`${o.table}: ${o.count}${o.note ? ` — ${o.note}` : ""}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
