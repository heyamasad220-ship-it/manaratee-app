/**
 * Contacts Security validation harness (CR-8).
 * Usage:
 *   node scripts/validate-contacts-security.mjs
 *   node scripts/validate-contacts-security.mjs --write-report
 *   node scripts/validate-contacts-security.mjs --post-m4
 *   node scripts/validate-contacts-security.mjs --with-phase1
 *
 * Requires migrations 102–110 applied (111 for --post-m4 open-policy checks).
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import {
  CONTACTS_TABLES,
  OPEN_POLICY_NAMES,
  REQUIRED_HELPERS,
  REQUIRED_RPCS,
  M4_MIGRATION,
  loadEnvLocal,
  createServiceRoleClient,
  createCheckRecorder,
  getProjectRoot,
  getScriptsDir,
  checkStaticAppFiles,
  checkMigrationFiles,
  checkGateAlignmentSql,
  checkExpectedPoliciesFromMigrations,
  fetchLivePolicies,
  parseSuiteSummary,
} from "./lib/contacts-security-validation.mjs"

const writeReport = process.argv.includes("--write-report")
const postM4 = process.argv.includes("--post-m4")
const withPhase1 = process.argv.includes("--with-phase1")
const ZERO = "00000000-0000-0000-0000-000000000000"

loadEnvLocal()

const root = getProjectRoot()
const startedAt = new Date().toISOString()
const suites = []

function summarize(checks) {
  const passed = checks.filter((c) => c.pass).length
  return { passed, total: checks.length, checks }
}

console.log("=== Contacts Security Validation (CR-8) ===\n")
if (postM4) console.log("Mode: post-M4 (open policies must be absent)\n")
else console.log("Mode: pre-M4 (additive policies; open policies may still exist)\n")

const { checks: repoChecks, record: recordRepo } = createCheckRecorder("repo")
checkMigrationFiles(recordRepo)
recordRepo("m4-migration-file", existsSync(resolve(getScriptsDir(), M4_MIGRATION)), "111 script")
checkGateAlignmentSql(recordRepo)
checkExpectedPoliciesFromMigrations(recordRepo)
checkStaticAppFiles(root, recordRepo)
suites.push({ id: "repo", label: "Repository / static", ...summarize(repoChecks) })

let service = null
let dbError = null
try {
  service = createServiceRoleClient()
} catch (error) {
  dbError = error.message
}

const { checks: dbChecks, record: recordDb } = createCheckRecorder("database")

if (!service) {
  recordDb("credentials", false, dbError || "no service client")
} else {
  recordDb("credentials", true, "service role connected")

  for (const helper of REQUIRED_HELPERS) {
    const args =
      helper === "auth_user_has_contact_permission"
        ? { p_org_id: ZERO, p_permission_key: "contacts.view" }
        : helper === "auth_user_may_ensure_contact_for_person"
          ? { p_org_id: ZERO, p_person_id: ZERO }
          : helper === "auth_user_may_sync_derived_affiliations" ||
              helper === "auth_user_can_view_family_contact"
            ? { p_org_id: ZERO, p_contact_id: ZERO }
            : helper === "auth_user_may_create_contact_via_module" ||
                helper === "auth_user_can_view_contacts" ||
                helper === "auth_user_can_manage_contacts"
              ? { p_org_id: ZERO }
              : { p_org_id: ZERO }

    const { error } = await service.rpc(helper, args)
    if (error?.code === "PGRST202" || error?.message?.includes("Could not find the function")) {
      recordDb(`helper-${helper}`, false, "function not found — run 102–110")
    } else {
      recordDb(`helper-${helper}`, true, "callable")
    }
  }

  for (const rpc of REQUIRED_RPCS) {
    const args =
      rpc === "find_or_create_contact_for_org"
        ? { p_organization_id: ZERO, p_full_name: "CR8 Probe" }
        : rpc === "ensure_contact_for_person"
          ? { p_organization_id: ZERO, p_person_id: ZERO }
          : { p_organization_id: ZERO, p_contact_id: ZERO }

    const { error } = await service.rpc(rpc, args)
    if (error?.code === "PGRST202" || error?.message?.includes("Could not find the function")) {
      recordDb(`rpc-${rpc}`, false, "function not found — run 108")
    } else {
      recordDb(`rpc-${rpc}`, true, "callable")
    }
  }

  const { policies, error: policyError } = await fetchLivePolicies(service, CONTACTS_TABLES)
  if (policyError) {
    recordDb(
      "live-policies",
      true,
      `skipped (${policyError}) — verify policies via SQL editor or --post-m4 after 111`
    )
  } else {
    recordDb("live-policies", true, `${policies.length} policies loaded`)

    const policyNames = new Set(policies.map((p) => p.policyname))
    const expectedFrom104 = [
      "Staff view org contacts",
      "Customers view own contacts",
      "Staff view org contact roles",
      "Staff view org contact notes",
    ]
    for (const name of expectedFrom104) {
      recordDb(`live-policy-${name}`, policyNames.has(name), policyNames.has(name) ? "present" : "missing — run 104–106")
    }

    for (const openName of OPEN_POLICY_NAMES) {
      const present = policyNames.has(openName)
      if (postM4) {
        recordDb(`open-policy-absent-${openName}`, !present, present ? "still present — M4 incomplete" : "dropped")
      } else {
        recordDb(`open-policy-status-${openName}`, true, present ? "present (expected pre-M4)" : "absent (M4 may be applied)")
      }
    }

    const permissiveOpen = policies.filter(
      (p) =>
        OPEN_POLICY_NAMES.includes(p.policyname) &&
        ((p.qual && p.qual.includes("true")) || (p.with_check && p.with_check.includes("true")))
    )
    if (postM4) {
      recordDb("no-permissive-open-policies", permissiveOpen.length === 0, `${permissiveOpen.length} permissive open policies`)
    }
  }
}

suites.push({ id: "database", label: "Database / live", ...summarize(dbChecks) })

if (withPhase1) {
  const { checks: phase1Checks, record: recordPhase1 } = createCheckRecorder("phase1")
  const result = spawnSync(process.execPath, [resolve(getScriptsDir(), "validate-contacts-phase1.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  })
  const summary = parseSuiteSummary(result.stdout || "")
  const pass = result.status === 0
  recordPhase1("runner-exit", pass, summary ? `${summary.passed}/${summary.total}` : `exit ${result.status}`)
  suites.push({ id: "phase1", label: "Phase 1 affiliation regression", ...summarize(phase1Checks) })
}

const allChecks = suites.flatMap((s) => s.checks)
const totalPassed = allChecks.filter((c) => c.pass).length
const totalChecks = allChecks.length
const allPass = totalPassed === totalChecks

console.log("\n=== Summary ===")
for (const suite of suites) {
  console.log(`${suite.label}: ${suite.passed}/${suite.total}`)
}
console.log(`\nOverall: ${totalPassed}/${totalChecks} checks passed`)

if (writeReport) {
  const reportDir = resolve(getScriptsDir(), "reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(reportDir, "contacts-security-validation.json")
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        mode: postM4 ? "post-m4" : "pre-m4",
        suites,
        totalPassed,
        totalChecks,
        pass: allPass,
      },
      null,
      2
    )
  )
  console.log(`\nReport: ${reportPath}`)
}

process.exit(allPass ? 0 : 1)
