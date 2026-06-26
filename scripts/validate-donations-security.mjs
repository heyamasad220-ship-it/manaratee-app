/**
 * Validates donations RLS hardening + server-side permission guards (Priority 14).
 * Usage: node scripts/validate-donations-security.mjs
 *
 * Requires migration 095_donations_rls_hardening.sql applied.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const TEST_TAG = "DONATIONS_SECURITY_VALIDATION"

const DONATION_TABLES = [
  "payments",
  "pledges",
  "donors",
  "recurring_donation_plans",
  "donation_receipts",
  "pledge_reminders",
  "payment_processor_events",
  "donation_checkout_sessions",
]

const EXPECTED_POLICIES = {
  payments: [
    "Staff view org payments",
    "Staff manage org payments",
    "Customers view own payments",
    "Customers insert own portal payments",
  ],
  pledges: [
    "Staff view org pledges",
    "Staff manage org pledges",
    "Customers view own pledges",
    "Customers insert own pledges",
  ],
  donors: [
    "Staff view org donors",
    "Staff manage org donors",
    "Customers view own donor profile",
    "Customers create own donor profile",
  ],
  recurring_donation_plans: [
    "Staff view recurring donation plans",
    "Staff manage recurring donation plans",
  ],
  donation_receipts: [
    "Staff view donation receipts",
    "Staff manage donation receipts",
  ],
  pledge_reminders: [
    "Staff view pledge reminders",
    "Staff manage pledge reminders",
  ],
  payment_processor_events: ["Staff view processor events"],
  donation_checkout_sessions: [
    "Staff view donation checkout sessions",
    "Customers view own donation checkout sessions",
  ],
}

const LAYOUT_CHECKS = [
  {
    id: "layout_donations_view",
    path: "app/(dashboard)/donations/layout.tsx",
    mustInclude: ["requireAnyPermission", "DONATIONS_VIEW", "DONATIONS_MANAGE"],
  },
  {
    id: "layout_import_manage",
    path: "app/(dashboard)/donations/payments/import/layout.tsx",
    mustInclude: ["requirePermission", "DONATIONS_MANAGE"],
  },
  {
    id: "layout_match_manage",
    path: "app/(dashboard)/donations/payments/match/layout.tsx",
    mustInclude: ["requirePermission", "DONATIONS_MANAGE"],
  },
  {
    id: "layout_settings_manage",
    path: "app/(dashboard)/donations/settings/layout.tsx",
    mustInclude: ["requirePermission", "DONATIONS_MANAGE"],
  },
]

const ACTION_FILES = [
  "lib/donations/receipt-actions.ts",
  "lib/donations/pledge-reminder-actions.ts",
  "lib/donations/recurring-donation-actions.ts",
]

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase credentials (url, service role, anon)")
  process.exit(2)
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const checks = []
function record(id, pass, detail, extra = {}) {
  checks.push({ id, pass, detail, ...extra })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

async function resolveOrgId() {
  const explicit = process.env.DONATIONS_SEED_ORG_ID
  if (explicit) return explicit

  const { data } = await service
    .from("contacts")
    .select("organization_id")
    .eq("email", "donations-seed-individual@dev.test")
    .maybeSingle()

  if (data?.organization_id) return data.organization_id

  const { data: org } = await service.from("organizations").select("id").limit(1).maybeSingle()
  return org?.id ?? null
}

async function fetchPolicies() {
  const { data, error } = await service.rpc("get_policies_for_tables", {
    table_names: DONATION_TABLES,
  })

  if (!error && Array.isArray(data)) {
    return data
  }

  const policies = []
  for (const table of DONATION_TABLES) {
    const { data: rows, error: tableError } = await service
      .from("pg_policies")
      .select("tablename, policyname")
      .eq("tablename", table)

    if (!tableError && rows) {
      policies.push(...rows)
    }
  }

  return policies
}

function readPoliciesFromMigration() {
  const migrationPath = resolve(root, "scripts/095_donations_rls_hardening.sql")
  const sql = readFileSync(migrationPath, "utf8")
  const found = {}

  for (const table of DONATION_TABLES) {
    found[table] = []
  }

  const policyRegex = /CREATE POLICY "([^"]+)"\s+ON public\.(\w+)/g
  let match
  while ((match = policyRegex.exec(sql)) !== null) {
    const [, policyName, table] = match
    if (found[table]) {
      found[table].push(policyName)
    }
  }

  return found
}

function checkStaticLayouts() {
  for (const layout of LAYOUT_CHECKS) {
    const fullPath = resolve(root, layout.path)
    if (!existsSync(fullPath)) {
      record(layout.id, false, `missing file ${layout.path}`)
      continue
    }
    const content = readFileSync(fullPath, "utf8")
    const missing = layout.mustInclude.filter((token) => !content.includes(token))
    record(layout.id, missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : "ok")
  }
}

function checkServerActions() {
  for (const relativePath of ACTION_FILES) {
    const fullPath = resolve(root, relativePath)
    const content = readFileSync(fullPath, "utf8")
    const usesAuth = content.includes("requireDonationStaffAccess")
    const hasView = content.includes('requireDonationStaffAccess("view")')
    const hasManage = content.includes('requireDonationStaffAccess("manage")')
    record(
      `actions_${relativePath.split("/").pop()}`,
      usesAuth && hasView && hasManage,
      usesAuth ? `view=${hasView} manage=${hasManage}` : "missing requireDonationStaffAccess"
    )
  }

  const authHelper = resolve(root, "lib/donations/donation-action-auth.ts")
  record(
    "actions_donation_action_auth",
    existsSync(authHelper),
    existsSync(authHelper) ? "ok" : "missing donation-action-auth.ts"
  )
}

async function checkAnonBlocked() {
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const table of ["payments", "pledges", "donors"]) {
    const { data, error } = await anon.from(table).select("id").limit(5)
    const blocked = !error && (data?.length ?? 0) === 0
    record(`anon_blocked_${table}`, blocked, error?.message || `rows=${data?.length ?? 0}`)
  }
}

async function checkServiceRoleAccess(orgId) {
  for (const table of DONATION_TABLES) {
    const { error } = await service.from(table).select("id").eq("organization_id", orgId).limit(1)
    if (table === "payment_processor_events") {
      const { error: peError } = await service.from(table).select("id").limit(1)
      record(`service_role_${table}`, !peError, peError?.message || "ok")
      continue
    }
    record(`service_role_${table}`, !error, error?.message || "ok")
  }
}

async function checkCustomerIsolation(orgId) {
  const password = `SecTest!${Date.now().toString(36)}`
  const emailA = `rls-cust-a-${Date.now()}@security.test`
  const emailB = `rls-cust-b-${Date.now()}@security.test`

  const createdUsers = []

  async function createAuthUser(email) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data.user?.id) {
      throw new Error(error?.message || `Could not create user ${email}`)
    }
    createdUsers.push(data.user.id)
    return data.user.id
  }

  async function cleanup() {
    for (const userId of createdUsers) {
      await service.auth.admin.deleteUser(userId)
    }
  }

  try {
    const userA = await createAuthUser(emailA)
    const userB = await createAuthUser(emailB)

    const { data: contactA, error: contactAError } = await service
      .from("contacts")
      .insert({
        organization_id: orgId,
        auth_user_id: userA,
        email: emailA,
        full_name: `${TEST_TAG} Contact A`,
        contact_type: "individual",
      })
      .select("id")
      .single()

    const { data: contactB, error: contactBError } = await service
      .from("contacts")
      .insert({
        organization_id: orgId,
        auth_user_id: userB,
        email: emailB,
        full_name: `${TEST_TAG} Contact B`,
        contact_type: "individual",
      })
      .select("id")
      .single()

    if (contactAError || contactBError || !contactA?.id || !contactB?.id) {
      record(
        "customer_isolation_setup",
        false,
        contactAError?.message || contactBError?.message || "contact insert failed"
      )
      return
    }

    const { data: donorB, error: donorBError } = await service
      .from("donors")
      .insert({
        organization_id: orgId,
        contact_id: contactB.id,
        full_name: `${TEST_TAG} Donor B`,
        email: emailB,
        donor_type: "individual",
        status: "active",
      })
      .select("id")
      .single()

    if (donorBError || !donorB?.id) {
      record("customer_isolation_setup", false, donorBError?.message || "donor B insert failed")
      return
    }

    const { data: paymentB, error: paymentBError } = await service
      .from("payments")
      .insert({
        organization_id: orgId,
        contact_id: contactB.id,
        donor_id: donorB.id,
        amount: 42,
        source_type: "portal",
        source: "cash",
        status: "allocated",
        memo: TEST_TAG,
      })
      .select("id")
      .single()

    if (paymentBError || !paymentB?.id) {
      record("customer_isolation_setup", false, paymentBError?.message || "payment B insert failed")
      return
    }

    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: emailA,
      password,
    })

    if (signInError) {
      record("customer_isolation_setup", false, signInError.message)
      return
    }

    const { data: ownDonors } = await userClient
      .from("donors")
      .select("id")
      .eq("organization_id", orgId)

    const { data: otherDonorDirect } = await userClient
      .from("donors")
      .select("id")
      .eq("id", donorB.id)
      .maybeSingle()

    const { data: otherPayments } = await userClient
      .from("payments")
      .select("id")
      .eq("id", paymentB.id)

    const { data: allPayments } = await userClient
      .from("payments")
      .select("id, contact_id")
      .eq("organization_id", orgId)
      .eq("memo", TEST_TAG)

    record(
      "customer_cannot_read_other_donor",
      !otherDonorDirect?.id,
      otherDonorDirect?.id ? "saw other donor" : "blocked"
    )
    record(
      "customer_cannot_read_other_payment",
      (otherPayments?.length ?? 0) === 0,
      `rows=${otherPayments?.length ?? 0}`
    )
    record(
      "customer_sees_only_own_donor_rows",
      (ownDonors?.length ?? 0) === 0,
      `ownDonors=${ownDonors?.length ?? 0}`
    )
    record(
      "customer_payment_list_scoped",
      (allPayments?.length ?? 0) === 0,
      `taggedPaymentsVisible=${allPayments?.length ?? 0}`
    )

    await userClient.auth.signOut()

    await service.from("payments").delete().eq("id", paymentB.id)
    await service.from("donors").delete().eq("id", donorB.id)
    await service.from("contacts").delete().eq("id", contactA.id)
    await service.from("contacts").delete().eq("id", contactB.id)
  } catch (error) {
    record("customer_isolation", false, error instanceof Error ? error.message : String(error))
  } finally {
    await cleanup()
  }
}

async function checkStaffCrossOrg() {
  const { data: orgs } = await service.from("organizations").select("id").limit(2)
  if (!orgs || orgs.length < 2) {
    record("staff_cross_org_setup", false, "need at least 2 organizations")
    return
  }

  const orgA = orgs[0].id
  const orgB = orgs[1].id

  const { data: paymentInB } = await service
    .from("payments")
    .select("id, organization_id")
    .eq("organization_id", orgB)
    .limit(1)
    .maybeSingle()

  if (!paymentInB?.id) {
    record("staff_cross_org_setup", false, "no payments in second org to probe")
    return
  }

  const password = `SecStaff!${Date.now().toString(36)}`
  const email = `rls-staff-${Date.now()}@security.test`
  let userId = null

  try {
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError || !authData.user?.id) {
      record("staff_cross_org_setup", false, authError?.message || "user create failed")
      return
    }
    userId = authData.user.id

    const { data: role } = await service
      .from("organization_roles")
      .select("id")
      .eq("organization_id", orgA)
      .limit(1)
      .maybeSingle()

    const roleId = role?.id ?? null

    const { error: memberError } = await service.from("organization_members").insert({
      organization_id: orgA,
      user_id: userId,
      role: "viewer",
      role_id: roleId,
      status: "active",
    })

    if (memberError) {
      record("staff_cross_org_setup", false, memberError.message)
      return
    }

    const staffClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error: signInError } = await staffClient.auth.signInWithPassword({ email, password })
    if (signInError) {
      record("staff_cross_org_setup", false, signInError.message)
      return
    }

    const { data: crossOrgPayments, error: crossError } = await staffClient
      .from("payments")
      .select("id")
      .eq("organization_id", orgB)
      .eq("id", paymentInB.id)

    const blocked =
      !crossError && (crossOrgPayments?.length ?? 0) === 0 && crossOrgPayments?.[0]?.id !== paymentInB.id

    record(
      "staff_cannot_read_other_org_payment",
      blocked,
      crossError?.message || `rows=${crossOrgPayments?.length ?? 0}`
    )

    await staffClient.auth.signOut()
  } finally {
    if (userId) {
      await service.from("organization_members").delete().eq("user_id", userId)
      await service.auth.admin.deleteUser(userId)
    }
  }
}

function checkMigrationPoliciesDeclared() {
  const declared = readPoliciesFromMigration()
  for (const [table, expected] of Object.entries(EXPECTED_POLICIES)) {
    const missing = expected.filter((name) => !(declared[table] || []).includes(name))
    record(
      `migration_policies_${table}`,
      missing.length === 0,
      missing.length ? `missing in 095: ${missing.join(", ")}` : `${expected.length} policies declared`
    )
  }

  const migrationSql = readFileSync(resolve(root, "scripts/095_donations_rls_hardening.sql"), "utf8")
  const helpers = [
    "auth_user_can_view_donations",
    "auth_user_can_manage_donations",
    "auth_user_contact_ids",
    "auth_user_donor_ids",
  ]
  for (const helper of helpers) {
    record(
      `migration_helper_${helper}`,
      migrationSql.includes(helper),
      migrationSql.includes(helper) ? "declared" : "missing"
    )
  }
}

function runChildValidator(scriptName) {
  const scriptPath = resolve(root, "scripts", scriptName)
  if (!existsSync(scriptPath)) {
    record(`integration_${scriptName}`, false, "script missing")
    return
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  const output = `${result.stdout || ""}\n${result.stderr || ""}`
  const passCount = (output.match(/\[PASS\]/g) || []).length
  const failCount = (output.match(/\[FAIL\]/g) || []).length
  const skipped =
    result.status === 2 &&
    (output.includes("Need a payment for receipt validation") ||
      output.includes("No organization found"))

  if (skipped) {
    record(
      `integration_${scriptName.replace(".mjs", "")}`,
      true,
      `skipped (${passCount} partial checks; seed data unavailable)`
    )
    return
  }

  const pass = result.status === 0 && failCount === 0

  record(
    `integration_${scriptName.replace(".mjs", "")}`,
    pass,
    pass ? `${passCount} checks passed` : `exit=${result.status} pass=${passCount} fail=${failCount}`
  )
}

const orgId = await resolveOrgId()
if (!orgId) {
  console.error("No organization found for validation")
  process.exit(2)
}

console.log(`\n=== Donations security validation (org ${orgId}) ===\n`)

checkMigrationPoliciesDeclared()
checkStaticLayouts()
checkServerActions()
await checkAnonBlocked()
await checkServiceRoleAccess(orgId)
await checkCustomerIsolation(orgId)
await checkStaffCrossOrg()

console.log("\n--- Integration validators (service role / webhooks) ---\n")
runChildValidator("validate-stripe-one-time-donations.mjs")
runChildValidator("validate-transactional-email.mjs")

const failed = checks.filter((c) => !c.pass)
const passed = checks.filter((c) => c.pass)

console.log(`\n=== Summary: ${passed.length}/${checks.length} passed ===`)
if (failed.length) {
  console.log("Failed:")
  for (const check of failed) {
    console.log(`  - ${check.id}: ${check.detail || ""}`)
  }
  process.exit(1)
}
