/**
 * Shared utilities for Contacts Phase 1 validation scripts (S-12).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export const PHASE1_SUITES = [
  {
    id: "stripe-one-time",
    label: "S-02 One-time Stripe donation sync",
    script: "validate-stripe-one-time-donations.mjs",
    npmScript: "validate:stripe-one-time",
    module: "donations",
  },
  {
    id: "stripe-recurring",
    label: "S-03 Recurring Stripe donation sync",
    script: "validate-stripe-recurring-donations.mjs",
    npmScript: "validate:stripe-recurring",
    module: "donations",
  },
  {
    id: "portal-pledge",
    label: "S-05/S-06 Portal + pledge donation sync",
    script: "validate-portal-pledge-donation-sync.mjs",
    npmScript: "validate:portal-pledge-donation-sync",
    module: "donations",
  },
  {
    id: "ticketing-completion",
    label: "S-08 Ticketing completion sync",
    script: "validate-ticketing-completion-sync.mjs",
    npmScript: "validate:ticketing-completion-sync",
    module: "ticketing",
  },
  {
    id: "program-participant",
    label: "S-09/S-10 Program participant sync",
    script: "validate-program-participant-sync.mjs",
    npmScript: "validate:program-participant-sync",
    module: "programs",
  },
  {
    id: "volunteer-identity",
    label: "S-11 Volunteer identity sync",
    script: "validate-volunteer-identity-sync.mjs",
    npmScript: "validate:volunteer-identity-sync",
    module: "volunteers",
  },
]

export const PHASE1_PARTICIPATION_ROLES = [
  "donor",
  "volunteer",
  "program_participant",
  "event_attendee",
]

export const PROGRAM_PARTICIPANT_TERMINAL_STATUSES = [
  "cancelled",
  "withdrawn",
  "transferred",
]

/** Phase 1 write paths that must not depend on profile refresh for affiliation sync. */
export const PHASE1_WRITE_PATHS = [
  "lib/donations/stripe/processor-payment.ts",
  "lib/donations/stripe/processor-subscription.ts",
  "lib/tickets/ticket-order-actions.ts",
  "lib/programs/program-enrollment-actions.ts",
  "lib/programs/program-registration-actions.ts",
  "lib/volunteers/volunteer-actions.ts",
  "app/(customer)/customer/donation/page.tsx",
  "app/(dashboard)/donations/(operations)/pledges/page.tsx",
]

export function getProjectRoot() {
  return resolve(__dirname, "..", "..")
}

export function getScriptsDir() {
  return resolve(getProjectRoot(), "scripts")
}

export function loadEnvLocal(root = getProjectRoot()) {
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

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function readProjectSource(relativePath) {
  return readFileSync(resolve(getProjectRoot(), relativePath), "utf8")
}

export function createCheckRecorder(suitePrefix = "") {
  const checks = []
  function record(id, pass, detail) {
    const fullId = suitePrefix ? `${suitePrefix}:${id}` : id
    checks.push({ id: fullId, pass: Boolean(pass), detail: detail || null })
    console.log(`[${pass ? "PASS" : "FAIL"}] ${fullId}${detail ? ` — ${detail}` : ""}`)
    return pass
  }
  return { checks, record }
}

export async function countRoleRows(sb, organizationId, contactId, role) {
  const { data, error } = await sb
    .from("contact_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", role)

  if (error) return { ok: false, error: error.message, count: 0 }
  return { ok: true, count: (data || []).length }
}

export async function hasRole(sb, organizationId, contactId, role) {
  const result = await countRoleRows(sb, organizationId, contactId, role)
  return { ...result, hasRole: result.count > 0 }
}

/**
 * Probe whether a role value is allowed by contact_roles_role_check (migration 101 for participation roles).
 */
export async function assertRoleAllowedInSchema(sb, role, migrationHint) {
  const probeContactId = `00000000-0000-0000-0000-${role === "donor" ? "000000000097" : role === "volunteer" ? "000000000096" : role === "program_participant" ? "000000000098" : "000000000099"}`
  const { error } = await sb.from("contact_roles").insert({
    organization_id: "00000000-0000-0000-0000-000000000001",
    contact_id: probeContactId,
    role,
    is_manual: false,
  })

  if (!error) {
    await sb
      .from("contact_roles")
      .delete()
      .eq("contact_id", probeContactId)
      .eq("role", role)
    return { ok: true }
  }

  if (error.code === "23514" || error.message?.includes("contact_roles_role_check")) {
    return { ok: false, message: migrationHint || `Role ${role} not allowed — check migrations` }
  }

  if (error.code === "23503") {
    return { ok: true }
  }

  return { ok: false, message: error.message }
}

export async function assertParticipationRolesSchema(sb) {
  const results = []
  for (const role of ["program_participant", "event_attendee"]) {
    results.push(
      await assertRoleAllowedInSchema(
        sb,
        role,
        "Run scripts/101_contact_participation_roles.sql before Contacts Phase 1 validation"
      )
    )
  }
  const failed = results.find((result) => !result.ok)
  if (failed) return failed
  return { ok: true }
}

export function assertStickyRoleInRules(role) {
  const rules = readProjectSource("lib/contacts/contact-affiliation-rules.ts")
  const quoted = `"${role}"`
  return (
    rules.includes(quoted) && new RegExp(`STICKY_DERIVED_ROLES[\\s\\S]*${role}`).test(rules)
  )
}

export function assertMemberAutoRemovable() {
  const rules = readProjectSource("lib/contacts/contact-affiliation-rules.ts")
  return (
    rules.includes('"member"') &&
    /AUTO_REMOVABLE_DERIVED_ROLES[\s\S]*member/.test(rules)
  )
}

/** Idempotent derived-role upsert mirror used by DB simulation checks. */
export async function upsertDerivedRoleMirror(sb, organizationId, contactId, role) {
  const { error } = await sb.from("contact_roles").insert({
    organization_id: organizationId,
    contact_id: contactId,
    role,
    is_manual: false,
  })

  if (error && error.code !== "23505") {
    throw new Error(error.message || `Could not upsert ${role} role`)
  }
}

/** Mirrors computeDerivedAffiliations donor derivation (payment required). */
export async function applyDonorAffiliationMirror(sb, organizationId, contactId) {
  const { count: paymentByContactCount, error: paymentByContactError } = await sb
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)

  if (paymentByContactError) {
    throw new Error(paymentByContactError.message || "Could not count payments by contact")
  }

  if ((paymentByContactCount ?? 0) > 0) {
    await upsertDerivedRoleMirror(sb, organizationId, contactId, "donor")
    return
  }

  const { data: donorRows, error: donorError } = await sb
    .from("donors")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)

  if (donorError) {
    throw new Error(donorError.message || "Could not load donor extension")
  }

  const donorIds = (donorRows || []).map((row) => row.id)
  if (donorIds.length === 0) return

  const { count: paymentByDonorCount, error: paymentByDonorError } = await sb
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("donor_id", donorIds)

  if (paymentByDonorError) {
    throw new Error(paymentByDonorError.message || "Could not count payments by donor")
  }

  if ((paymentByDonorCount ?? 0) === 0) return

  await upsertDerivedRoleMirror(sb, organizationId, contactId, "donor")
}

/** Mirrors computeDerivedAffiliations volunteer derivation. */
export async function applyVolunteerAffiliationMirror(sb, organizationId, contactId) {
  const { data: volunteerRow, error } = await sb
    .from("volunteers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "Could not check volunteer record")
  }

  if (!volunteerRow) return
  await upsertDerivedRoleMirror(sb, organizationId, contactId, "volunteer")
}

/** Mirrors computeDerivedAffiliations program_participant derivation. */
export async function applyProgramParticipantAffiliationMirror(sb, organizationId, contactId) {
  const terminalFilter = PROGRAM_PARTICIPANT_TERMINAL_STATUSES.join(",")
  const { count, error } = await sb
    .from("program_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("participant_contact_id", contactId)
    .not("status", "in", `(${terminalFilter})`)

  if (error) {
    throw new Error(error.message || "Could not count program enrollments")
  }

  if ((count ?? 0) === 0) return
  await upsertDerivedRoleMirror(sb, organizationId, contactId, "program_participant")
}

/** Mirrors computeDerivedAffiliations event_attendee derivation. */
export async function applyEventAttendeeAffiliationMirror(sb, organizationId, contactId) {
  const { count, error } = await sb
    .from("ticket_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("status", "completed")

  if (error) {
    throw new Error(error.message || "Could not count completed ticket orders")
  }

  if ((count ?? 0) === 0) return
  await upsertDerivedRoleMirror(sb, organizationId, contactId, "event_attendee")
}

export function assertPhase1PathsAvoidProfileRefresh() {
  const offenders = []
  for (const relativePath of PHASE1_WRITE_PATHS) {
    const source = readProjectSource(relativePath)
    if (source.includes("refreshContactAffiliations")) {
      offenders.push(relativePath)
    }
  }
  return { ok: offenders.length === 0, offenders }
}

export function assertSyncAffiliationsPrimaryPath() {
  const checks = [
    {
      id: "stripe-processor",
      path: "lib/donations/stripe/processor-payment.ts",
      pattern: /syncDonationAffiliationFromWebhook/,
    },
    {
      id: "stripe-subscription",
      path: "lib/donations/stripe/processor-subscription.ts",
      pattern: /syncDonationAffiliationFromWebhook|maybeSyncDonationAffiliationFromWebhook/,
    },
    {
      id: "ticket-orders",
      path: "lib/tickets/ticket-order-actions.ts",
      pattern: /syncContactAffiliations/,
    },
    {
      id: "program-enrollment",
      path: "lib/programs/program-enrollment-actions.ts",
      pattern: /syncContactAffiliations/,
    },
    {
      id: "volunteer-actions",
      path: "lib/volunteers/volunteer-actions.ts",
      pattern: /syncContactAffiliations/,
    },
  ]

  const failures = []
  for (const check of checks) {
    const source = readProjectSource(check.path)
    if (!check.pattern.test(source)) {
      failures.push(check.id)
    }
  }

  return { ok: failures.length === 0, failures }
}

export function parseSuiteSummary(stdout) {
  const match = stdout.match(/(\d+)\/(\d+) checks passed/)
  if (!match) return null
  return {
    passed: Number(match[1]),
    total: Number(match[2]),
  }
}
