/**
 * Import QIL 2026–2027 Offerings sheet: delivery, tuition totals, full-payment
 * discounts, and primary instructors.
 *
 * Pricing model:
 *   - Fee = total course tuition
 *   - Monthly option via installments ($50/mo for $450 → 9; $25/mo for $225 → 9)
 *   - Full Payment Discount = fixed $ off when paying in full
 *
 * Usage:
 *   node scripts/import-qil-offerings-2026-2027.mjs
 *   node scripts/import-qil-offerings-2026-2027.mjs --file "C:/Users/danan/Downloads/QIL2026-2027.xlsx"
 *   node scripts/import-qil-offerings-2026-2027.mjs --execute
 */
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2026_27_OFFERINGS_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_FILE = "c:/Users/danan/Downloads/QIL2026-2027.xlsx"
const PROGRAM_ID = "78616758-d6fc-4a48-a99c-f8ea24a34646"
const DEPARTMENT_ID = "c5d6b286-0d48-431f-9b55-94a80d4821ef"

/** Excel Course → canonical offering name (Beginner = Tajweed Beginner, etc.). */
const COURSE_NAME_MAP = {
  beginner: "Tajweed (Beginner)",
  advanced: "Tajweed (Advanced)",
  osool: "Tajweed (Osool)",
  "memorization (surat al-baqara)": "Memorization (Surat Al-Baqara)",
  "memorization (surat al-omran)": "Memorization (Surat Al-Omran)",
  "memorization 1": "Memorization 1",
  "memorization 2": "Memorization 2",
  "recitation improvement": "Recitation Improvement",
  "recitation imporovement": "Recitation Improvement",
  "preparing for ijaza": "Preparing for Ijaza",
  "al-ajurrumiyyah": "Al-Ajurrumiyyah",
}

/** Instructor spreadsheet name → CRM contact full_name. */
const INSTRUCTOR_ALIASES = {
  "amneh ismail": "Amneh Ismail",
  "wedad atwan": "Wedad Atwan",
  "zohour hawa": "Zohour Hawa",
  "abeer abu kawan": "Abeer Abukawan",
  "abeer abukawan": "Abeer Abukawan",
  "fathieh alladin": "Fathieh Alladin",
  "fadia salameh": "Fadia Salameh",
  "souzan ayoub": "Souzan Ayoub",
  "huda elseissy": "Huda ElSeisy",
  "huda elseisy": "Huda ElSeisy",
}

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
    file: DEFAULT_FILE,
    execute: false,
    orgId: DEFAULT_ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--file") args.file = argv[++i]
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ")
}

function parseMoney(value) {
  if (value == null || value === "") return 0
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function mapDelivery(value) {
  const key = normalizeKey(value)
  if (key === "online") return "online"
  if (key === "in person" || key === "in_person" || key === "in-person") {
    return "in_person"
  }
  return null
}

function mapCourseName(excelCourse) {
  return COURSE_NAME_MAP[normalizeKey(excelCourse)] || null
}

function monthlyAmountForFee(fee) {
  if (fee <= 0) return 0
  if (fee === 225) return 25
  if (fee === 450) return 50
  if (fee % 50 === 0) return 50
  if (fee % 25 === 0) return 25
  return Math.round((fee / 9) * 100) / 100
}

function installmentCountForFee(fee) {
  const monthly = monthlyAmountForFee(fee)
  if (fee <= 0 || monthly <= 0) return null
  return Math.max(1, Math.round(fee / monthly))
}

function loadOfferingsSheet(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`)
  const wb = XLSX.readFile(path, { cellDates: true })
  const sheetName =
    wb.SheetNames.find((n) => normalizeKey(n) === "offerings") ||
    wb.SheetNames[1]
  if (!sheetName) throw new Error("Offerings sheet not found")
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
  return rows.map((row, index) => {
    const courseRaw = normalizeText(row.Course)
    const deliveryRaw = normalizeText(row.Delivery)
    const instructorRaw = normalizeText(row["Primary Instructor"])
    return {
      rowNumber: index + 2,
      courseRaw,
      deliveryRaw,
      offeringName: mapCourseName(courseRaw),
      deliveryFormat: mapDelivery(deliveryRaw),
      fee: parseMoney(row.Fee),
      fullPaymentDiscount: parseMoney(row["Full Payment Discount"]),
      instructorRaw,
      instructorCanonical:
        INSTRUCTOR_ALIASES[normalizeKey(instructorRaw)] || instructorRaw,
    }
  })
}

async function findInstructorContact(sb, orgId, canonicalName) {
  const { data: exact } = await sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", orgId)
    .eq("contact_type", "individual")
    .ilike("full_name", canonicalName)
    .limit(1)
    .maybeSingle()
  if (exact) return exact

  const parts = canonicalName.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const { data: soft } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .ilike("full_name", `%${parts[0]}%`)
      .ilike("full_name", `%${parts[parts.length - 1]}%`)
      .limit(5)
    const match = (soft || []).find(
      (c) =>
        normalizeKey(c.full_name).includes(normalizeKey(parts[0])) &&
        normalizeKey(c.full_name).includes(
          normalizeKey(parts[parts.length - 1]).slice(0, 4)
        )
    )
    if (match) return match
  }
  return null
}

async function ensureStaff(sb, orgId, departmentId, contact, execute) {
  const { data: existing } = await sb
    .from("staff")
    .select("id, contact_id, first_name, last_name, department_id, status")
    .eq("organization_id", orgId)
    .eq("contact_id", contact.id)
    .maybeSingle()
  if (existing) {
    if (
      execute &&
      existing.department_id !== departmentId &&
      departmentId
    ) {
      await sb
        .from("staff")
        .update({ department_id: departmentId })
        .eq("id", existing.id)
    }
    return existing
  }

  const parts = normalizeText(contact.full_name).split(/\s+/).filter(Boolean)
  const first = parts[0] || "Teacher"
  const last = parts.slice(1).join(" ") || ""

  if (!execute) {
    return {
      id: `dry-run:staff:${contact.id}`,
      contact_id: contact.id,
      first_name: first,
      last_name: last,
      department_id: departmentId,
    }
  }

  const { data, error } = await sb
    .from("staff")
    .insert({
      organization_id: orgId,
      contact_id: contact.id,
      first_name: first,
      last_name: last,
      email: contact.email || null,
      phone: contact.phone || null,
      department_id: departmentId,
      staff_type: "part_time",
      status: "active",
      pay_basis: "hourly",
    })
    .select("id, contact_id, first_name, last_name, department_id, status")
    .single()
  if (error) throw new Error(`staff create (${contact.full_name}): ${error.message}`)
  return data
}

async function ensurePrimaryInstructor(
  sb,
  orgId,
  programId,
  offeringId,
  contactId,
  execute
) {
  const { data: existing } = await sb
    .from("program_staff_assignments")
    .select("id, contact_id, is_active, assignment_role")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("assignment_role", "primary_instructor")

  const activeOther = (existing || []).filter(
    (row) => row.contact_id !== contactId && row.is_active
  )
  const mine = (existing || []).find((row) => row.contact_id === contactId)

  if (!execute) {
    return {
      deactivate: activeOther.length,
      create: !mine,
      reactivate: Boolean(mine && !mine.is_active),
    }
  }

  for (const row of activeOther) {
    await sb
      .from("program_staff_assignments")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", row.id)
  }

  if (mine) {
    if (!mine.is_active) {
      await sb
        .from("program_staff_assignments")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", mine.id)
    }
    return { deactivate: activeOther.length, create: false, reactivate: !mine.is_active }
  }

  const { error } = await sb.from("program_staff_assignments").insert({
    organization_id: orgId,
    program_id: programId,
    offering_id: offeringId,
    contact_id: contactId,
    assignment_role: "primary_instructor",
    is_active: true,
    notes: IMPORT_TAG,
  })
  if (error) throw new Error(`staff assignment: ${error.message}`)
  return { deactivate: activeOther.length, create: true, reactivate: false }
}

async function upsertFeePlan(
  sb,
  orgId,
  programId,
  offeringId,
  fee,
  fullPaymentDiscount,
  execute
) {
  const monthly = monthlyAmountForFee(fee)
  const installments = installmentCountForFee(fee)
  const isFree = fee <= 0
  const planType = isFree ? "free" : "installments"
  const planName = isFree ? "Free" : "Course tuition"

  const { data: existingPlans } = await sb
    .from("program_offering_fee_plans")
    .select("id, name, is_default, is_active, plan_type")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)

  let plan =
    (existingPlans || []).find((p) => p.is_default) ||
    (existingPlans || []).find((p) => p.name === planName) ||
    (existingPlans || [])[0] ||
    null

  const metadata = {
    import_tag: IMPORT_TAG,
    total_tuition: fee,
    monthly_amount: monthly,
    full_payment_discount: fullPaymentDiscount,
    pricing_notes: isFree
      ? "No tuition"
      : `Total $${fee}. Monthly ~$${monthly} × ${installments}. Pay-in-full discount $${fullPaymentDiscount}.`,
  }

  if (!execute) {
    return {
      planId: plan?.id || `dry-run:plan:${offeringId}`,
      created: !plan,
      planType,
      fee,
      monthly,
      installments,
      fullPaymentDiscount,
    }
  }

  if (!plan) {
    const { data, error } = await sb
      .from("program_offering_fee_plans")
      .insert({
        organization_id: orgId,
        program_id: programId,
        offering_id: offeringId,
        name: planName,
        plan_type: planType,
        currency: "USD",
        is_default: true,
        is_active: true,
        deposit_amount: 0,
        payment_due_day: null,
        installment_count: installments,
        notes: metadata.pricing_notes,
        metadata,
      })
      .select("id, name, plan_type")
      .single()
    if (error) throw new Error(`fee plan create: ${error.message}`)
    plan = data
  } else {
    const { error } = await sb
      .from("program_offering_fee_plans")
      .update({
        name: planName,
        plan_type: planType,
        is_default: true,
        is_active: true,
        deposit_amount: 0,
        installment_count: installments,
        notes: metadata.pricing_notes,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id)
    if (error) throw new Error(`fee plan update: ${error.message}`)
  }

  // Mark other plans non-default
  for (const other of existingPlans || []) {
    if (other.id === plan.id) continue
    if (other.is_default) {
      await sb
        .from("program_offering_fee_plans")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("id", other.id)
    }
  }

  const { data: components } = await sb
    .from("program_offering_fee_plan_components")
    .select("*")
    .eq("fee_plan_id", plan.id)

  const tuitionSpec = {
    component_type: "tuition",
    label: "Tuition",
    amount: fee,
    pricing_model: "flat",
    quantity_mode: "fixed",
    quantity_value: 1,
    sort_order: 10,
    billing_scope: "individual",
    session_price_source: "component",
    addon_key: null,
  }

  const existingTuition = (components || []).find(
    (c) => c.component_type === "tuition"
  )
  if (isFree) {
    if (existingTuition) {
      await sb
        .from("program_offering_fee_plan_components")
        .update({
          amount: 0,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTuition.id)
    }
  } else if (existingTuition) {
    await sb
      .from("program_offering_fee_plan_components")
      .update({
        ...tuitionSpec,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTuition.id)
  } else {
    const { error } = await sb.from("program_offering_fee_plan_components").insert({
      organization_id: orgId,
      fee_plan_id: plan.id,
      ...tuitionSpec,
      is_active: true,
    })
    if (error) throw new Error(`tuition component: ${error.message}`)
  }

  const { data: discounts } = await sb
    .from("program_offering_discount_rules")
    .select("*")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("rule_type", "full_payment")

  const existingDiscount = (discounts || []).find(
    (d) => d.fee_plan_id === plan.id || d.fee_plan_id == null
  )

  if (fullPaymentDiscount > 0 && !isFree) {
    const discountPayload = {
      organization_id: orgId,
      offering_id: offeringId,
      fee_plan_id: plan.id,
      rule_type: "full_payment",
      label: "Pay in Full",
      discount_type: "fixed_amount",
      amount: fullPaymentDiscount,
      is_active: true,
      priority_rank: 30,
      conditions: {
        kind: "full_payment",
        import_tag: IMPORT_TAG,
        exclude_component_types: ["registration_fee"],
      },
    }
    if (existingDiscount) {
      await sb
        .from("program_offering_discount_rules")
        .update({
          ...discountPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDiscount.id)
    } else {
      const { error } = await sb
        .from("program_offering_discount_rules")
        .insert(discountPayload)
      if (error) throw new Error(`full payment discount: ${error.message}`)
    }
  } else if (existingDiscount) {
    await sb
      .from("program_offering_discount_rules")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", existingDiscount.id)
  }

  // Link registration options to this plan
  const { data: options } = await sb
    .from("program_registration_options")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)

  for (const option of options || []) {
    await sb
      .from("program_registration_options")
      .update({
        fee_plan_id: plan.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", option.id)
  }

  // Ensure at least one Full Program option exists
  if (!options || options.length === 0) {
    await sb.from("program_registration_options").insert({
      organization_id: orgId,
      program_id: programId,
      offering_id: offeringId,
      name: "Full Program",
      option_type: "full_program",
      fee_plan_id: plan.id,
      is_active: true,
      priority_rank: 10,
    })
  }

  return {
    planId: plan.id,
    created: !(existingPlans || []).some((p) => p.id === plan.id),
    planType,
    fee,
    monthly,
    installments,
    fullPaymentDiscount,
  }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const rows = loadOfferingsSheet(args.file)

  const bad = rows.filter((r) => !r.offeringName || !r.deliveryFormat)
  console.log(`File: ${args.file}`)
  console.log(`Offerings rows: ${rows.length}`)
  if (bad.length) {
    console.error("Unmapped rows:", bad)
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: program, error: programError } = await sb
    .from("programs")
    .select("id, name, status, department_id")
    .eq("id", PROGRAM_ID)
    .eq("organization_id", args.orgId)
    .single()
  if (programError || !program) {
    throw new Error(`Program not found: ${PROGRAM_ID}`)
  }

  const { data: offerings } = await sb
    .from("program_offerings")
    .select("id, name, delivery_format, status")
    .eq("organization_id", args.orgId)
    .eq("program_id", PROGRAM_ID)

  console.log(`Program: ${program.name} [${program.status}]`)
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)

  const plan = []

  for (const row of rows) {
    const offering =
      (offerings || []).find(
        (o) =>
          o.name === row.offeringName &&
          (o.delivery_format || "in_person") === row.deliveryFormat
      ) ||
      // Prefer name-only match when delivery will be updated (Baqara/Omran)
      (offerings || []).find((o) => o.name === row.offeringName) ||
      null

    if (!offering) {
      plan.push({
        ...row,
        action: "missing_offering",
      })
      continue
    }

    const instructorContact = await findInstructorContact(
      sb,
      args.orgId,
      row.instructorCanonical
    )
    if (!instructorContact) {
      plan.push({
        ...row,
        offeringId: offering.id,
        action: "missing_instructor",
      })
      continue
    }

    const deliveryChange =
      (offering.delivery_format || "in_person") !== row.deliveryFormat
        ? { from: offering.delivery_format, to: row.deliveryFormat }
        : null

    plan.push({
      rowNumber: row.rowNumber,
      courseRaw: row.courseRaw,
      offeringName: row.offeringName,
      deliveryFormat: row.deliveryFormat,
      offeringId: offering.id,
      fee: row.fee,
      fullPaymentDiscount: row.fullPaymentDiscount,
      monthly: monthlyAmountForFee(row.fee),
      installments: installmentCountForFee(row.fee),
      instructorRaw: row.instructorRaw,
      instructorContactId: instructorContact.id,
      instructorName: instructorContact.full_name,
      deliveryChange,
      action: "update",
    })
  }

  const counts = plan.reduce((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1
    return acc
  }, {})
  console.log("Plan counts:", counts)
  console.table(
    plan.map((p) => ({
      course: p.offeringName || p.courseRaw,
      delivery: p.deliveryFormat,
      fee: p.fee,
      discount: p.fullPaymentDiscount,
      monthly: p.monthly,
      instructor: p.instructorName || p.instructorRaw,
      deliveryFix: p.deliveryChange
        ? `${p.deliveryChange.from}→${p.deliveryChange.to}`
        : "",
      action: p.action,
    }))
  )

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(
    reportDir,
    `qil-2026-2027-offerings-${args.execute ? "execute" : "dry-run"}.json`
  )
  writeFileSync(
    reportPath,
    JSON.stringify({ importTag: IMPORT_TAG, execute: args.execute, counts, plan }, null, 2)
  )
  console.log(`Report: ${reportPath}`)

  const blockers = plan.filter((p) => p.action !== "update")
  if (blockers.length) {
    console.error("\nAborting: fix missing offerings/instructors first.")
    process.exit(1)
  }

  if (!args.execute) {
    console.log("\nDry-run complete. Re-run with --execute to write.")
    return
  }

  for (const item of plan) {
    if (item.deliveryChange) {
      const { error } = await sb
        .from("program_offerings")
        .update({
          delivery_format: item.deliveryFormat,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.offeringId)
      if (error) {
        throw new Error(
          `delivery update ${item.offeringName}: ${error.message}`
        )
      }
      console.log(
        `Delivery: ${item.offeringName} ${item.deliveryChange.from} → ${item.deliveryChange.to}`
      )
    }

    const feeResult = await upsertFeePlan(
      sb,
      args.orgId,
      PROGRAM_ID,
      item.offeringId,
      item.fee,
      item.fullPaymentDiscount,
      true
    )
    console.log(
      `Fee: ${item.offeringName} [${item.deliveryFormat}] total=$${item.fee} monthly≈$${item.monthly} x${item.installments} fullPay=-$${item.fullPaymentDiscount} plan=${feeResult.planId}`
    )

    const contact = {
      id: item.instructorContactId,
      full_name: item.instructorName,
      email: null,
      phone: null,
    }
    // Refresh contact email/phone for staff create
    const { data: fullContact } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("id", item.instructorContactId)
      .single()
    await ensureStaff(
      sb,
      args.orgId,
      DEPARTMENT_ID,
      fullContact || contact,
      true
    )
    const assign = await ensurePrimaryInstructor(
      sb,
      args.orgId,
      PROGRAM_ID,
      item.offeringId,
      item.instructorContactId,
      true
    )
    console.log(
      `Instructor: ${item.offeringName} → ${item.instructorName} (create=${assign.create}, reactivate=${assign.reactivate}, deactivatedOthers=${assign.deactivate})`
    )
  }

  console.log("\nDone. Offerings updated with fees, discounts, and primary instructors.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
