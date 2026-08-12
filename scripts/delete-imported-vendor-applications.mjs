/**
 * One-time cleanup for a single organization that received CSV vendor imports.
 *
 * Deletes import-created org vendor applications so those contacts can submit a
 * real apply form. Does NOT remove:
 * - contacts
 * - contact_roles (vendor role stays → Vendor Network)
 * - payments / participation / booth history
 *
 * Not used by the product for other orgs — pass --org-id explicitly.
 *
 * Usage:
 *   node scripts/delete-imported-vendor-applications.mjs --org-id <uuid>
 *   node scripts/delete-imported-vendor-applications.mjs --org-id <uuid> --execute
 *
 * Default target statuses: approved only.
 * Add --all-statuses to also delete draft/pending/rejected/withdrawn vendor apps.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
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

function parseArgs(argv) {
  const args = {
    execute: false,
    orgId: null,
    allStatuses: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--all-statuses") args.allStatuses = true
    else if (arg === "--org-id") args.orgId = argv[++i]
  }
  return args
}

loadEnvLocal()
const args = parseArgs(process.argv.slice(2))

if (!args.orgId) {
  console.error(
    "Required: --org-id <organization-uuid>\n" +
      "Example: node scripts/delete-imported-vendor-applications.mjs --org-id e057e00a-e4e3-4adf-9af5-f465db1894be"
  )
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: org, error: orgError } = await sb
  .from("organizations")
  .select("id, name")
  .eq("id", args.orgId)
  .maybeSingle()

if (orgError || !org) {
  console.error(orgError?.message || `Organization not found: ${args.orgId}`)
  process.exit(1)
}

let query = sb
  .from("applications")
  .select("id, status, applicant_name, applicant_email, submitted_at, notes, form_data, created_at")
  .eq("organization_id", args.orgId)
  .eq("application_type", "vendor")
  .eq("module_owner", "vendor_hub")

if (!args.allStatuses) {
  query = query.eq("status", "approved")
}

const { data: apps, error: appsError } = await query.order("created_at", { ascending: true })

if (appsError) {
  console.error(appsError)
  process.exit(1)
}

const ids = (apps || []).map((row) => row.id)
const statusCounts = {}
for (const app of apps || []) {
  statusCounts[app.status] = (statusCounts[app.status] || 0) + 1
}

const report = {
  mode: args.execute ? "execute" : "dry-run",
  organizationId: args.orgId,
  organizationName: org.name,
  statuses: args.allStatuses ? "all" : ["approved"],
  matched: ids.length,
  statusCounts,
  sample: (apps || []).slice(0, 12).map((app) => ({
    id: app.id,
    status: app.status,
    name: app.applicant_name,
    email: app.applicant_email,
    submitted_at: app.submitted_at,
  })),
  deleted: 0,
  errors: [],
  kept: {
    contacts: "unchanged",
    contact_roles_vendor: "unchanged",
    vendor_hub_payments: "unchanged",
    vendor_hub_participant_status: "unchanged",
    vendor_hub_booth_assignments: "unchanged",
  },
}

if (args.execute && ids.length > 0) {
  // history + documents cascade on application delete, but delete explicitly for clarity
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)

    const { error: historyError } = await sb
      .from("application_history")
      .delete()
      .in("application_id", chunk)
    if (historyError) {
      report.errors.push({ step: "application_history", error: historyError.message })
    }

    const { error: docsError } = await sb
      .from("application_documents")
      .delete()
      .in("application_id", chunk)
    if (docsError) {
      report.errors.push({ step: "application_documents", error: docsError.message })
    }

    const { error: deleteError } = await sb.from("applications").delete().in("id", chunk)
    if (deleteError) {
      report.errors.push({ step: "applications", error: deleteError.message, chunkStart: i })
    } else {
      report.deleted += chunk.length
    }
  }
}

const outDir = resolve(root, "scripts/reports")
mkdirSync(outDir, { recursive: true })
const outPath = resolve(
  outDir,
  args.execute
    ? `delete-imported-vendor-applications-${args.orgId.slice(0, 8)}-execute.json`
    : `delete-imported-vendor-applications-${args.orgId.slice(0, 8)}-dry-run.json`
)
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`Wrote ${outPath}`)
if (!args.execute) {
  console.log("Dry-run only. Re-run with --execute to delete matched applications.")
}
