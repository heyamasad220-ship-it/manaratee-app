/**
 * Shared utilities for Contacts Security validation (CR-8).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export const CONTACTS_SECURITY_MIGRATIONS = [
  "102_contacts_rls_helpers.sql",
  "103_contacts_rls_support_helpers.sql",
  "104_contacts_rls_policies.sql",
  "105_contact_roles_rls_policies.sql",
  "106_contact_notes_rls_policies.sql",
  "107_contacts_permission_seeds.sql",
  "108_contacts_affiliation_sync_rpcs.sql",
  "109_contacts_rls_gate_alignment.sql",
  "110_contacts_membership_permission_seeds.sql",
]

export const M4_MIGRATION = "111_contacts_m4_drop_open_policies.sql"

export const CONTACTS_TABLES = ["contacts", "contact_roles", "contact_notes"]

export const EXPECTED_STAFF_POLICIES = {
  contacts: [
    "Staff view org contacts",
    "Staff insert org contacts",
    "Staff update org contacts",
    "Staff delete org contacts",
    "Customers view own contacts",
    "Customers view family contacts",
    "Customers update own contacts",
  ],
  contact_roles: [
    "Staff view org contact roles",
    "Staff insert org contact roles",
    "Staff update org contact roles",
    "Staff delete org contact roles",
  ],
  contact_notes: [
    "Staff view org contact notes",
    "Staff insert org contact notes",
    "Staff update org contact notes",
    "Staff delete org contact notes",
  ],
}

export const OPEN_POLICY_NAMES = [
  "contacts_select_policy",
  "contacts_insert_policy",
  "contact_roles_select_policy",
  "contact_roles_insert_policy",
]

export const REQUIRED_HELPERS = [
  "auth_user_has_contact_permission",
  "auth_user_can_view_contacts",
  "auth_user_can_manage_contacts",
  "auth_user_can_view_family_contact",
  "auth_user_may_sync_derived_affiliations",
  "auth_user_may_create_contact_via_module",
  "auth_user_may_ensure_contact_for_person",
]

export const REQUIRED_RPCS = [
  "sync_contact_affiliations",
  "find_or_create_contact_for_org",
  "ensure_contact_for_person",
]

export const M6B_CREATE_GATE_KEYS = [
  "events.manage",
  "ticketing.manage",
  "membership.manage",
]

export const M6B_SYNC_GATE_KEYS = [
  "events.view",
  "events.manage",
  "ticketing.view",
  "ticketing.manage",
  "membership.view",
  "membership.manage",
]

export const STATIC_APP_CHECKS = [
  {
    id: "rpc-sync-routing",
    path: "lib/contacts/contact-affiliation-sync.ts",
    mustInclude: ['rpc("sync_contact_affiliations"'],
  },
  {
    id: "rpc-foc-routing",
    path: "lib/contacts/contact-actions.ts",
    mustInclude: ['"find_or_create_contact_for_org"'],
  },
  {
    id: "rpc-ensure-person-routing",
    path: "lib/contacts/contact-actions.ts",
    mustInclude: ['"ensure_contact_for_person"'],
  },
  {
    id: "ticketing-assert-m6b",
    path: "lib/tickets/ticket-order-actions.ts",
    mustInclude: ["TICKETING_MANAGE"],
  },
  {
    id: "membership-assert-m6b",
    path: "lib/memberships/membership-actions.ts",
    mustInclude: ["assertMembershipManagePermission", "MEMBERSHIP_MANAGE"],
  },
  {
    id: "permission-keys-m6b",
    path: "lib/permissions/permission-keys.ts",
    mustInclude: [
      "MEMBERSHIP_VIEW",
      "MEMBERSHIP_MANAGE",
      "TICKETING_VIEW",
      "TICKETING_MANAGE",
      "CONTACTS_VIEW",
      "CONTACTS_MANAGE",
    ],
  },
]

export function getProjectRoot() {
  return resolve(__dirname, "../..")
}

export function getScriptsDir() {
  return resolve(__dirname, "..")
}

export function loadEnvLocal() {
  const path = resolve(getProjectRoot(), ".env.local")
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

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function createCheckRecorder(suite) {
  const checks = []
  return {
    checks,
    record(id, pass, detail = "") {
      checks.push({ id, suite, pass, detail })
      console.log(`[${pass ? "PASS" : "FAIL"}] ${suite}/${id}${detail ? ` — ${detail}` : ""}`)
    },
  }
}

export function readMigrationSql(filename) {
  const path = resolve(getScriptsDir(), filename)
  if (!existsSync(path)) return null
  return readFileSync(path, "utf8")
}

export function policiesFromMigration(sql) {
  const found = {}
  if (!sql) return found
  const regex = /CREATE POLICY "([^"]+)"\s+ON public\.(\w+)/g
  let match
  while ((match = regex.exec(sql)) !== null) {
    const [, policyName, table] = match
    if (!found[table]) found[table] = []
    found[table].push(policyName)
  }
  return found
}

export async function fetchLivePolicies(service, tables) {
  const policies = []
  for (const table of tables) {
    const { data, error } = await service
      .from("pg_policies")
      .select("tablename, policyname, qual, with_check")
      .eq("tablename", table)

    if (error) {
      return { policies: null, error: error.message }
    }
    policies.push(...(data || []))
  }
  return { policies, error: null }
}

export async function functionExists(service, name) {
  const { data, error } = await service.rpc("pg_function_exists", { fn_name: name })
  if (!error) return Boolean(data)

  const { data: rows, error: queryError } = await service
    .from("pg_proc")
    .select("proname")
    .eq("proname", name)
    .limit(1)

  if (queryError) return null
  return (rows || []).length > 0
}

export function checkStaticAppFiles(root, record) {
  for (const check of STATIC_APP_CHECKS) {
    const fullPath = resolve(root, check.path)
    if (!existsSync(fullPath)) {
      record(check.id, false, `missing ${check.path}`)
      continue
    }
    const content = readFileSync(fullPath, "utf8")
    const missing = check.mustInclude.filter((token) => !content.includes(token))
    record(check.id, missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : "ok")
  }
}

export function checkMigrationFiles(record) {
  for (const file of CONTACTS_SECURITY_MIGRATIONS) {
    const exists = existsSync(resolve(getScriptsDir(), file))
    record(`migration-${file}`, exists, exists ? "present" : "missing")
  }
}

export function checkGateAlignmentSql(record) {
  const sql = readMigrationSql("109_contacts_rls_gate_alignment.sql")
  if (!sql) {
    record("gate-sql-present", false, "109 missing")
    return
  }
  record("gate-sql-present", true, "ok")

  for (const key of M6B_CREATE_GATE_KEYS) {
    const inCreate = sql.includes(`'${key}'`) && sql.includes("may_create_contact_via_module")
    record(`gate-create-${key}`, inCreate, inCreate ? "in create gate" : "missing from create gate")
  }

  for (const key of M6B_SYNC_GATE_KEYS) {
    const inSync = sql.includes(`'${key}'`) && sql.includes("may_sync_derived_affiliations")
    record(`gate-sync-${key}`, inSync, inSync ? "in sync gate" : "missing from sync gate")
  }
}

export function checkExpectedPoliciesFromMigrations(record) {
  const files = ["104_contacts_rls_policies.sql", "105_contact_roles_rls_policies.sql", "106_contact_notes_rls_policies.sql"]
  const merged = {}

  for (const file of files) {
    Object.assign(merged, policiesFromMigration(readMigrationSql(file)))
  }

  for (const [table, expected] of Object.entries(EXPECTED_STAFF_POLICIES)) {
    const found = merged[table] || []
    for (const policy of expected) {
      record(`policy-migration-${table}-${policy}`, found.includes(policy), found.includes(policy) ? "ok" : "not in SQL")
    }
  }
}

export function parseSuiteSummary(stdout) {
  const passMatch = stdout.match(/(\d+)\/(\d+)\s+checks?\s+passed/i)
  if (passMatch) {
    return { passed: Number(passMatch[1]), total: Number(passMatch[2]) }
  }
  return null
}
