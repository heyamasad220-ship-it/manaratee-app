/**
 * Add QIL 2024-2025 students present in QIL24-25.csv but missing from the year.
 * Does not change existing 2024-25 enrollments. Does not create new offerings.
 *
 * Usage:
 *   node scripts/import-qil-2024-2025-gap.mjs
 *   node scripts/import-qil-2024-2025-gap.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2024_25_GAP_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/QIL24-25.csv"
const DEPARTMENT_ID = "c5d6b286-0d48-431f-9b55-94a80d4821ef"
const PROGRAM_ID = "9f76c2b8-c66b-4b1a-bd86-5032d0ab30f9"
const YEAR_START = "2024-08-01"
const YEAR_END = "2025-05-31"

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
  const args = { csv: DEFAULT_CSV, execute: false, orgId: DEFAULT_ORG_ID }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--csv") args.csv = argv[++i]
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function fold(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function last10(value) {
  const d = String(value ?? "").replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : ""
}

function parseMoney(value) {
  if (value == null || value === "") return 0
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function parseTxnDate(value) {
  const text = normalizeText(value).replace(
    /\s+(CDT|CST|EDT|EST|PDT|PST|MDT|MST|UTC)$/i,
    ""
  )
  if (!text) return { date: null, iso: null }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return { date: null, iso: null }
  return { date: parsed.toISOString().slice(0, 10), iso: parsed.toISOString() }
}

function extractField(remarks, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Registration Fees|Subscription Fees|Subscription Discount|Add-Ons Amount|Coupon Code|Registration Coupon Value|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
    "i"
  )
  const match = re.exec(remarks || "")
  return match ? normalizeText(match[1]) : ""
}

function parseMembers(remarks, fallbackName) {
  const raw = extractField(remarks, "Registered Members")
  const members = raw
    ? raw
        .split(",")
        .map((item) =>
          normalizeText(item.replace(/\biphone\b/gi, " ").replace(/\bipad\b/gi, " "))
        )
        .filter(Boolean)
    : []
  return members.length ? members : fallbackName ? [fallbackName] : ["Unknown student"]
}

function offeringNameFor(secondary, remarks) {
  const blob = `${fold(secondary)} ${fold(remarks)}`
  if (/memorization/.test(blob)) return "Memorization"
  if (/recitation|tilawah|fadia|huda/.test(blob)) return "Recitation & Arabic Grammar"
  if (/تحسين تلاوة/.test(String(remarks || ""))) return "Recitation & Arabic Grammar"
  return "QIL Registration"
}

async function fetchAll(sb, table, select, apply) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = sb.from(table).select(select).range(from, from + pageSize - 1)
    if (apply) query = apply(query)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

function loadRows(csvPath) {
  const { data, errors } = Papa.parse(readFileSync(csvPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  if (errors?.length) console.warn(`CSV parse warnings: ${errors.length}`)
  return data.map((row, index) => {
    const txn = parseTxnDate(row["Transaction Date"])
    const amount = parseMoney(row.Amount)
    const remarks = row["Payment Remarks"]
    const customerName = normalizeText(row["Customer Name"])
    return {
      rowNumber: index + 2,
      amount,
      status: normalizeText(row.Status).toLowerCase(),
      reason: normalizeText(row["Payment / Donation Reason"]),
      secondary: normalizeText(row["Payment / Donation Secondary Reason"]),
      email: normalizeText(row["Customer Email"]).toLowerCase(),
      phone: normalizeText(row["Customer Phone"]),
      customerName,
      members: parseMembers(remarks, customerName),
      remarks: normalizeText(remarks),
      txnId: normalizeText(row["Transaction ID"]),
      refundReason: normalizeText(row["Refund Reason"]),
      recurringType: normalizeText(row["Recurring Type"]).toUpperCase(),
      date: txn.date,
      iso: txn.iso,
      subscriptionFees: parseMoney(extractField(remarks, "Subscription Fees")),
    }
  })
}

function buildMissingEnrollments(rows, existingStripeIds, existingPeople) {
  const grouped = new Map()
  const skipped = { already_stripe: 0, zero_or_other: 0, already_enrolled: 0, no_money: 0 }

  for (const row of rows) {
    if (row.txnId && existingStripeIds.has(row.txnId)) {
      skipped.already_stripe += 1
      continue
    }
    const key = row.txnId || `row:${row.rowNumber}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        txnId: row.txnId,
        secondary: row.secondary,
        remarks: row.remarks,
        email: row.email,
        phone: row.phone,
        customerName: row.customerName,
        members: row.members,
        payments: [],
        refunds: [],
        subscriptionFees: row.subscriptionFees,
      })
    }
    const g = grouped.get(key)
    if (row.secondary && !g.secondary) g.secondary = row.secondary
    if (row.remarks && !g.remarks) g.remarks = row.remarks
    if (row.email && !g.email) g.email = row.email
    if (row.status === "refunded" || row.amount < 0) {
      g.refunds.push({
        amount: Math.abs(row.amount),
        date: row.date,
        iso: row.iso,
        transactionId: row.txnId,
        refundReason: row.refundReason,
        recurringType: row.recurringType,
      })
    } else if (row.status === "succeeded" && row.amount > 0.009) {
      g.payments.push({
        amount: row.amount,
        date: row.date,
        iso: row.iso,
        transactionId: row.txnId,
        recurringType: row.recurringType,
      })
    } else {
      skipped.zero_or_other += 1
    }
  }

  const merged = new Map()
  for (const g of grouped.values()) {
    const gross = round2(g.payments.reduce((s, p) => s + p.amount, 0))
    const refunded = round2(g.refunds.reduce((s, p) => s + p.amount, 0))
    if (gross <= 0.009 && refunded <= 0.009) continue
    const offeringName = offeringNameFor(g.secondary, g.remarks)
    const members = g.members.length ? g.members : [g.customerName]
    for (const member of members) {
      const netPaid = round2((gross - refunded) / members.length)
      const paid = round2(gross / members.length)
      const ref = round2(refunded / members.length)
      const listPrice =
        g.subscriptionFees > 0
          ? g.subscriptionFees
          : Math.max(paid, netPaid)
      const key = `${offeringName}|${fold(member)}|${g.email || last10(g.phone)}`
      if (!merged.has(key)) {
        merged.set(key, {
          offeringName,
          studentName: member,
          payerName: g.customerName,
          email: g.email,
          phone: g.phone,
          remarks: g.remarks,
          gross: paid,
          refunded: ref,
          netPaid: Math.max(netPaid, 0),
          listPrice,
          cancelled: ref > 0.009 && netPaid <= 0.009,
          payments: [...g.payments],
          refunds: [...g.refunds],
        })
      } else {
        const current = merged.get(key)
        current.gross = round2(current.gross + paid)
        current.refunded = round2(current.refunded + ref)
        current.netPaid = round2(current.netPaid + Math.max(netPaid, 0))
        current.listPrice = round2(Math.max(current.listPrice, listPrice, current.gross))
        current.payments.push(...g.payments)
        current.refunds.push(...g.refunds)
        current.cancelled = current.refunded > 0.009 && current.netPaid <= 0.009
        if (!current.email && g.email) current.email = g.email
        if (!current.phone && g.phone) current.phone = g.phone
      }
    }
  }

  const missing = []
  for (const enrollment of merged.values()) {
    if (enrollment.netPaid <= 0.009 && enrollment.gross <= 0.009) {
      skipped.no_money += 1
      continue
    }
    if (matchesExisting(enrollment, existingPeople)) {
      skipped.already_enrolled += 1
      continue
    }
    missing.push(enrollment)
  }

  return { missing, skipped }
}

function matchesExisting(enrollment, existingPeople) {
  const email = enrollment.email
  const phone = last10(enrollment.phone)
  const names = [fold(enrollment.studentName), fold(enrollment.payerName)].filter(Boolean)
  return existingPeople.some((person) => {
    if (email && person.emails.includes(email)) return true
    if (phone && person.phones.includes(phone)) return true
    if (names.some((name) => person.names.includes(name))) return true
    return false
  })
}

async function loadExistingPeople(sb, orgId) {
  const enrollments = await fetchAll(
    sb,
    "program_enrollments",
    "id, child_name, parent_name, parent_email, parent_phone, participant_contact_id, payer_contact_id",
    (q) => q.eq("organization_id", orgId).eq("program_id", PROGRAM_ID)
  )
  const contactIds = [
    ...new Set(
      enrollments.flatMap((e) => [e.participant_contact_id, e.payer_contact_id]).filter(Boolean)
    ),
  ]
  const contacts = contactIds.length
    ? await fetchAll(sb, "contacts", "id, full_name, email, phone", (q) =>
        q.in("id", contactIds)
      )
    : []
  const byId = new Map(contacts.map((c) => [c.id, c]))
  return enrollments.map((e) => {
    const participant = byId.get(e.participant_contact_id) || {}
    const payer = byId.get(e.payer_contact_id) || {}
    return {
      emails: [e.parent_email, participant.email, payer.email]
        .map((v) => String(v || "").toLowerCase())
        .filter(Boolean),
      phones: [e.parent_phone, participant.phone, payer.phone].map(last10).filter(Boolean),
      names: [e.child_name, e.parent_name, participant.full_name, payer.full_name]
        .map(fold)
        .filter(Boolean),
    }
  })
}

async function ensureContact(sb, orgId, fullName, email, phone, execute) {
  if (email) {
    const { data: byEmail } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .ilike("email", email)
      .maybeSingle()
    if (byEmail) return byEmail
  }
  const digits = last10(phone)
  if (digits) {
    const { data: byPhone } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .or(`phone.ilike.%${digits}%`)
      .limit(8)
    const hit = (byPhone || []).find((c) => last10(c.phone) === digits)
    if (hit) return hit
  }
  if (fullName) {
    const { data: byName } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .ilike("full_name", fullName)
      .limit(1)
      .maybeSingle()
    if (byName) return byName
  }
  if (!execute) {
    return { id: `dry-run:c:${fold(fullName)}`, full_name: fullName, email, phone }
  }
  const { data, error } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: fullName || "Unknown",
    p_email: email || null,
    p_phone: phone || null,
    p_contact_type: "individual",
  })
  if (error) throw new Error(`contact ${fullName}: ${error.message}`)
  const { data: contact, error: reloadError } = await sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("id", data)
    .single()
  if (reloadError) throw new Error(`reload contact ${fullName}: ${reloadError.message}`)
  return contact
}

async function insertEnrollment(sb, orgId, program, offering, enrollment, execute) {
  const importKey = createHash("sha1")
    .update(
      `${IMPORT_TAG}|${program.id}|${offering.id}|${fold(enrollment.studentName)}|${enrollment.payments[0]?.transactionId || enrollment.email}`
    )
    .digest("hex")
  if (!execute) return { enrollmentId: `dry:${importKey}`, chargeId: `dry:chg:${importKey}` }

  const firstIso =
    [...enrollment.payments, ...enrollment.refunds].find((p) => p.iso)?.iso ||
    new Date().toISOString()
  const firstDate =
    [...enrollment.payments, ...enrollment.refunds].find((p) => p.date)?.date ||
    firstIso.slice(0, 10)

  const student = await ensureContact(
    sb,
    orgId,
    enrollment.studentName,
    enrollment.email,
    enrollment.phone,
    execute
  )
  const payer =
    fold(enrollment.payerName) === fold(student.full_name) ||
    fold(enrollment.payerName) === fold(enrollment.studentName)
      ? student
      : await ensureContact(
          sb,
          orgId,
          enrollment.payerName,
          enrollment.email,
          enrollment.phone,
          execute
        )

  const remaining = round2(Math.max(enrollment.listPrice - enrollment.netPaid, 0))
  const paymentStatus = enrollment.cancelled
    ? "refunded"
    : enrollment.netPaid <= 0.009
      ? "pending"
      : remaining <= 0.009
        ? "paid"
        : "partial"
  const displayName = student.full_name || enrollment.studentName
  const payload = {
    organization_id: orgId,
    program_id: program.id,
    offering_id: offering.id,
    department_id: DEPARTMENT_ID,
    child_name: displayName,
    participant_contact_id: student.id,
    registrant_contact_id: payer.id,
    payer_contact_id: payer.id,
    status: enrollment.cancelled ? "cancelled" : "enrolled",
    payment_status: enrollment.cancelled ? "paid" : paymentStatus,
    total_amount: enrollment.listPrice,
    amount_paid: enrollment.netPaid,
    fee_total: enrollment.listPrice,
    discount_total: 0,
    final_total: enrollment.listPrice,
    enrollment_date: firstDate,
    participant_type: "adult",
    registrant_type: payer.id === student.id ? "adult_self" : "guardian",
    parent_name: payer.full_name || enrollment.payerName,
    parent_email: enrollment.email || payer.email || null,
    parent_phone: enrollment.phone || payer.phone || null,
    notes: `Imported ${IMPORT_TAG}${enrollment.remarks ? `\n${enrollment.remarks}` : ""}`,
    payment_required: enrollment.listPrice > 0.009,
    cancelled_at: enrollment.cancelled ? firstIso : null,
    cancel_reason: enrollment.cancelled ? "Fully refunded in payment export" : null,
  }

  const { data, error } = await sb.from("program_enrollments").insert(payload).select("id").single()
  if (error) throw new Error(`enrollment ${displayName}: ${error.message}`)
  const enrollmentId = data.id

  const chargeStatus =
    enrollment.netPaid <= 0.009 && enrollment.listPrice > 0.009
      ? "pending_payment"
      : remaining <= 0.009
        ? "paid"
        : "partially_paid"
  const { data: charge, error: chargeError } = await sb
    .from("program_charges")
    .insert({
      organization_id: orgId,
      enrollment_id: enrollmentId,
      charge_type: "registration",
      source_type: "manual",
      payer_contact_id: payer.id,
      registrant_contact_id: payer.id,
      participant_contact_id: student.id,
      program_id: program.id,
      offering_id: offering.id,
      currency: "USD",
      subtotal: enrollment.listPrice,
      discount_total: 0,
      total: enrollment.listPrice,
      due_today: remaining,
      amount_paid: enrollment.netPaid,
      payment_required: enrollment.listPrice > 0.009,
      charge_status: chargeStatus,
      checkout_status: enrollment.netPaid > 0 || enrollment.cancelled ? "paid" : "not_started",
      paid_at: enrollment.netPaid > 0 || enrollment.cancelled ? firstIso : null,
      metadata: { import_tag: IMPORT_TAG, import_key: importKey },
      quote_snapshot: { import: IMPORT_TAG, offering: enrollment.offeringName },
    })
    .select("id")
    .single()
  if (chargeError) throw new Error(`charge ${displayName}: ${chargeError.message}`)
  const chargeId = charge.id
  await sb
    .from("program_enrollments")
    .update({ charge_id: chargeId })
    .eq("id", enrollmentId)
    .eq("organization_id", orgId)

  const { error: lineError } = await sb.from("program_charge_lines").insert({
    organization_id: orgId,
    charge_id: chargeId,
    line_type: "tuition",
    label: enrollment.offeringName,
    quantity: 1,
    unit_amount: enrollment.listPrice,
    amount: enrollment.listPrice,
    sort_order: 0,
    metadata: { import_tag: IMPORT_TAG },
  })
  if (lineError) throw new Error(`charge lines ${displayName}: ${lineError.message}`)

  const scheduleRows = []
  let sequence = 1
  for (const part of enrollment.payments) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: `Payment ${part.date || sequence}`,
      due_date: part.date,
      amount: part.amount,
      sequence_number: sequence,
      status: "paid",
      charge_category: "tuition",
      paid_at: part.iso || (part.date ? `${part.date}T17:00:00Z` : firstIso),
      metadata: {
        import_tag: IMPORT_TAG,
        stripe_charge_id: part.transactionId,
        recurring_type: part.recurringType,
      },
    })
    sequence += 1
  }
  for (const part of enrollment.refunds) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: `Refund ${part.date || sequence}`,
      due_date: part.date,
      amount: part.amount,
      original_amount: part.amount,
      sequence_number: sequence,
      status: "refunded",
      charge_category: "tuition",
      paid_at: part.iso || (part.date ? `${part.date}T17:00:00Z` : firstIso),
      metadata: {
        import_tag: IMPORT_TAG,
        stripe_charge_id: part.transactionId,
        refund_reason: part.refundReason,
      },
    })
    sequence += 1
  }
  if (scheduleRows.length) {
    const { error: scheduleError } = await sb.from("program_charge_schedule").insert(scheduleRows)
    if (scheduleError) throw new Error(`schedule ${displayName}: ${scheduleError.message}`)
  }

  try {
    await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: student.id,
    })
    if (payer.id !== student.id) {
      await sb.rpc("sync_contact_affiliations", {
        p_organization_id: orgId,
        p_contact_id: payer.id,
      })
    }
  } catch (error) {
    console.warn(
      `affiliation warn (${displayName}): ${error instanceof Error ? error.message : error}`
    )
  }

  return { enrollmentId, chargeId, displayName }
}

async function refreshEnrolledCounts(sb, orgId) {
  const offerings = await fetchAll(
    sb,
    "program_offerings",
    "id",
    (q) => q.eq("organization_id", orgId).eq("program_id", PROGRAM_ID)
  )
  for (const offering of offerings) {
    const { count, error } = await sb
      .from("program_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("offering_id", offering.id)
      .in("status", ["enrolled", "active"])
    if (error) throw new Error(`count offering ${offering.id}: ${error.message}`)
    await sb
      .from("program_offerings")
      .update({ enrolled: count || 0, updated_at: new Date().toISOString() })
      .eq("id", offering.id)
  }
  const { count, error } = await sb
    .from("program_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("program_id", PROGRAM_ID)
    .in("status", ["enrolled", "active"])
  if (error) throw new Error(`count program: ${error.message}`)
  await sb
    .from("programs")
    .update({ enrolled: count || 0, updated_at: new Date().toISOString() })
    .eq("id", PROGRAM_ID)
    .eq("organization_id", orgId)
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)
  console.log(`CSV: ${args.csv}`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const rows = loadRows(args.csv)
  const existingSchedule = await fetchAll(
    sb,
    "program_charge_schedule",
    "metadata",
    (q) => q.eq("organization_id", args.orgId)
  )
  const existingStripeIds = new Set(
    existingSchedule
      .map((row) => row.metadata?.stripe_charge_id)
      .filter((id) => typeof id === "string" && id.trim())
  )
  const existingPeople = await loadExistingPeople(sb, args.orgId)
  const { missing, skipped } = buildMissingEnrollments(rows, existingStripeIds, existingPeople)

  const { data: program, error: programError } = await sb
    .from("programs")
    .select("id, name, department_id")
    .eq("id", PROGRAM_ID)
    .eq("organization_id", args.orgId)
    .single()
  if (programError) throw new Error(`program: ${programError.message}`)

  const offerings = await fetchAll(
    sb,
    "program_offerings",
    "id, name, program_id",
    (q) => q.eq("organization_id", args.orgId).eq("program_id", PROGRAM_ID)
  )
  const offeringByName = new Map(offerings.map((o) => [o.name, o]))

  const created = []
  if (args.execute) {
    for (const enrollment of missing) {
      const offering = offeringByName.get(enrollment.offeringName)
      if (!offering) {
        throw new Error(`Missing offering ${enrollment.offeringName}`)
      }
      const result = await insertEnrollment(
        sb,
        args.orgId,
        program,
        offering,
        enrollment,
        true
      )
      created.push({
        student: result.displayName,
        offering: enrollment.offeringName,
        email: enrollment.email,
        net: enrollment.netPaid,
        enrollmentId: result.enrollmentId,
      })
    }
    await refreshEnrolledCounts(sb, args.orgId)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const mode = args.execute ? "execute" : "dry-run"
  const reportPath = resolve(reportDir, `qil-2024-2025-gap-${mode}-${stamp}.json`)
  const report = {
    importTag: IMPORT_TAG,
    mode,
    generatedAt: new Date().toISOString(),
    csvRows: rows.length,
    skipped,
    missingCount: missing.length,
    missing: missing.map((e) => ({
      student: e.studentName,
      payer: e.payerName,
      offering: e.offeringName,
      email: e.email,
      phone: e.phone,
      net: e.netPaid,
      gross: e.gross,
      refunded: e.refunded,
      remarks: e.remarks || null,
    })),
    created,
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log("\n=== SUMMARY ===")
  console.log(
    JSON.stringify(
      {
        skipped,
        missingCount: missing.length,
        missing: report.missing,
        createdCount: created.length,
      },
      null,
      2
    )
  )
  console.log(`Report: ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
