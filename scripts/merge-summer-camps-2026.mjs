/**
 * Merge Summer Camp One + Two into a single Summer Camp offering (8 weeks).
 *
 * - Keeps Camp One as the survivor, renames to "Summer Camp"
 * - Dates: 2026-06-01 → 2026-07-23
 * - Moves Camp Two weeks → Week 5–8 on survivor
 * - Remaps enrollments / session access / charges; merges dual-camp kids
 * - Configures week-count tuition tiers + $0 registration + 5% sibling (tuition only)
 *
 * Usage:
 *   node scripts/merge-summer-camps-2026.mjs
 *   node scripts/merge-summer-camps-2026.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 * Run SQL scripts/190_session_count_tuition_tiers.sql before relying on new quotes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const YEAR_PROGRAM_NAME = "Summer Camps 2026"
const CAMP1_NAME = "Summer Camp One"
const CAMP2_NAME = "Summer Camp Two"
const CAMP1_ALIASES = [
  "Summer Camp One",
  "Summer Camp One (June)",
  "2026 MAS Summer Camp One (June)",
]
const CAMP2_ALIASES = [
  "Summer Camp Two",
  "Summer Camp Two (6/29 - 7/23)",
  "2026 MAS Summer Camp Two (6/29 - 7/23)",
]
const MERGED_NAME = "Summer Camp"
const MERGED_START = "2026-06-01"
const MERGED_END = "2026-07-23"

const SESSION_COUNT_TIERS = {
  1: 135,
  2: 270,
  3: 360,
  4: 450,
  5: 585,
  6: 720,
  7: 810,
  8: 900,
}

const SIBLING_EXCLUDE_TYPES = [
  "registration_fee",
  "materials",
  "lunch",
  "extended_care",
  "custom",
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

function parseArgs(argv) {
  const args = { execute: false, orgId: DEFAULT_ORG_ID }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function fail(message) {
  throw new Error(message)
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) fail(`${label}: ${error.message}`)
  return data
}

function sortSessions(sessions) {
  return [...sessions].sort((a, b) => {
    const aDate = a.start_date || a.name || ""
    const bDate = b.start_date || b.name || ""
    return String(aDate).localeCompare(String(bDate))
  })
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const report = {
    mode: args.execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    orgId: args.orgId,
    actions: [],
    warnings: [],
    counts: {},
  }

  const program = (
    await must(
      "load program",
      sb
        .from("programs")
        .select("id, name, start_date, end_date, organization_id")
        .eq("organization_id", args.orgId)
        .eq("name", YEAR_PROGRAM_NAME)
        .maybeSingle()
    )
  )
  if (!program) fail(`Program not found: ${YEAR_PROGRAM_NAME}`)

  const offerings = await must(
    "load offerings",
    sb
      .from("program_offerings")
      .select("*")
      .eq("organization_id", args.orgId)
      .eq("program_id", program.id)
  )

  const camp1 = offerings.find((o) => CAMP1_ALIASES.includes(o.name))
  const camp2 = offerings.find((o) => CAMP2_ALIASES.includes(o.name))
  const alreadyMerged = offerings.find(
    (o) => o.name === MERGED_NAME && o.status !== "archived"
  )

  if (alreadyMerged && !camp2) {
    report.actions.push("Already merged — only Summer Camp present. Will refresh pricing.")
  }

  const survivor = alreadyMerged || camp1
  if (!survivor) fail(`Neither "${CAMP1_NAME}" nor "${MERGED_NAME}" found`)
  if (!camp2 && !alreadyMerged) {
    report.warnings.push(`${CAMP2_NAME} not found — pricing refresh only on survivor`)
  }

  const survivorSessions = sortSessions(
    await must(
      "load survivor sessions",
      sb
        .from("program_sessions")
        .select("*")
        .eq("organization_id", args.orgId)
        .eq("offering_id", survivor.id)
    )
  )

  const camp2Sessions = camp2
    ? sortSessions(
        await must(
          "load camp2 sessions",
          sb
            .from("program_sessions")
            .select("*")
            .eq("organization_id", args.orgId)
            .eq("offering_id", camp2.id)
        )
      )
    : []

  report.counts.survivorSessionsBefore = survivorSessions.length
  report.counts.camp2Sessions = camp2Sessions.length

  const camp2Enrollments = camp2
    ? await must(
        "load camp2 enrollments",
        sb
          .from("program_enrollments")
          .select(
            "id, participant_contact_id, registrant_contact_id, status, registration_option_id, offering_id"
          )
          .eq("organization_id", args.orgId)
          .eq("offering_id", camp2.id)
      )
    : []

  const survivorEnrollments = await must(
    "load survivor enrollments",
    sb
      .from("program_enrollments")
      .select(
        "id, participant_contact_id, registrant_contact_id, status, registration_option_id, offering_id"
      )
      .eq("organization_id", args.orgId)
      .eq("offering_id", survivor.id)
  )

  const survivorByParticipant = new Map(
    survivorEnrollments.map((e) => [e.participant_contact_id, e])
  )

  let dualKids = 0
  let moveEnrollments = 0
  for (const enrollment of camp2Enrollments) {
    if (survivorByParticipant.has(enrollment.participant_contact_id)) {
      dualKids += 1
    } else {
      moveEnrollments += 1
    }
  }
  report.counts.camp2Enrollments = camp2Enrollments.length
  report.counts.dualCampParticipants = dualKids
  report.counts.enrollmentsToRetarget = moveEnrollments

  report.actions.push(
    `Rename survivor → "${MERGED_NAME}", dates ${MERGED_START}..${MERGED_END}`
  )
  report.actions.push(
    `Rename survivor sessions to Week 1–${survivorSessions.length}; move camp2 sessions to Week ${survivorSessions.length + 1}–${survivorSessions.length + camp2Sessions.length}`
  )
  report.actions.push(
    `Configure fee plan: tiers ${JSON.stringify(SESSION_COUNT_TIERS)}, registration $0, sibling 5% tuition-only`
  )
  if (camp2) {
    report.actions.push(`Archive offering "${CAMP2_NAME}" after remapping`)
  }

  if (!args.execute) {
    writeReport(report)
    console.log(JSON.stringify(report, null, 2))
    console.log("\nDry-run only. Re-run with --execute to apply.")
    return
  }

  // 1) Update survivor offering + year dates
  await must(
    "update survivor offering",
    sb
      .from("program_offerings")
      .update({
        name: MERGED_NAME,
        start_date: MERGED_START,
        end_date: MERGED_END,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", survivor.id)
  )

  await must(
    "update year program dates",
    sb
      .from("programs")
      .update({
        start_date: MERGED_START,
        end_date: MERGED_END,
        updated_at: new Date().toISOString(),
      })
      .eq("id", program.id)
  )

  // 2) Rename survivor weeks 1..N
  for (let i = 0; i < survivorSessions.length; i += 1) {
    const session = survivorSessions[i]
    const name = `Week ${i + 1}`
    if (session.name !== name) {
      await must(
        `rename session ${session.id}`,
        sb
          .from("program_sessions")
          .update({ name, updated_at: new Date().toISOString() })
          .eq("id", session.id)
      )
    }
  }

  // 3) Move camp2 sessions → survivor as Week N+1..
  const weekOffset = survivorSessions.length
  for (let i = 0; i < camp2Sessions.length; i += 1) {
    const session = camp2Sessions[i]
    await must(
      `move session ${session.id}`,
      sb
        .from("program_sessions")
        .update({
          offering_id: survivor.id,
          name: `Week ${weekOffset + i + 1}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
    )
  }

  // 4) Registration options on survivor
  const survivorOptions = await must(
    "load survivor options",
    sb
      .from("program_registration_options")
      .select("*")
      .eq("organization_id", args.orgId)
      .eq("offering_id", survivor.id)
  )

  async function ensureOption(optionType, label) {
    const existing = survivorOptions.find((o) => o.option_type === optionType)
    if (existing) {
      if (!existing.is_active) {
        await must(
          `activate option ${optionType}`,
          sb
            .from("program_registration_options")
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        )
      }
      return existing
    }
    const inserted = await must(
      `insert option ${optionType}`,
      sb
        .from("program_registration_options")
        .insert({
          organization_id: args.orgId,
          program_id: program.id,
          offering_id: survivor.id,
          option_type: optionType,
          label,
          is_active: true,
          sort_order: optionType === "full_program" ? 10 : 20,
        })
        .select("*")
        .single()
    )
    survivorOptions.push(inserted)
    return inserted
  }

  const fullOption = await ensureOption("full_program", "Entire Program")
  const selectedOption = await ensureOption(
    "selected_sessions",
    "Selected Sessions"
  )

  const camp2Options = camp2
    ? await must(
        "load camp2 options",
        sb
          .from("program_registration_options")
          .select("id, option_type")
          .eq("offering_id", camp2.id)
      )
    : []
  const camp2OptionMap = new Map(
    camp2Options.map((o) => [
      o.id,
      o.option_type === "full_program" ? fullOption.id : selectedOption.id,
    ])
  )

  // 5) Remap camp2 enrollments
  for (const enrollment of camp2Enrollments) {
    const existing = survivorByParticipant.get(enrollment.participant_contact_id)
    const mappedOptionId =
      camp2OptionMap.get(enrollment.registration_option_id) || selectedOption.id

    if (existing) {
      // Move session access from camp2 enrollment → survivor enrollment
      const accessRows = await must(
        `session access ${enrollment.id}`,
        sb
          .from("program_registration_session_access")
          .select("id, session_id, access_status")
          .eq("enrollment_id", enrollment.id)
      )

      const sessionIds = accessRows.map((row) => row.session_id).filter(Boolean)
      if (sessionIds.length > 0) {
        const { error } = await sb.rpc("grant_enrollment_session_access", {
          p_organization_id: args.orgId,
          p_enrollment_id: existing.id,
          p_session_ids: sessionIds,
        })
        if (error) {
          report.warnings.push(
            `session access merge ${enrollment.id}→${existing.id}: ${error.message}`
          )
        }
      }

      // Keep historical registration charges on the camp2 enrollment (unique per
      // enrollment). Only retarget offering_id for reporting continuity.
      await must(
        `repoint charges offering ${enrollment.id}`,
        sb
          .from("program_charges")
          .update({
            offering_id: survivor.id,
            updated_at: new Date().toISOString(),
          })
          .eq("enrollment_id", enrollment.id)
      )

      if (enrollment.status !== "cancelled") {
        await must(
          `cancel duplicate enrollment ${enrollment.id}`,
          sb
            .from("program_enrollments")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", enrollment.id)
        )
      }
    } else {
      await must(
        `retarget enrollment ${enrollment.id}`,
        sb
          .from("program_enrollments")
          .update({
            offering_id: survivor.id,
            registration_option_id: mappedOptionId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrollment.id)
      )

      await must(
        `repoint charges for moved enrollment ${enrollment.id}`,
        sb
          .from("program_charges")
          .update({
            offering_id: survivor.id,
            updated_at: new Date().toISOString(),
          })
          .eq("enrollment_id", enrollment.id)
      )

      survivorByParticipant.set(enrollment.participant_contact_id, {
        ...enrollment,
        offering_id: survivor.id,
        registration_option_id: mappedOptionId,
      })
    }
  }

  // 6) Repoint other camp2 children (waitlist, staff, schedule, capacity, apps)
  if (camp2) {
    const tables = [
      ["program_waitlist", "offering_id"],
      ["program_staff_assignments", "offering_id"],
      ["program_schedule_items", "offering_id"],
      ["program_capacity_groups", "offering_id"],
      ["program_charges", "offering_id"],
    ]
    for (const [table, column] of tables) {
      const { error } = await sb
        .from(table)
        .update({ [column]: survivor.id })
        .eq(column, camp2.id)
        .eq("organization_id", args.orgId)
      if (error) {
        report.warnings.push(`${table} remount: ${error.message}`)
      }
    }

    // Drop duplicate capacity groups that violate uniqueness after move — keep survivor’s
    const groups = await must(
      "capacity groups after move",
      sb
        .from("program_capacity_groups")
        .select("id, name, offering_id, created_at")
        .eq("offering_id", survivor.id)
        .eq("organization_id", args.orgId)
        .order("created_at", { ascending: true })
    )
    const seenNames = new Set()
    for (const group of groups) {
      const key = String(group.name || group.id).toLowerCase()
      if (seenNames.has(key)) {
        await must(
          `delete duplicate capacity group ${group.id}`,
          sb.from("program_capacity_groups").delete().eq("id", group.id)
        )
      } else {
        seenNames.add(key)
      }
    }

    // Archive camp2 options + offering
    await must(
      "deactivate camp2 options",
      sb
        .from("program_registration_options")
        .update({ is_active: false })
        .eq("offering_id", camp2.id)
    )
    await must(
      "archive camp2",
      sb
        .from("program_offerings")
        .update({
          status: "archived",
          name: `${CAMP2_NAME} (merged)`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", camp2.id)
    )
  }

  // 7) Fee plan + components + sibling rule
  let feePlans = await must(
    "load fee plans",
    sb
      .from("program_offering_fee_plans")
      .select("*")
      .eq("offering_id", survivor.id)
      .eq("organization_id", args.orgId)
  )

  let defaultPlan =
    feePlans.find((p) => p.is_default && p.is_active) || feePlans[0] || null

  const planMetadata = {
    session_count_tiers: SESSION_COUNT_TIERS,
    pricing_notes:
      "Summer Camp week packages: count of selected weeks → tuition. Full program = all active weeks.",
  }

  if (!defaultPlan) {
    defaultPlan = await must(
      "create fee plan",
      sb
        .from("program_offering_fee_plans")
        .insert({
          organization_id: args.orgId,
          program_id: program.id,
          offering_id: survivor.id,
          name: "Summer Camp tuition",
          plan_type: "one_time",
          currency: "USD",
          is_default: true,
          is_active: true,
          deposit_amount: 0,
          metadata: planMetadata,
        })
        .select("*")
        .single()
    )
    feePlans = [defaultPlan]
  } else {
    await must(
      "update fee plan metadata",
      sb
        .from("program_offering_fee_plans")
        .update({
          name: "Summer Camp tuition",
          plan_type: "one_time",
          is_default: true,
          is_active: true,
          metadata: planMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", defaultPlan.id)
    )
  }

  // Link both options to this plan
  for (const option of [fullOption, selectedOption]) {
    await must(
      `link option ${option.option_type}`,
      sb
        .from("program_registration_options")
        .update({
          fee_plan_id: defaultPlan.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", option.id)
    )
  }

  const components = await must(
    "load components",
    sb
      .from("program_offering_fee_plan_components")
      .select("*")
      .eq("fee_plan_id", defaultPlan.id)
  )

  async function upsertComponent(spec) {
    const existing = components.find(
      (c) =>
        c.component_type === spec.component_type &&
        (spec.addon_key == null || c.addon_key === spec.addon_key)
    )
    if (existing) {
      await must(
        `update component ${spec.component_type}`,
        sb
          .from("program_offering_fee_plan_components")
          .update({
            ...spec,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      )
      return
    }
    await must(
      `insert component ${spec.component_type}`,
      sb.from("program_offering_fee_plan_components").insert({
        organization_id: args.orgId,
        fee_plan_id: defaultPlan.id,
        ...spec,
        is_active: true,
      })
    )
  }

  await upsertComponent({
    component_type: "tuition",
    label: "Tuition",
    amount: 900,
    pricing_model: "flat",
    quantity_mode: "fixed",
    quantity_value: 1,
    addon_key: null,
    session_price_source: "component",
    applies_to_option_types: null,
    sort_order: 10,
  })

  await upsertComponent({
    component_type: "registration_fee",
    label: "Registration Fee",
    amount: 0,
    pricing_model: "flat",
    quantity_mode: "fixed",
    quantity_value: 1,
    addon_key: null,
    session_price_source: "component",
    applies_to_option_types: null,
    sort_order: 5,
  })

  // Sibling 5% tuition only
  const siblingRules = await must(
    "load sibling rules",
    sb
      .from("program_offering_discount_rules")
      .select("*")
      .eq("offering_id", survivor.id)
      .eq("rule_type", "sibling")
  )

  if (siblingRules.length === 0) {
    await must(
      "insert sibling rule",
      sb.from("program_offering_discount_rules").insert({
        organization_id: args.orgId,
        offering_id: survivor.id,
        fee_plan_id: defaultPlan.id,
        rule_type: "sibling",
        label: "Sibling discount (5%)",
        discount_type: "percent",
        amount: 5,
        conditions: { exclude_component_types: SIBLING_EXCLUDE_TYPES },
        is_active: true,
        priority_rank: 10,
      })
    )
  } else {
    await must(
      "update sibling rule",
      sb
        .from("program_offering_discount_rules")
        .update({
          fee_plan_id: defaultPlan.id,
          label: "Sibling discount (5%)",
          discount_type: "percent",
          amount: 5,
          conditions: { exclude_component_types: SIBLING_EXCLUDE_TYPES },
          is_active: true,
          priority_rank: 10,
        })
        .eq("id", siblingRules[0].id)
    )
  }

  const finalSessions = sortSessions(
    await must(
      "final sessions",
      sb
        .from("program_sessions")
        .select("id, name, start_date, end_date, offering_id")
        .eq("offering_id", survivor.id)
        .order("start_date", { ascending: true })
    )
  )

  report.survivorOfferingId = survivor.id
  report.feePlanId = defaultPlan.id
  report.finalSessions = finalSessions.map((s) => ({
    name: s.name,
    start: s.start_date,
    end: s.end_date,
  }))
  report.counts.finalSessionCount = finalSessions.length
  report.sqlRequired = "scripts/190_session_count_tuition_tiers.sql"

  writeReport(report)
  console.log(JSON.stringify(report, null, 2))
  console.log("\nMerge complete. Run SQL 190 if not already applied, then verify the offering page.")
}

function writeReport(report) {
  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const path = resolve(dir, `summer-camps-2026-merge-${stamp}.json`)
  writeFileSync(path, JSON.stringify(report, null, 2))
  console.log(`Report written: ${path}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
