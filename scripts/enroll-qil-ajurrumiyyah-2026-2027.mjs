/**
 * Enroll all approved Al-Ajurrumiyyah students (free course — no payment).
 *
 * Moves them from Registrations → Approved to Registrations → roster.
 *
 * Usage:
 *   node scripts/enroll-qil-ajurrumiyyah-2026-2027.mjs
 *   node scripts/enroll-qil-ajurrumiyyah-2026-2027.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2026_27_AJURRUMIYYAH_FREE_V1"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "78616758-d6fc-4a48-a99c-f8ea24a34646"
const DEPARTMENT_ID = "c5d6b286-0d48-431f-9b55-94a80d4821ef"
const OFFERING_ID = "844c123a-3301-4701-9de1-4d4e6f38a142"
const OFFERING_NAME = "Al-Ajurrumiyyah"
const ENROLLMENT_DATE = "2026-08-17"

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
  return { execute: argv.includes("--execute") }
}

async function upsertEnrollment(sb, app, execute) {
  const studentName =
    (app.contact_name && String(app.contact_name).trim()) ||
    app.participant_name
  const registrantId = app.registrant_contact_id || app.participant_contact_id
  const notes = `Imported ${IMPORT_TAG} — free course, no payment required`

  if (!execute) {
    return { action: "would-enroll", enrollmentId: null, studentName }
  }

  const { data: existingRows, error: existingError } = await sb
    .from("program_enrollments")
    .select("id, charge_id, status")
    .eq("organization_id", ORG_ID)
    .eq("offering_id", OFFERING_ID)
    .eq("participant_contact_id", app.participant_contact_id)
  if (existingError) throw new Error(`find enrollment ${studentName}: ${existingError.message}`)
  const existing =
    (existingRows || []).find((row) => row.status !== "cancelled") ||
    (existingRows || [])[0] ||
    null

  const payload = {
    organization_id: ORG_ID,
    program_id: PROGRAM_ID,
    offering_id: OFFERING_ID,
    department_id: DEPARTMENT_ID,
    child_name: studentName,
    participant_contact_id: app.participant_contact_id,
    registrant_contact_id: registrantId,
    payer_contact_id: registrantId,
    status: "enrolled",
    payment_status: "paid",
    total_amount: 0,
    amount_paid: 0,
    fee_total: 0,
    discount_total: 0,
    final_total: 0,
    enrollment_date: ENROLLMENT_DATE,
    participant_type: "adult",
    registrant_type:
      registrantId === app.participant_contact_id ? "adult_self" : "guardian",
    parent_name: app.registrant_name || studentName,
    parent_email: app.registrant_email || app.contact_email || null,
    parent_phone: app.registrant_phone || app.contact_phone || null,
    notes,
    payment_required: false,
    cancelled_at: null,
    cancel_reason: null,
  }

  let enrollmentId = existing?.id || null
  let chargeId = existing?.charge_id || null
  let action = existing ? "updated" : "created"

  if (!enrollmentId) {
    const { data, error } = await sb
      .from("program_enrollments")
      .insert(payload)
      .select("id")
      .single()
    if (error) throw new Error(`enrollment ${studentName}: ${error.message}`)
    enrollmentId = data.id
  } else {
    const { error } = await sb
      .from("program_enrollments")
      .update(payload)
      .eq("id", enrollmentId)
      .eq("organization_id", ORG_ID)
    if (error) throw new Error(`enrollment update ${studentName}: ${error.message}`)
  }

  const nowIso = new Date().toISOString()
  const chargePayload = {
    organization_id: ORG_ID,
    enrollment_id: enrollmentId,
    charge_type: "registration",
    source_type: "manual",
    payer_contact_id: registrantId,
    registrant_contact_id: registrantId,
    participant_contact_id: app.participant_contact_id,
    program_id: PROGRAM_ID,
    offering_id: OFFERING_ID,
    currency: "USD",
    subtotal: 0,
    discount_total: 0,
    total: 0,
    due_today: 0,
    amount_paid: 0,
    payment_required: false,
    charge_status: "paid",
    checkout_status: "paid",
    paid_at: nowIso,
    metadata: { import_tag: IMPORT_TAG, free_course: true },
    quote_snapshot: { import: IMPORT_TAG, offering: OFFERING_NAME, free: true },
  }

  if (!chargeId) {
    const { data, error } = await sb
      .from("program_charges")
      .insert(chargePayload)
      .select("id")
      .single()
    if (error) throw new Error(`charge ${studentName}: ${error.message}`)
    chargeId = data.id
    await sb
      .from("program_enrollments")
      .update({ charge_id: chargeId })
      .eq("id", enrollmentId)
      .eq("organization_id", ORG_ID)
  } else {
    const { error } = await sb
      .from("program_charges")
      .update(chargePayload)
      .eq("id", chargeId)
      .eq("organization_id", ORG_ID)
    if (error) throw new Error(`charge update ${studentName}: ${error.message}`)
  }

  await sb.from("program_charge_lines").delete().eq("organization_id", ORG_ID).eq("charge_id", chargeId)
  const { error: lineError } = await sb.from("program_charge_lines").insert({
    organization_id: ORG_ID,
    charge_id: chargeId,
    line_type: "tuition",
    label: `${OFFERING_NAME} (free)`,
    quantity: 1,
    unit_amount: 0,
    amount: 0,
    sort_order: 0,
    metadata: { import_tag: IMPORT_TAG },
  })
  if (lineError) throw new Error(`charge lines ${studentName}: ${lineError.message}`)

  const { error: appError } = await sb
    .from("program_applications")
    .update({
      status: "approved",
      enrollment_id: enrollmentId,
      approved_offering_id: OFFERING_ID,
    })
    .eq("id", app.id)
    .eq("organization_id", ORG_ID)
  if (appError) throw new Error(`application link ${studentName}: ${appError.message}`)

  try {
    await sb.rpc("sync_contact_affiliations", {
      p_organization_id: ORG_ID,
      p_contact_id: app.participant_contact_id,
    })
    if (registrantId && registrantId !== app.participant_contact_id) {
      await sb.rpc("sync_contact_affiliations", {
        p_organization_id: ORG_ID,
        p_contact_id: registrantId,
      })
    }
  } catch (error) {
    console.warn(
      `affiliation warn (${studentName}): ${error instanceof Error ? error.message : error}`
    )
  }

  return { action, enrollmentId, studentName }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: apps, error } = await sb
    .from("program_applications")
    .select(
      "id, status, enrollment_id, participant_name, participant_contact_id, registrant_contact_id, offering_id, approved_offering_id"
    )
    .eq("organization_id", ORG_ID)
    .eq("program_id", PROGRAM_ID)
    .eq("offering_id", OFFERING_ID)
    .eq("status", "approved")
    .is("enrollment_id", null)
    .order("participant_name")
  if (error) throw new Error(`load applications: ${error.message}`)

  const rows = apps || []
  const contactIds = [
    ...new Set(
      rows.flatMap((row) =>
        [row.participant_contact_id, row.registrant_contact_id].filter(Boolean)
      )
    ),
  ]
  const contactsById = new Map()
  if (contactIds.length) {
    const { data: contacts, error: contactError } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", ORG_ID)
      .in("id", contactIds)
    if (contactError) throw new Error(`load contacts: ${contactError.message}`)
    for (const contact of contacts || []) contactsById.set(contact.id, contact)
  }

  const planned = rows.map((row) => {
    const participant = contactsById.get(row.participant_contact_id) || {}
    const registrant = contactsById.get(row.registrant_contact_id) || participant
    return {
      ...row,
      contact_name: participant.full_name || null,
      contact_email: participant.email || null,
      contact_phone: participant.phone || null,
      registrant_name: registrant.full_name || null,
      registrant_email: registrant.email || null,
      registrant_phone: registrant.phone || null,
    }
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const mode = args.execute ? "execute" : "dry-run"
  const reportPath = resolve(reportDir, `qil-2026-2027-ajurrumiyyah-free-${mode}.json`)

  if (!args.execute) {
    const report = {
      importTag: IMPORT_TAG,
      mode,
      generatedAt: new Date().toISOString(),
      offering: OFFERING_NAME,
      offeringId: OFFERING_ID,
      count: planned.length,
      students: planned.map((row) => ({
        applicationId: row.id,
        name: row.contact_name || row.participant_name,
        email: row.contact_email,
      })),
    }
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nWould enroll ${planned.length} students in ${OFFERING_NAME} ($0).`)
    for (const row of planned) {
      console.log(`  - ${row.contact_name || row.participant_name}`)
    }
    console.log(`\nReport written: ${reportPath}`)
    console.log("Re-run with --execute to write to Supabase.")
    return
  }

  const results = []
  for (const app of planned) {
    const result = await upsertEnrollment(sb, app, true)
    results.push(result)
    console.log(`${result.action}: ${result.studentName}`)
  }

  const report = {
    importTag: IMPORT_TAG,
    mode,
    generatedAt: new Date().toISOString(),
    offering: OFFERING_NAME,
    offeringId: OFFERING_ID,
    created: results.filter((row) => row.action === "created").length,
    updated: results.filter((row) => row.action === "updated").length,
    students: results,
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nEnrolled ${results.length} in ${OFFERING_NAME}.`)
  console.log(`Report written: ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
