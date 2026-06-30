/**
 * Permanently delete an organization and all org-scoped data.
 *
 * Usage:
 *   node scripts/delete-organization.mjs --org-id=95c4eb7d-b151-4aa1-a489-a3c1e1289c7e
 *   node scripts/delete-organization.mjs --org-id=95c4eb7d-b151-4aa1-a489-a3c1e1289c7e --execute --confirm-name="The Asad Realty"
 *
 * Safety:
 *   - MAS Dallas pilot org is blocked
 *   - Dry-run (inventory + export) unless --execute and --confirm-name match org name
 *   - Auth users with ONLY this org membership are deleted; shared users keep auth + other orgs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const STAMP = new Date().toISOString().slice(0, 10)

const PROTECTED_ORG_IDS = new Set([
  "e057e00a-e4e3-4adf-9af5-f465db1894be", // MAS Dallas pilot
])

const DEFAULT_ASAD_ORG_ID = "95c4eb7d-b151-4aa1-a489-a3c1e1289c7e"

/** Delete in dependency order (children before parents). Missing tables are skipped. */
const ORG_DATA_TABLES = [
  "transactional_email_log",
  "payment_processor_events",
  "donation_checkout_sessions",
  "pledge_reminders",
  "donation_receipts",
  "payments",
  "pledges",
  "recurring_donation_plans",
  "donors",
  "payment_import_batches",
  "ticket_order_items",
  "ticket_orders",
  "program_financial_assistance_documents",
  "program_financial_assistance_status_history",
  "program_financial_assistance",
  "program_waitlist_status_history",
  "program_waitlist",
  "program_enrollment_status_history",
  "program_enrollment_sessions",
  "program_enrollments",
  "program_payment_allocations",
  "program_charge_lines",
  "program_charges",
  "program_charge_schedule",
  "program_checkouts",
  "registration_cart_item_fees",
  "registration_cart_items",
  "registration_carts",
  "registration_orders",
  "program_extended_care",
  "program_registration_lifecycle_events",
  "rental_selected_addons",
  "rental_payments",
  "rental_contracts",
  "rental_reservations",
  "venue_rentals",
  "venue_bookings",
  "resource_reservations",
  "reservation_override_logs",
  "operational_briefs",
  "vendor_hub_participation_evaluations",
  "vendor_hub_payments",
  "vendor_hub_announcement_recipients",
  "vendor_hub_booth_assignments",
  "vendor_hub_participant_status",
  "vendor_hub_announcements",
  "vendor_hub_event_reminder_log",
  "vendor_hub_vendors",
  "vendors",
  "application_documents",
  "application_history",
  "applications",
  "service_participations",
  "hr_team_memberships",
  "contact_notes",
  "contact_roles",
  "memberships",
  "membership_status_history",
  "volunteer_assignments",
  "volunteers",
  "employees",
  "contacts",
  "people",
  "donation_subcategories",
  "donation_categories",
  "payment_methods",
  "campaigns",
  "donation_settings",
  "module_notification_settings",
  "venues",
  "spaces",
  "programs",
  "program_sessions",
  "program_offerings",
  "events",
  "internal_events",
  "hr_teams",
  "hr_positions",
  "discount_tags",
  "person_tags",
  "subscriptions",
  "organization_modules",
  "organization_invites",
  "platform_admin_org_access_log",
  "role_permissions",
  "organization_roles",
  "customer_profiles",
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

function parseArgs() {
  const orgIdArg = process.argv.find((a) => a.startsWith("--org-id="))?.split("=")[1]?.trim()
  const confirmName = process.argv
    .find((a) => a.startsWith("--confirm-name="))
    ?.split("=")
    .slice(1)
    .join("=")
    ?.trim()
  return {
    orgId: orgIdArg || DEFAULT_ASAD_ORG_ID,
    execute: process.argv.includes("--execute"),
    confirmName: confirmName || null,
  }
}

function isSkippableTableError(message) {
  if (!message) return false
  return (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    message.includes("42P01") ||
    message.includes("PGRST205")
  )
}

async function countByOrg(sb, table, orgId) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
  if (error) {
    if (isSkippableTableError(error.message)) return { count: null, skipped: true, error: null }
    return { count: null, skipped: false, error: error.message }
  }
  return { count: count ?? 0, skipped: false, error: null }
}

async function deleteByOrg(sb, table, orgId) {
  const { error, count } = await sb
    .from(table)
    .delete({ count: "exact" })
    .eq("organization_id", orgId)

  if (error) {
    if (isSkippableTableError(error.message)) {
      return { table, deleted: 0, skipped: true, error: null }
    }
    return { table, deleted: 0, skipped: false, error: error.message }
  }

  return { table, deleted: count ?? 0, skipped: false, error: null }
}

async function exportOrgSnapshot(sb, orgId, orgName, outDir) {
  mkdirSync(outDir, { recursive: true })
  const snapshot = {
    capturedAt: new Date().toISOString(),
    organizationId: orgId,
    organizationName: orgName,
    tables: {},
  }

  const exportTables = [
    "organizations",
    "organization_members",
    "organization_roles",
    "role_permissions",
    "profiles",
    "contacts",
    "donors",
    "payments",
    "pledges",
    "campaigns",
  ]

  for (const table of exportTables) {
    if (table === "organizations") {
      const { data, error } = await sb.from(table).select("*").eq("id", orgId).maybeSingle()
      snapshot.tables[table] = { error: error?.message ?? null, rows: data ? [data] : [] }
      continue
    }

    if (table === "profiles") {
      const { data: members } = await sb
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
      const userIds = (members || []).map((row) => row.user_id).filter(Boolean)
      if (!userIds.length) {
        snapshot.tables[table] = { error: null, rows: [] }
        continue
      }
      const { data, error } = await sb.from(table).select("*").in("id", userIds)
      snapshot.tables[table] = { error: error?.message ?? null, rows: data || [] }
      continue
    }

    const { data, error } = await sb.from(table).select("*").eq("organization_id", orgId).limit(5000)
    snapshot.tables[table] = {
      error: error?.message ?? null,
      rowCount: data?.length ?? 0,
      rows: data || [],
      truncated: (data?.length ?? 0) >= 5000,
    }
  }

  const file = resolve(outDir, `organization-delete-${orgId}-${STAMP}.json`)
  writeFileSync(file, JSON.stringify(snapshot, null, 2))
  return file
}

async function cleanupUsers(sb, orgId, userIds, steps) {
  for (const userId of userIds) {
    const { data: otherMemberships, error: otherError } = await sb
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .neq("organization_id", orgId)

    if (otherError) {
      steps.push({ step: "check_other_memberships", userId, error: otherError.message })
      continue
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("id, email, organization_id")
      .eq("id", userId)
      .maybeSingle()

    if ((otherMemberships || []).length > 0) {
      if (profile?.organization_id === orgId) {
        const nextOrgId = otherMemberships[0].organization_id
        const { error: profileError } = await sb
          .from("profiles")
          .update({ organization_id: nextOrgId, updated_at: new Date().toISOString() })
          .eq("id", userId)

        steps.push({
          step: "repoint_profile_org",
          userId,
          email: profile?.email ?? null,
          nextOrgId,
          error: profileError?.message ?? null,
        })
      } else {
        steps.push({
          step: "keep_auth_user",
          userId,
          email: profile?.email ?? null,
          reason: "has_other_org_memberships",
        })
      }
      continue
    }

    const { error: deleteUserError } = await sb.auth.admin.deleteUser(userId)
    steps.push({
      step: "delete_auth_user",
      userId,
      email: profile?.email ?? null,
      error: deleteUserError?.message ?? null,
    })
  }
}

async function main() {
  loadEnvLocal()
  const { orgId, execute, confirmName } = parseArgs()

  if (PROTECTED_ORG_IDS.has(orgId)) {
    console.error(`Refusing to delete protected organization: ${orgId}`)
    process.exit(1)
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: org, error: orgError } = await sb
    .from("organizations")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle()

  if (orgError || !org) {
    console.error(orgError?.message || `Organization not found: ${orgId}`)
    process.exit(1)
  }

  console.log("=== Organization Delete ===\n")
  console.log(`Target: ${org.name} (${org.id})`)
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN (inventory + export only)"}\n`)

  const inventory = {}
  for (const table of ORG_DATA_TABLES) {
    inventory[table] = await countByOrg(sb, table, orgId)
  }

  const { data: memberRows, error: membersLoadError } = await sb
    .from("organization_members")
    .select("user_id, role, status")
    .eq("organization_id", orgId)

  if (membersLoadError) {
    console.error(membersLoadError.message)
    process.exit(1)
  }

  const memberUserIds = [...new Set((memberRows || []).map((row) => row.user_id).filter(Boolean))]
  const profileByUserId = new Map()

  if (memberUserIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, email, first_name, last_name, organization_id")
      .in("id", memberUserIds)

    for (const profile of profiles || []) {
      profileByUserId.set(profile.id, profile)
    }
  }

  console.log("--- Row counts (organization_id scoped) ---")
  let totalRows = 0
  for (const [table, result] of Object.entries(inventory)) {
    if (result.skipped) continue
    if (result.error) {
      console.log(`${table}: ERROR ${result.error}`)
      continue
    }
    if (result.count > 0) {
      console.log(`${table}: ${result.count}`)
      totalRows += result.count
    }
  }
  console.log(`\nApproximate scoped rows listed above: ${totalRows}`)
  console.log(`Organization members: ${memberRows?.length ?? 0}`)
  for (const member of memberRows || []) {
    const profile = profileByUserId.get(member.user_id)
    const name = profile
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
      : ""
    console.log(`  - ${profile?.email || member.user_id} (${member.role}, ${member.status}) ${name}`)
  }

  const backupDir = resolve(root, "scripts/backups/organization-delete")
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })

  const backupFile = await exportOrgSnapshot(sb, orgId, org.name, backupDir)
  console.log(`\nBackup written: ${backupFile}`)

  const report = {
    capturedAt: new Date().toISOString(),
    organization: org,
    execute,
    inventory,
    members: memberRows || [],
    backupFile,
    steps: [],
  }

  if (!execute) {
    report.steps.push({
      action: "dry_run_complete",
      message: "Re-run with --execute --confirm-name=\"Exact Org Name\" to delete.",
    })
    const reportFile = resolve(reportDir, `organization-delete-${org.id}-${STAMP}.json`)
    writeFileSync(reportFile, JSON.stringify(report, null, 2))
    console.log(`\nReport: ${reportFile}`)
    console.log(
      `\nTo delete, run:\n  node scripts/delete-organization.mjs --org-id=${orgId} --execute --confirm-name="${org.name}"`
    )
    return
  }

  if (confirmName !== org.name) {
    console.error(
      `\nRefusing execute: --confirm-name must exactly match org name "${org.name}"`
    )
    process.exit(1)
  }

  console.log("\n--- Deleting org data ---")

  for (const table of ORG_DATA_TABLES) {
    const result = await deleteByOrg(sb, table, orgId)
    if (result.skipped) continue
    if (result.deleted > 0 || result.error) {
      report.steps.push(result)
      console.log(
        `${result.table}: deleted ${result.deleted}${result.error ? ` ERROR ${result.error}` : ""}`
      )
    }
    if (result.error && !isSkippableTableError(result.error)) {
      const nonFatal = result.error.includes("cannot delete from view")
      if (!nonFatal) {
        console.error(`Stopping due to error on ${table}`)
        break
      }
    }
  }

  await cleanupUsers(sb, orgId, memberUserIds, report.steps)

  for (const table of ["organization_members"]) {
    const result = await deleteByOrg(sb, table, orgId)
    report.steps.push(result)
    console.log(
      `${result.table}: deleted ${result.deleted}${result.error ? ` ERROR ${result.error}` : ""}`
    )
    if (result.error && !isSkippableTableError(result.error)) {
      console.error(`Stopping due to error on ${table}`)
      break
    }
  }

  const { error: orgDeleteError, count: orgDeleteCount } = await sb
    .from("organizations")
    .delete({ count: "exact" })
    .eq("id", orgId)

  report.steps.push({
    step: "delete_organization",
    deleted: orgDeleteCount ?? 0,
    error: orgDeleteError?.message ?? null,
  })

  if (orgDeleteError) {
    console.error(`\nFailed to delete organization row: ${orgDeleteError.message}`)
  } else {
    console.log(`\nDeleted organization row: ${orgDeleteCount ?? 0}`)
  }

  const reportFile = resolve(reportDir, `organization-delete-${org.id}-${STAMP}-executed.json`)
  writeFileSync(reportFile, JSON.stringify(report, null, 2))
  console.log(`\nExecution report: ${reportFile}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
