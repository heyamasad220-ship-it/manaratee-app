/**
 * Contacts Phase 1 unified validation runner (S-12).
 * Usage: node scripts/validate-contacts-phase1.mjs [--write-report]
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import {
  loadEnvLocal,
  createServiceRoleClient,
  createCheckRecorder,
  PHASE1_SUITES,
  PHASE1_PARTICIPATION_ROLES,
  assertParticipationRolesSchema,
  assertStickyRoleInRules,
  assertMemberAutoRemovable,
  assertPhase1PathsAvoidProfileRefresh,
  assertSyncAffiliationsPrimaryPath,
  parseSuiteSummary,
  getScriptsDir,
  getProjectRoot,
} from "./lib/contacts-phase1-validation.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const writeReport = process.argv.includes("--write-report")

loadEnvLocal()

const startedAt = new Date().toISOString()
const suiteResults = []
const { checks: policyChecks, record: recordPolicy } = createCheckRecorder("policy")

function runNodeScript(scriptName) {
  const scriptPath = resolve(getScriptsDir(), scriptName)
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: getProjectRoot(),
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  const stdout = result.stdout || ""
  const stderr = result.stderr || ""
  const summary = parseSuiteSummary(stdout)

  return {
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    summary,
    pass: result.status === 0,
  }
}

console.log("=== Contacts Phase 1 Validation (S-12) ===\n")

let sb
try {
  sb = createServiceRoleClient()
} catch (error) {
  console.error(error.message)
  process.exit(2)
}

const schemaCheck = await assertParticipationRolesSchema(sb)
recordPolicy(
  "schema-participation-roles",
  schemaCheck.ok,
  schemaCheck.message || "program_participant + event_attendee allowed"
)

for (const role of PHASE1_PARTICIPATION_ROLES) {
  recordPolicy(`sticky-role-${role}`, assertStickyRoleInRules(role), `${role} in STICKY_DERIVED_ROLES`)
}

recordPolicy("member-auto-removable", assertMemberAutoRemovable(), "member in AUTO_REMOVABLE_DERIVED_ROLES")

const refreshCheck = assertPhase1PathsAvoidProfileRefresh()
recordPolicy(
  "phase1-no-profile-refresh-dependency",
  refreshCheck.ok,
  refreshCheck.ok
    ? "write paths do not call refreshContactAffiliations"
    : `offenders: ${refreshCheck.offenders.join(", ")}`
)

const syncPathCheck = assertSyncAffiliationsPrimaryPath()
recordPolicy(
  "sync-contact-affiliations-primary-path",
  syncPathCheck.ok,
  syncPathCheck.ok
    ? "module write paths wired to sync engine"
    : `missing: ${syncPathCheck.failures.join(", ")}`
)

console.log("\n--- Module suites ---\n")

for (const suite of PHASE1_SUITES) {
  process.stdout.write(`[SUITE] ${suite.label} ... `)
  const result = runNodeScript(suite.script)
  const statusLabel = result.pass ? "PASS" : "FAIL"
  const countLabel = result.summary
    ? `${result.summary.passed}/${result.summary.total}`
    : "n/a"
  console.log(`${statusLabel} (${countLabel})`)

  if (!result.pass && result.stderr.trim()) {
    console.error(result.stderr.trim().split("\n").slice(-5).join("\n"))
  }

  suiteResults.push({
    id: suite.id,
    label: suite.label,
    module: suite.module,
    npmScript: suite.npmScript,
    pass: result.pass,
    exitCode: result.exitCode,
    checks: result.summary,
  })
}

console.log("\n--- Cross-module suite ---\n")
process.stdout.write("[SUITE] Cross-module role accumulation ... ")
const crossModuleResult = runNodeScript("validate-contacts-phase1-cross-module.mjs")
const crossStatus = crossModuleResult.pass ? "PASS" : "FAIL"
const crossCount = crossModuleResult.summary
  ? `${crossModuleResult.summary.passed}/${crossModuleResult.summary.total}`
  : "n/a"
console.log(`${crossStatus} (${crossCount})`)

suiteResults.push({
  id: "cross-module",
  label: "Cross-module role accumulation",
  module: "cross-module",
  npmScript: "validate:contacts-phase1 (cross-module)",
  pass: crossModuleResult.pass,
  exitCode: crossModuleResult.exitCode,
  checks: crossModuleResult.summary,
})

const policyFailed = policyChecks.filter((check) => !check.pass)
const suitesFailed = suiteResults.filter((suite) => !suite.pass)
const totalSuiteChecks = suiteResults.reduce(
  (sum, suite) => sum + (suite.checks?.passed ?? 0),
  0
)
const totalSuiteCheckCount = suiteResults.reduce(
  (sum, suite) => sum + (suite.checks?.total ?? 0),
  0
)

const validationMatrix = {
  donations: {
    "one-time donation": {
      suite: "stripe-one-time",
      covered: suiteResults.find((s) => s.id === "stripe-one-time")?.pass ?? false,
    },
    "recurring donation": {
      suite: "stripe-recurring",
      covered: suiteResults.find((s) => s.id === "stripe-recurring")?.pass ?? false,
    },
    "pledge creation": {
      suite: "portal-pledge",
      covered: suiteResults.find((s) => s.id === "portal-pledge")?.pass ?? false,
    },
    "pledge payment": {
      suite: "portal-pledge",
      covered: suiteResults.find((s) => s.id === "portal-pledge")?.pass ?? false,
    },
  },
  ticketing: {
    "completed order": {
      suite: "ticketing-completion",
      covered: suiteResults.find((s) => s.id === "ticketing-completion")?.pass ?? false,
    },
    "pending to completed transition": {
      suite: "ticketing-completion",
      covered: suiteResults.find((s) => s.id === "ticketing-completion")?.pass ?? false,
    },
    "duplicate purchaser reuse": {
      suite: "ticketing-completion",
      covered: suiteResults.find((s) => s.id === "ticketing-completion")?.pass ?? false,
    },
  },
  programs: {
    enrollment: {
      suite: "program-participant",
      covered: suiteResults.find((s) => s.id === "program-participant")?.pass ?? false,
    },
    "participant contact creation": {
      suite: "program-participant",
      covered: suiteResults.find((s) => s.id === "program-participant")?.pass ?? false,
    },
    "participant contact reuse": {
      suite: "program-participant",
      covered: suiteResults.find((s) => s.id === "program-participant")?.pass ?? false,
    },
  },
  volunteers: {
    "volunteer creation": {
      suite: "volunteer-identity",
      covered: suiteResults.find((s) => s.id === "volunteer-identity")?.pass ?? false,
    },
    "volunteer contact reuse": {
      suite: "volunteer-identity",
      covered: suiteResults.find((s) => s.id === "volunteer-identity")?.pass ?? false,
    },
  },
  crossModule: {
    "donor to volunteer": {
      suite: "cross-module",
      covered: crossModuleResult.pass,
    },
    "donor to program participant": {
      suite: "cross-module",
      covered: crossModuleResult.pass,
    },
    "donor to event attendee": {
      suite: "cross-module",
      covered: crossModuleResult.pass,
    },
    "volunteer to event attendee": {
      suite: "cross-module",
      covered: crossModuleResult.pass,
    },
    "all roles accumulate on one contact": {
      suite: "cross-module",
      covered: crossModuleResult.pass,
    },
  },
  policy: {
    "sticky role behavior": {
      suite: "policy",
      covered: policyFailed.length === 0,
    },
    "member behavior unchanged": {
      suite: "policy + volunteer-identity + cross-module",
      covered:
        policyChecks.find((c) => c.id === "policy:member-auto-removable")?.pass &&
        (suiteResults.find((s) => s.id === "volunteer-identity")?.pass ?? false),
    },
    "duplicate prevention": {
      suite: "all module suites + cross-module",
      covered: suitesFailed.length === 0,
    },
    "contact reuse": {
      suite: "ticketing + program + volunteer",
      covered:
        (suiteResults.find((s) => s.id === "ticketing-completion")?.pass ?? false) &&
        (suiteResults.find((s) => s.id === "program-participant")?.pass ?? false) &&
        (suiteResults.find((s) => s.id === "volunteer-identity")?.pass ?? false),
    },
    "syncContactAffiliations primary path": {
      suite: "policy",
      covered: policyChecks.find((c) => c.id === "policy:sync-contact-affiliations-primary-path")
        ?.pass,
    },
    "no profile refresh dependency": {
      suite: "policy",
      covered: policyChecks.find((c) => c.id === "policy:phase1-no-profile-refresh-dependency")
        ?.pass,
    },
  },
}

const overlaps = [
  {
    topic: "Participation roles schema (migration 101)",
    suites: ["ticketing-completion", "program-participant", "policy (consolidated)"],
    resolution: "Consolidated once in policy suite; module suites retain gate for standalone runs",
  },
  {
    topic: "Sticky role static checks",
    suites: ["ticketing-completion", "program-participant", "volunteer-identity", "policy"],
    resolution: "Consolidated in policy suite; module suites keep role-specific sticky assertion",
  },
  {
    topic: "Donor role idempotency",
    suites: ["stripe-one-time", "stripe-recurring", "portal-pledge"],
    resolution: "Kept per payment channel — different triggers and wiring",
  },
  {
    topic: "loadEnvLocal + service-role client bootstrap",
    suites: ["all six module scripts"],
    resolution: "Extracted to scripts/lib/contacts-phase1-validation.mjs (incremental adoption)",
  },
]

const coverageGaps = [
  "Venue rental customer derivation (schema slot only — no activity linkage yet)",
  "Staff manual enrollment paths outside register_for_program / promote_waitlist",
  "Volunteer application approval → automatic volunteer roster (approval UX unchanged)",
  "Historical backfill of participant_contact_id or ticket order contact_id",
  "End-to-end browser/UI flows (validation is API/DB + static wiring)",
]

const readinessScores = computeReadinessScores({
  policyChecks,
  suiteResults,
  crossModulePass: crossModuleResult.pass,
})

function computeReadinessScores(input) {
  const suitesPass = input.suiteResults.every((suite) => suite.pass)
  const policyPass = input.policyChecks.every((check) => check.pass)
  const donationsPass = input.suiteResults
    .filter((suite) => suite.module === "donations")
    .every((suite) => suite.pass)
  const crossPass = input.crossModulePass

  return {
    identityIntegrity: score(suitesPass && policyPass && crossPass, [
      "Canonical contact linkage validated per module",
      "Participant and purchaser contact reuse covered",
      "Cross-module single-contact accumulation passes",
    ]),
    roleIntelligence: score(policyPass && crossPass, [
      "All four participation roles derive and stick",
      "syncContactAffiliations confirmed as primary write-path engine",
      "Member remains auto-removable (unchanged)",
    ]),
    crossModuleParticipation: score(crossPass, [
      "Donor + volunteer + program_participant + event_attendee on one contact",
      "Role accumulation and idempotent sync verified",
    ]),
    crmReadiness: score(suitesPass && policyPass, [
      "Phase 1 write paths avoid profile-refresh dependency",
      "Module validations repeatable with cleanup",
      "Gaps remain: merge UI, historical backfill, venue rental",
    ]),
    productionReadiness: score(suitesPass && policyPass && donationsPass, [
      "Stripe + portal donation paths validated",
      "Ticketing/programs/volunteers affiliation sync validated",
      "Not a full production soak — no load/security/UI E2E in this suite",
    ]),
  }
}

function score(pass, notes) {
  return {
    score: pass ? 92 : 68,
    label: pass ? "High" : "Moderate",
    notes,
  }
}

const report = {
  generatedAt: startedAt,
  overallPass: policyFailed.length === 0 && suitesFailed.length === 0,
  summary: {
    policyChecks: {
      passed: policyChecks.length - policyFailed.length,
      total: policyChecks.length,
    },
    moduleSuites: {
      passed: suiteResults.filter((s) => s.pass).length,
      total: suiteResults.length,
      checkPassed: totalSuiteChecks,
      checkTotal: totalSuiteCheckCount,
    },
  },
  suites: suiteResults,
  policyChecks,
  validationMatrix,
  overlaps,
  coverageGaps,
  readinessScores,
}

console.log("\n--- Validation matrix ---\n")
for (const [section, rows] of Object.entries(validationMatrix)) {
  console.log(`[${section}]`)
  for (const [scenario, meta] of Object.entries(rows)) {
    console.log(`  ${meta.covered ? "✓" : "✗"} ${scenario} (${meta.suite})`)
  }
  console.log("")
}

console.log("--- Readiness scores ---\n")
for (const [dimension, value] of Object.entries(readinessScores)) {
  console.log(`${dimension}: ${value.score}/100 (${value.label})`)
}

console.log("\n--- Overlapping tests (documented) ---\n")
for (const overlap of overlaps) {
  console.log(`* ${overlap.topic}`)
  console.log(`  Suites: ${overlap.suites.join(", ")}`)
  console.log(`  Resolution: ${overlap.resolution}\n`)
}

if (writeReport) {
  const reportDir = resolve(getScriptsDir(), "reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(reportDir, "contacts-phase1-validation.json")
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  console.log(`Report written: ${reportPath}`)
}

const overallPass = report.overallPass
const policyPassed = policyChecks.length - policyFailed.length
const suitesPassed = suiteResults.filter((s) => s.pass).length

console.log(
  `\nContacts Phase 1: ${overallPass ? "PASS" : "FAIL"} — policy ${policyPassed}/${policyChecks.length}, suites ${suitesPassed}/${suiteResults.length}, checks ${totalSuiteChecks}/${totalSuiteCheckCount}`
)

if (!overallPass) {
  process.exit(1)
}
