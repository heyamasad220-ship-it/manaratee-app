/**
 * Phase 1: Import Summer Camps 2026 from Stripe-style payments CSV.
 *
 * Usage (dry-run by default):
 *   node scripts/import-summer-camps-2026.mjs
 *   node scripts/import-summer-camps-2026.mjs --csv "C:/Users/danan/Downloads/SummerCampsPayments2026.csv"
 *   node scripts/import-summer-camps-2026.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 *
 * Later phases (not this script):
 *   - Master roster workbook (ages, staff, volunteers, payroll, expenses)
 *   - Staff payroll deductions for STAFF* credits
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "SUMMER_CAMPS_2026_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "c:/Users/danan/Downloads/SummerCampsPayments2026.csv"

const DEPARTMENT_NAME = "Recreational Camps"
const YEAR_PROGRAM_NAME = "Summer Camps 2026"

/** Camp One: four Mon–Thu weeks ending before Camp Two (Jun 1–25, 2026). */
const CAMP1 = {
  key: "camp1",
  csvName: "2026 MAS Summer Camp One (June)",
  offeringName: "Summer Camp One (June)",
  start: "2026-06-01",
  end: "2026-06-25",
  weeks: [
    { name: "Week 1", start: "2026-06-01", end: "2026-06-04" },
    { name: "Week 2", start: "2026-06-08", end: "2026-06-11" },
    { name: "Week 3", start: "2026-06-15", end: "2026-06-18" },
    { name: "Week 4", start: "2026-06-22", end: "2026-06-25" },
  ],
}

/** Camp Two: CSV range 6/29–7/23, Mon–Thu. */
const CAMP2 = {
  key: "camp2",
  csvName: "2026 MAS Summer Camp Two (6/29 - 7/23)",
  offeringName: "Summer Camp Two (6/29 - 7/23)",
  start: "2026-06-29",
  end: "2026-07-23",
  weeks: [
    { name: "Week 1", start: "2026-06-29", end: "2026-07-02" },
    { name: "Week 2", start: "2026-07-06", end: "2026-07-09" },
    { name: "Week 3", start: "2026-07-13", end: "2026-07-16" },
    { name: "Week 4", start: "2026-07-20", end: "2026-07-23" },
  ],
}

const CAMPS = [CAMP1, CAMP2]
const SCHEDULE_DAYS = ["monday", "tuesday", "wednesday", "thursday"]
const START_TIME = "11:00"
const END_TIME = "16:00"

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
    csv: DEFAULT_CSV,
    execute: false,
    orgId: DEFAULT_ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--csv") args.csv = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function normalizePhone(value) {
  const digits = normalizeText(value).replace(/\D/g, "")
  if (!digits) return null
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits
}

function parseMoney(value) {
  if (value == null || value === "") return 0
  const n = Number(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function splitMoneyAcross(total, count) {
  if (count <= 0) return []
  const cents = Math.round(round2(total) * 100)
  const base = Math.floor(cents / count)
  const rem = cents - base * count
  return Array.from({ length: count }, (_, i) =>
    round2((base + (i < rem ? 1 : 0)) / 100)
  )
}

/** "Jul 21, 2026 12:26 PM CDT" → ISO date + timestamp */
function parseTransactionDate(value) {
  const text = normalizeText(value)
  if (!text) return { date: null, iso: null }
  const cleaned = text.replace(/\s+(CDT|CST|EDT|EST|PDT|PST|UTC)$/i, "")
  const d = new Date(cleaned)
  if (Number.isNaN(d.getTime())) {
    const m = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/.exec(text)
    if (!m) return { date: null, iso: null }
    const fallback = new Date(`${m[1]} ${m[2]}, ${m[3]} 12:00:00`)
    if (Number.isNaN(fallback.getTime())) return { date: null, iso: null }
    return {
      date: fallback.toISOString().slice(0, 10),
      iso: fallback.toISOString(),
    }
  }
  return { date: d.toISOString().slice(0, 10), iso: d.toISOString() }
}

function extractField(remarks, label) {
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(?:Registered Members|Subscription Fees|Add-Ons Amount|Coupon Code|Subscription Coupon Value|Is Full Payment Made)\\s*:|$)`,
    "i"
  )
  const m = re.exec(remarks || "")
  return m ? normalizeText(m[1]) : ""
}

function parseRemarks(remarks) {
  const text = normalizeText(remarks)
  const membersRaw = extractField(text, "Registered Members")
  const members = membersRaw
    ? membersRaw
        .split(",")
        .map((s) => normalizeText(s))
        .filter(Boolean)
    : []
  return {
    members,
    subscriptionFees: parseMoney(extractField(text, "Subscription Fees")),
    addOnsAmount: parseMoney(extractField(text, "Add-Ons Amount")),
    couponCode: normalizeText(extractField(text, "Coupon Code")).toUpperCase(),
    couponValue: parseMoney(extractField(text, "Subscription Coupon Value")),
    isFullPayment:
      /yes/i.test(extractField(text, "Is Full Payment Made")) || members.length > 0,
  }
}

function campFromProgramName(programName) {
  const name = normalizeText(programName)
  return CAMPS.find((c) => c.csvName === name) || null
}

/**
 * Session length from coupon. Defaults to full camp (4 weeks).
 * Partial coupons → weeks 1..N from the start (adjust later if needed).
 */
function resolveSessionPlan(couponCode, campKey) {
  const code = normalizeText(couponCode).toUpperCase()
  if (!code) {
    return { weekCount: 4, dayPass: false, kind: "full", reason: "no_coupon" }
  }
  if (/ONEDAYPASS|ONE.?DAY/i.test(code)) {
    return { weekCount: 1, dayPass: true, kind: "day_pass", reason: code }
  }
  if (/THREE.?WEEK/i.test(code)) {
    return { weekCount: 3, dayPass: false, kind: "weeks", reason: code }
  }
  if (/TWO.?WEEK|TWOWEEKSOFF/i.test(code)) {
    return { weekCount: 2, dayPass: false, kind: "weeks", reason: code }
  }
  if (/ONE.?WEEK/i.test(code)) {
    return { weekCount: 1, dayPass: false, kind: "weeks", reason: code }
  }
  // FA / staff / member / custom → still full camp length unless week token present
  return { weekCount: 4, dayPass: false, kind: "full", reason: code || "full" }
}

function classifyCoupon(couponCode) {
  const code = normalizeText(couponCode).toUpperCase()
  if (!code) return { type: "none", code: "" }
  if (/^FA\b|^FA[-_]/i.test(code)) return { type: "financial_assistance", code }
  if (/^STAFF|CREDIT/i.test(code)) return { type: "staff_credit", code }
  if (/^MEMBER/i.test(code)) return { type: "member_discount", code }
  if (/WEEK|DAY.?PASS|ONEDAYPASS/i.test(code)) return { type: "session_length", code }
  return { type: "other_discount", code }
}

function loadPayments(csvPath) {
  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }
  const text = readFileSync(csvPath, "utf8")
  const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (errors?.length) {
    console.warn(`CSV parse warnings: ${errors.length}`)
  }

  return data.map((row, index) => {
    const remarks = parseRemarks(row["Payment Remarks"])
    const camp = campFromProgramName(row["Program Name"])
    const tx = parseTransactionDate(row["Transaction Date"])
    const amountType = normalizeText(row["Amount Type"]).toUpperCase() || null
    const status = normalizeText(row["Status"]).toLowerCase()
    return {
      rowIndex: index + 2,
      customerName: normalizeText(row["Customer Name"]),
      email: normalizeEmail(row["Customer Email"]),
      phone: normalizePhone(row["Customer Phone"]),
      programName: normalizeText(row["Program Name"]),
      campKey: camp?.key || null,
      amount: parseMoney(row["Amount"]),
      status,
      amountType,
      transactionDate: tx.date,
      transactionIso: tx.iso,
      ...remarks,
      couponClass: classifyCoupon(remarks.couponCode),
      sessionPlan: resolveSessionPlan(remarks.couponCode, camp?.key),
    }
  })
}

function payerKey(row) {
  if (row.email) return `email:${row.email}`
  if (row.phone) return `phone:${row.phone}`
  return `name:${normalizeName(row.customerName)}`
}

function membersKey(members) {
  return members.map(normalizeName).filter(Boolean).sort().join("|")
}

function groupKey(row) {
  return `${row.campKey || "unknown"}::${payerKey(row)}::${membersKey(row.members)}`
}

function buildPlan(rows) {
  const unknownPrograms = rows.filter((r) => !r.campKey)
  const groups = new Map()

  for (const row of rows) {
    if (!row.campKey) continue
    const key = groupKey(row)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        campKey: row.campKey,
        customerName: row.customerName,
        email: row.email,
        phone: row.phone,
        members: [...row.members],
        couponCode: "",
        couponClass: { type: "none", code: "" },
        sessionPlan: { weekCount: 4, dayPass: false, kind: "full", reason: "no_coupon" },
        subscriptionFees: 0,
        addOnsAmount: 0,
        couponValue: 0,
        rows: [],
        tuitionPaid: 0,
        childcarePaid: 0,
        tuitionRefunded: 0,
        childcareRefunded: 0,
        hasRefund: false,
      })
    }
    const g = groups.get(key)
    g.rows.push(row)
    if (row.members.length && !g.members.length) g.members = [...row.members]
    if (row.email && !g.email) g.email = row.email
    if (row.phone && !g.phone) g.phone = row.phone
    if (row.customerName && !g.customerName) g.customerName = row.customerName

    if (row.subscriptionFees > g.subscriptionFees) g.subscriptionFees = row.subscriptionFees
    if (row.addOnsAmount > g.addOnsAmount) g.addOnsAmount = row.addOnsAmount
    if (row.couponValue > g.couponValue) g.couponValue = row.couponValue
    if (row.couponCode && !g.couponCode) {
      g.couponCode = row.couponCode
      g.couponClass = row.couponClass
      g.sessionPlan = row.sessionPlan
    } else if (row.couponCode && row.couponClass.type === "session_length") {
      // Prefer explicit session-length coupon when present
      g.couponCode = row.couponCode
      g.couponClass = row.couponClass
      g.sessionPlan = row.sessionPlan
    } else if (row.couponCode && g.couponClass.type === "none") {
      g.couponCode = row.couponCode
      g.couponClass = row.couponClass
      g.sessionPlan = row.sessionPlan
    }

    if (row.status === "refunded" || row.amount < 0) {
      g.hasRefund = true
      const abs = Math.abs(row.amount)
      if (row.amountType === "ADDONS_AMOUNT") g.childcareRefunded = round2(g.childcareRefunded + abs)
      else g.tuitionRefunded = round2(g.tuitionRefunded + abs)
    } else if (row.status === "succeeded") {
      if (row.amountType === "ADDONS_AMOUNT") {
        g.childcarePaid = round2(g.childcarePaid + row.amount)
      } else {
        g.tuitionPaid = round2(g.tuitionPaid + row.amount)
      }
    }
  }

  const registrations = []
  const skippedNoMembers = []

  for (const g of groups.values()) {
    if (!g.members.length) {
      skippedNoMembers.push(g)
      continue
    }

    const netTuition = round2(g.tuitionPaid - g.tuitionRefunded)
    const netChildcare = round2(g.childcarePaid - g.childcareRefunded)
    const cancelled = g.hasRefund && netTuition <= 0.009 && netChildcare <= 0.009

    const childCount = g.members.length
    const feeShares = splitMoneyAcross(g.subscriptionFees, childCount)
    const discountShares = splitMoneyAcross(g.couponValue, childCount)
    const paidShares = splitMoneyAcross(Math.max(netTuition, 0), childCount)

    // Childcare stays on first child as a separate addon charge (family-level Stripe addon)
    const children = g.members.map((name, index) => {
      const original = feeShares[index] || 0
      const discount = discountShares[index] || 0
      const paid = paidShares[index] || 0
      let assisted = round2(Math.max(original - discount, 0))
      if (g.couponClass.type === "financial_assistance") {
        assisted = round2(Math.max(original - discount, 0))
      } else if (g.couponClass.type === "staff_credit") {
        // Staff get 50% (or full credit when coupon covers full fee); charge = net after coupon
        assisted = round2(Math.max(original - discount, paid))
      } else if (discount > 0) {
        assisted = round2(Math.max(original - discount, 0))
      } else {
        assisted = original
      }
      // Prefer cash collected when present and not FA full scholarship
      if (paid > 0.009 && g.couponClass.type !== "financial_assistance") {
        assisted = Math.min(assisted || original, paid) || paid
      }
      if (g.couponClass.type === "financial_assistance" && discount + 0.009 >= original) {
        assisted = 0
      }

      return {
        childName: name,
        originalFee: original,
        discountAmount: discount,
        assistedFee: cancelled ? 0 : assisted,
        amountPaid: cancelled ? 0 : paid,
        isPrimaryForChildcare: index === 0,
      }
    })

    registrations.push({
      ...g,
      cancelled,
      netTuition,
      netChildcare,
      children,
      paymentParts: g.rows
        .filter((r) => r.status === "succeeded" && r.amountType !== "ADDONS_AMOUNT" && r.amount > 0)
        .map((r) => ({ date: r.transactionDate, iso: r.transactionIso, amount: r.amount })),
      childcareParts: g.rows
        .filter((r) => r.status === "succeeded" && r.amountType === "ADDONS_AMOUNT" && r.amount > 0)
        .map((r) => ({ date: r.transactionDate, iso: r.transactionIso, amount: r.amount })),
      enrollmentDate:
        g.rows
          .map((r) => r.transactionDate)
          .filter(Boolean)
          .sort()[0] || CAMP1.start,
    })
  }

  const couponBreakdown = {}
  for (const r of registrations) {
    const code = r.couponCode || "(none)"
    couponBreakdown[code] = (couponBreakdown[code] || 0) + 1
  }

  return {
    totals: {
      csvRows: rows.length,
      unknownPrograms: unknownPrograms.length,
      registrationGroups: registrations.length,
      enrolmentsPlanned: registrations.reduce((s, r) => s + r.children.length, 0),
      cancelledGroups: registrations.filter((r) => r.cancelled).length,
      faGroups: registrations.filter((r) => r.couponClass.type === "financial_assistance").length,
      staffCreditGroups: registrations.filter((r) => r.couponClass.type === "staff_credit").length,
      childcareGroups: registrations.filter((r) => r.addOnsAmount > 0 || r.netChildcare > 0).length,
      skippedNoMembers: skippedNoMembers.length,
      tuitionCollected: round2(
        registrations.reduce((s, r) => s + Math.max(r.netTuition, 0), 0)
      ),
      childcareCollected: round2(
        registrations.reduce((s, r) => s + Math.max(r.netChildcare, 0), 0)
      ),
    },
    calendars: CAMPS.map((c) => ({
      offeringName: c.offeringName,
      start: c.start,
      end: c.end,
      schedule: `Mon–Thu ${START_TIME}–${END_TIME}`,
      weeks: c.weeks,
    })),
    couponBreakdown,
    unknownPrograms: unknownPrograms.slice(0, 20),
    skippedNoMembers: skippedNoMembers.map((g) => ({
      customerName: g.customerName,
      email: g.email,
      campKey: g.campKey,
      rowCount: g.rows.length,
    })),
    registrations,
  }
}

async function ensureDepartment(sb, orgId, execute) {
  const aliases = [DEPARTMENT_NAME, "Recreational Camp", "Summer Camps"]
  for (const name of aliases) {
    const { data } = await sb
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .maybeSingle()
    if (data) return data
  }
  if (!execute) return { id: "dry-run:department", name: DEPARTMENT_NAME }
  const { data, error } = await sb
    .from("departments")
    .insert({
      organization_id: orgId,
      name: DEPARTMENT_NAME,
      description: "Youth recreational camps (imported Summer Camps 2026)",
      color: "#14b8a6",
    })
    .select("id, name")
    .single()
  if (error) throw new Error(`department create: ${error.message}`)
  return data
}

async function ensureYearProgram(sb, orgId, departmentId, execute) {
  const { data: existing } = await sb
    .from("programs")
    .select("id, name, department_id")
    .eq("organization_id", orgId)
    .eq("name", YEAR_PROGRAM_NAME)
    .maybeSingle()
  if (existing) {
    if (execute && existing.department_id !== departmentId) {
      await sb
        .from("programs")
        .update({ department_id: departmentId })
        .eq("id", existing.id)
        .eq("organization_id", orgId)
    }
    return existing
  }
  if (!execute) {
    return { id: "dry-run:program", name: YEAR_PROGRAM_NAME, department_id: departmentId }
  }
  const { data, error } = await sb
    .from("programs")
    .insert({
      organization_id: orgId,
      department_id: departmentId,
      name: YEAR_PROGRAM_NAME,
      description: "Summer Camps 2026 — Camp One (June) and Camp Two (late June–July).",
      start_date: CAMP1.start,
      end_date: CAMP2.end,
      enrollment_open_date: "2026-03-01",
      enrollment_close_date: CAMP2.end,
      program_type: "youth",
      gender: "Co-ed",
      capacity: 0,
      enrolled: 0,
      waitlist: 0,
      status: "active",
      visibility: "private",
      full_program_registration_enabled: true,
      session_registration_enabled: true,
      require_guardian: true,
    })
    .select("id, name, department_id")
    .single()
  if (error) throw new Error(`year program create: ${error.message}`)
  return data
}

async function ensureOffering(sb, orgId, programId, camp, execute, cache) {
  if (cache.has(camp.key)) return cache.get(camp.key)
  const { data: existing } = await sb
    .from("program_offerings")
    .select("id, name, program_id")
    .eq("organization_id", orgId)
    .eq("program_id", programId)
    .eq("name", camp.offeringName)
    .maybeSingle()
  if (existing) {
    cache.set(camp.key, existing)
    return existing
  }
  if (!execute) {
    const placeholder = {
      id: `dry-run:offering:${camp.key}`,
      name: camp.offeringName,
      program_id: programId,
    }
    cache.set(camp.key, placeholder)
    return placeholder
  }
  // Keep payload aligned with QIL import — registration flags live on `programs`
  // and/or migrated offering attribute columns that may not exist in every DB.
  // Never set is_default: year programs often already have a default offering row.
  const { data, error } = await sb
    .from("program_offerings")
    .insert({
      organization_id: orgId,
      program_id: programId,
      name: camp.offeringName,
      is_default: false,
      offering_type: "summer",
      start_date: camp.start,
      end_date: camp.end,
      enrollment_open_date: "2026-03-01",
      enrollment_close_date: camp.end,
      status: "closed",
    })
    .select("id, name, program_id")
    .single()
  if (error) throw new Error(`offering create (${camp.offeringName}): ${error.message}`)
  cache.set(camp.key, data)
  return data
}

async function ensureRegistrationOptions(sb, orgId, programId, offeringId, execute) {
  if (!execute || String(offeringId).startsWith("dry-run:")) return
  const options = [
    { name: "Full Camp", option_type: "full_program", priority_rank: 10 },
    { name: "Selected Weeks", option_type: "selected_sessions", priority_rank: 20 },
    { name: "Day Pass", option_type: "single_session", priority_rank: 30 },
  ]
  for (const opt of options) {
    const { data: existing } = await sb
      .from("program_registration_options")
      .select("id")
      .eq("organization_id", orgId)
      .eq("offering_id", offeringId)
      .eq("option_type", opt.option_type)
      .maybeSingle()
    if (existing) continue
    const { error } = await sb.from("program_registration_options").insert({
      organization_id: orgId,
      program_id: programId,
      offering_id: offeringId,
      name: opt.name,
      option_type: opt.option_type,
      is_active: true,
      priority_rank: opt.priority_rank,
    })
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn(`registration option warn: ${error.message}`)
    }
  }
}

async function ensureSessions(sb, orgId, programId, offeringId, camp, execute, sessionCache) {
  const list = []
  for (const week of camp.weeks) {
    const cacheKey = `${camp.key}:${week.name}`
    if (sessionCache.has(cacheKey)) {
      list.push(sessionCache.get(cacheKey))
      continue
    }
    const { data: existing } = await sb
      .from("program_sessions")
      .select("id, name, start_date, end_date, offering_id")
      .eq("organization_id", orgId)
      .eq("offering_id", offeringId)
      .eq("name", week.name)
      .maybeSingle()
    if (existing) {
      sessionCache.set(cacheKey, existing)
      list.push(existing)
      continue
    }
    if (!execute) {
      const placeholder = {
        id: `dry-run:session:${cacheKey}`,
        name: week.name,
        start_date: week.start,
        end_date: week.end,
        offering_id: offeringId,
      }
      sessionCache.set(cacheKey, placeholder)
      list.push(placeholder)
      continue
    }
    const { data, error } = await sb
      .from("program_sessions")
      .insert({
        organization_id: orgId,
        program_id: programId,
        offering_id: offeringId,
        name: week.name,
        description: `Mon–Thu ${START_TIME}–${END_TIME}`,
        start_date: week.start,
        end_date: week.end,
        capacity: 0,
        enrolled: 0,
        waitlist: 0,
        price: 0,
        enable_waitlist: true,
        status: "active",
      })
      .select("id, name, start_date, end_date, offering_id")
      .single()
    if (error) throw new Error(`session create (${camp.offeringName} ${week.name}): ${error.message}`)
    sessionCache.set(cacheKey, data)
    list.push(data)
  }
  return list
}

async function ensureWeeklySchedule(sb, orgId, programId, offeringId, camp, execute) {
  if (!execute || String(offeringId).startsWith("dry-run:")) return
  for (const day of SCHEDULE_DAYS) {
    const title = `${camp.offeringName} — ${day}`
    const { data: existing } = await sb
      .from("program_schedule_items")
      .select("id")
      .eq("organization_id", orgId)
      .eq("offering_id", offeringId)
      .eq("day_of_week", day)
      .eq("start_time", START_TIME)
      .maybeSingle()
    if (existing) continue
    const { error } = await sb.from("program_schedule_items").insert({
      organization_id: orgId,
      program_id: programId,
      offering_id: offeringId,
      title,
      day_of_week: day,
      start_time: START_TIME,
      end_time: END_TIME,
      color: "bg-teal-500",
      is_recurring: true,
    })
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn(`schedule warn (${title}): ${error.message}`)
    }
  }
}

async function ensureContact(sb, orgId, fullName, email, phone, execute, cache, extra = {}) {
  const key = normalizeName(fullName) || `anon:${email || phone || Math.random()}`
  const cacheKey = `${key}|${email || ""}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  if (email) {
    const { data: byEmail } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .eq("email", email)
      .maybeSingle()
    if (byEmail) {
      cache.set(cacheKey, byEmail)
      return byEmail
    }
  }

  const { data: byName } = await sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", orgId)
    .eq("contact_type", "individual")
    .ilike("full_name", fullName)
    .limit(1)
    .maybeSingle()
  if (byName) {
    cache.set(cacheKey, byName)
    return byName
  }

  if (!execute) {
    const placeholder = {
      id: `dry-run:contact:${cacheKey}`,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
    }
    cache.set(cacheKey, placeholder)
    return placeholder
  }

  const { data, error } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      contact_type: "individual",
      status: "active",
    })
    .select("id, full_name, email, phone")
    .single()
  if (error) throw new Error(`contact create (${fullName}): ${error.message}`)
  cache.set(cacheKey, data)
  return data
}

async function ensureFamilyLink(sb, orgId, payer, child, execute) {
  if (!execute) return
  if (String(payer.id).startsWith("dry-run:") || String(child.id).startsWith("dry-run:")) return
  if (payer.id === child.id) return

  let familyId = null
  const { data: asPrimary } = await sb
    .from("families")
    .select("id")
    .eq("organization_id", orgId)
    .eq("primary_contact_id", payer.id)
    .eq("status", "active")
    .maybeSingle()
  if (asPrimary?.id) familyId = asPrimary.id

  if (!familyId) {
    const { data: membership } = await sb
      .from("family_members")
      .select("family_id")
      .eq("organization_id", orgId)
      .eq("contact_id", payer.id)
      .is("end_date", null)
      .limit(1)
      .maybeSingle()
    if (membership?.family_id) familyId = membership.family_id
  }

  if (!familyId) {
    const parentParts = String(payer.full_name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    const lastName =
      parentParts.length > 0 ? parentParts[parentParts.length - 1] : "Household"
    const familyName = lastName
    const { data: family, error } = await sb
      .from("families")
      .insert({
        organization_id: orgId,
        name: familyName,
        primary_contact_id: payer.id,
        status: "active",
      })
      .select("id")
      .single()
    if (error) {
      console.warn(`family create warn: ${error.message}`)
      return
    }
    familyId = family.id
    await sb.from("family_members").insert({
      organization_id: orgId,
      family_id: familyId,
      contact_id: payer.id,
      role: "head",
    })
  }

  const { data: childMember } = await sb
    .from("family_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("family_id", familyId)
    .eq("contact_id", child.id)
    .is("end_date", null)
    .maybeSingle()
  if (!childMember) {
    const { error } = await sb.from("family_members").insert({
      organization_id: orgId,
      family_id: familyId,
      contact_id: child.id,
      role: "child",
    })
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn(`family member warn: ${error.message}`)
    }
  }
}

async function resolveRegistrationOptionId(sb, orgId, offeringId, sessionPlan) {
  if (String(offeringId).startsWith("dry-run:")) return null
  const optionType = sessionPlan.dayPass
    ? "single_session"
    : sessionPlan.weekCount >= 4
      ? "full_program"
      : "selected_sessions"
  const { data } = await sb
    .from("program_registration_options")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("option_type", optionType)
    .maybeSingle()
  return data?.id || null
}

async function upsertEnrollmentAndCharges(sb, ctx) {
  const {
    orgId,
    programId,
    departmentId,
    offering,
    camp,
    sessions,
    registration,
    child,
    payer,
    participant,
    execute,
  } = ctx

  const importKey = createHash("sha1")
    .update(
      `${IMPORT_TAG}|${registration.campKey}|${normalizeName(child.childName)}|${normalizeName(registration.customerName)}`
    )
    .digest("hex")

  const status = registration.cancelled ? "cancelled" : "enrolled"
  const notes = [
    `Imported ${IMPORT_TAG}`,
    registration.couponCode ? `Coupon: ${registration.couponCode}` : null,
    registration.couponClass.type !== "none"
      ? `Coupon type: ${registration.couponClass.type}`
      : null,
    `Sessions: ${registration.sessionPlan.dayPass ? "day pass" : `${registration.sessionPlan.weekCount} week(s)`} (weeks 1–${registration.sessionPlan.weekCount} from start)`,
    registration.cancelled ? "Cancelled: full refund in payment export" : null,
  ]
    .filter(Boolean)
    .join("\n")

  if (!execute) {
    return {
      enrollmentId: `dry-run:enr:${importKey}`,
      chargeId: `dry-run:chg:${importKey}`,
      importKey,
    }
  }

  const optionId = await resolveRegistrationOptionId(
    sb,
    orgId,
    offering.id,
    registration.sessionPlan
  )

  const { data: existingEnroll } = await sb
    .from("program_enrollments")
    .select("id, charge_id")
    .eq("organization_id", orgId)
    .eq("offering_id", offering.id)
    .eq("participant_contact_id", participant.id)
    .maybeSingle()

  let enrollmentId = existingEnroll?.id || null
  let chargeId = existingEnroll?.charge_id || null

  const paymentStatus =
    registration.cancelled || child.assistedFee <= 0.009
      ? "paid"
      : child.amountPaid + 0.009 >= child.assistedFee
        ? "paid"
        : child.amountPaid > 0
          ? "partial"
          : "pending"

  const enrollmentPayload = {
    organization_id: orgId,
    program_id: programId,
    offering_id: offering.id,
    department_id: departmentId,
    registration_option_id: optionId,
    child_name: child.childName,
    participant_contact_id: participant.id,
    registrant_contact_id: payer.id,
    payer_contact_id: payer.id,
    status,
    payment_status: paymentStatus,
    total_amount: child.assistedFee,
    amount_paid: child.amountPaid,
    enrollment_date: registration.enrollmentDate,
    participant_type: "youth",
    registrant_type: "guardian",
    parent_name: registration.customerName,
    parent_email: registration.email || null,
    parent_phone: registration.phone || null,
    notes,
  }

  if (!enrollmentId) {
    const { data: enrollment, error } = await sb
      .from("program_enrollments")
      .insert(enrollmentPayload)
      .select("id")
      .single()
    if (error) throw new Error(`enrollment (${child.childName}): ${error.message}`)
    enrollmentId = enrollment.id
  } else {
    await sb
      .from("program_enrollments")
      .update({
        ...enrollmentPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollmentId)
      .eq("organization_id", orgId)
  }

  const weekCount = Math.min(
    Math.max(registration.sessionPlan.weekCount || 4, 1),
    sessions.length
  )
  const sessionIds = sessions.slice(0, weekCount).map((s) => s.id)
  if (sessionIds.length && !sessionIds[0].startsWith?.("dry-run:")) {
    const { error: accessError } = await sb.rpc("grant_enrollment_session_access", {
      p_organization_id: orgId,
      p_enrollment_id: enrollmentId,
      p_session_ids: sessionIds,
    })
    if (accessError) {
      console.warn(`session access warn (${child.childName}): ${accessError.message}`)
    }
  }

  const chargeStatus =
    registration.cancelled
      ? "paid"
      : child.assistedFee <= 0.009
        ? "paid"
        : child.amountPaid + 0.009 >= child.assistedFee
          ? "paid"
          : child.amountPaid > 0
            ? "partially_paid"
            : "pending_payment"

  const discountTotal = round2(Math.max(child.originalFee - child.assistedFee, 0))
  const firstPaidIso =
    registration.paymentParts.find((p) => p.iso)?.iso ||
    (registration.enrollmentDate ? `${registration.enrollmentDate}T17:00:00Z` : null)

  if (!chargeId) {
    const { data: charge, error } = await sb
      .from("program_charges")
      .insert({
        organization_id: orgId,
        enrollment_id: enrollmentId,
        charge_type: "registration",
        source_type: "manual",
        payer_contact_id: payer.id,
        registrant_contact_id: payer.id,
        participant_contact_id: participant.id,
        program_id: programId,
        offering_id: offering.id,
        currency: "USD",
        subtotal: child.originalFee,
        discount_total: discountTotal,
        total: child.assistedFee,
        due_today: Math.max(round2(child.assistedFee - child.amountPaid), 0),
        amount_paid: child.amountPaid,
        payment_required: child.assistedFee > 0,
        charge_status: chargeStatus,
        checkout_status: child.amountPaid > 0 || child.assistedFee <= 0 ? "paid" : "not_started",
        paid_at: child.amountPaid > 0 || child.assistedFee <= 0 ? firstPaidIso : null,
        metadata: {
          import_tag: IMPORT_TAG,
          import_key: importKey,
          coupon_code: registration.couponCode || null,
          coupon_type: registration.couponClass.type,
          cancelled_full_refund: registration.cancelled,
        },
        quote_snapshot: { import: IMPORT_TAG, camp: camp.key },
      })
      .select("id")
      .single()
    if (error) throw new Error(`charge (${child.childName}): ${error.message}`)
    chargeId = charge.id

    await sb
      .from("program_enrollments")
      .update({ charge_id: chargeId, amount_paid: child.amountPaid })
      .eq("id", enrollmentId)
      .eq("organization_id", orgId)

    const lines = [
      {
        organization_id: orgId,
        charge_id: chargeId,
        line_type: "tuition",
        label: `${camp.offeringName} tuition`,
        quantity: 1,
        unit_amount: child.originalFee,
        amount: child.originalFee,
        sort_order: 0,
      },
    ]
    if (discountTotal > 0) {
      lines.push({
        organization_id: orgId,
        charge_id: chargeId,
        line_type:
          registration.couponClass.type === "financial_assistance"
            ? "financial_assistance"
            : registration.couponClass.type === "staff_credit"
              ? "staff_discount"
              : "discount",
        label: registration.couponCode
          ? `Discount (${registration.couponCode})`
          : "Discount",
        quantity: 1,
        unit_amount: -discountTotal,
        amount: -discountTotal,
        sort_order: 1,
        metadata: {
          import_tag: IMPORT_TAG,
          coupon_type: registration.couponClass.type,
        },
      })
    }
    await sb.from("program_charge_lines").insert(lines)
  } else {
    await sb
      .from("program_charges")
      .update({
        subtotal: child.originalFee,
        discount_total: discountTotal,
        total: child.assistedFee,
        amount_paid: child.amountPaid,
        due_today: Math.max(round2(child.assistedFee - child.amountPaid), 0),
        charge_status: chargeStatus,
        checkout_status: child.amountPaid > 0 || child.assistedFee <= 0 ? "paid" : "not_started",
        paid_at: child.amountPaid > 0 || child.assistedFee <= 0 ? firstPaidIso : null,
        metadata: {
          import_tag: IMPORT_TAG,
          import_key: importKey,
          coupon_code: registration.couponCode || null,
          coupon_type: registration.couponClass.type,
          cancelled_full_refund: registration.cancelled,
        },
      })
      .eq("id", chargeId)
      .eq("organization_id", orgId)
  }

  await sb
    .from("program_charge_schedule")
    .delete()
    .eq("organization_id", orgId)
    .eq("charge_id", chargeId)

  const scheduleRows = []
  if (child.amountPaid > 0.009) {
    const parts =
      registration.paymentParts.length > 0
        ? registration.paymentParts
        : [{ date: registration.enrollmentDate, iso: firstPaidIso, amount: child.amountPaid }]
    const partShares = splitMoneyAcross(child.amountPaid, parts.length)
    parts.forEach((part, index) => {
      scheduleRows.push({
        organization_id: orgId,
        charge_id: chargeId,
        schedule_type: "custom",
        label: `Payment ${part.date || index + 1}`,
        due_date: part.date || registration.enrollmentDate,
        amount: partShares[index] || 0,
        sequence_number: index + 1,
        status: "paid",
        charge_category: "tuition",
        paid_at: part.iso || (part.date ? `${part.date}T17:00:00Z` : firstPaidIso),
        metadata: { import_tag: IMPORT_TAG },
      })
    })
  } else if (child.assistedFee > 0.009 && !registration.cancelled) {
    scheduleRows.push({
      organization_id: orgId,
      charge_id: chargeId,
      schedule_type: "custom",
      label: "Camp tuition",
      due_date: registration.enrollmentDate || camp.start,
      amount: child.assistedFee,
      sequence_number: 1,
      status: "scheduled",
      charge_category: "tuition",
      metadata: { import_tag: IMPORT_TAG },
    })
  }

  if (scheduleRows.length) {
    const { error: scheduleError } = await sb.from("program_charge_schedule").insert(scheduleRows)
    if (scheduleError) {
      console.warn(`schedule warn (${child.childName}): ${scheduleError.message}`)
    }
  }

  // Childcare addon charge on primary child only
  if (
    child.isPrimaryForChildcare &&
    (registration.addOnsAmount > 0 || registration.netChildcare > 0) &&
    !registration.cancelled
  ) {
    const childcareTotal = registration.addOnsAmount || registration.netChildcare
    const childcarePaid = Math.max(registration.netChildcare, 0)
    const { data: existingAddon } = await sb
      .from("program_charges")
      .select("id")
      .eq("organization_id", orgId)
      .eq("enrollment_id", enrollmentId)
      .eq("charge_type", "addon")
      .maybeSingle()

    let addonId = existingAddon?.id || null
    const addonStatus =
      childcarePaid + 0.009 >= childcareTotal
        ? "paid"
        : childcarePaid > 0
          ? "partially_paid"
          : "pending_payment"

    if (!addonId) {
      const { data: addon, error: addonError } = await sb
        .from("program_charges")
        .insert({
          organization_id: orgId,
          enrollment_id: enrollmentId,
          charge_type: "addon",
          source_type: "manual",
          payer_contact_id: payer.id,
          registrant_contact_id: payer.id,
          participant_contact_id: participant.id,
          program_id: programId,
          offering_id: offering.id,
          currency: "USD",
          subtotal: childcareTotal,
          discount_total: 0,
          total: childcareTotal,
          due_today: Math.max(round2(childcareTotal - childcarePaid), 0),
          amount_paid: childcarePaid,
          payment_required: true,
          charge_status: addonStatus,
          checkout_status: childcarePaid > 0 ? "paid" : "not_started",
          paid_at:
            childcarePaid > 0
              ? registration.childcareParts.find((p) => p.iso)?.iso || firstPaidIso
              : null,
          metadata: {
            import_tag: IMPORT_TAG,
            addon_kind: "childcare",
            covers_children: registration.members,
          },
          quote_snapshot: { import: IMPORT_TAG, addon: "childcare" },
        })
        .select("id")
        .single()
      if (addonError) {
        console.warn(`childcare charge warn (${child.childName}): ${addonError.message}`)
      } else {
        addonId = addon.id
        await sb.from("program_charge_lines").insert({
          organization_id: orgId,
          charge_id: addonId,
          line_type: "addon",
          label: "Childcare (camp add-on)",
          quantity: 1,
          unit_amount: childcareTotal,
          amount: childcareTotal,
          sort_order: 0,
          metadata: { import_tag: IMPORT_TAG, addon_kind: "childcare" },
        })
      }
    }

    if (addonId) {
      await sb
        .from("program_charge_schedule")
        .delete()
        .eq("organization_id", orgId)
        .eq("charge_id", addonId)
      if (childcarePaid > 0.009) {
        await sb.from("program_charge_schedule").insert({
          organization_id: orgId,
          charge_id: addonId,
          schedule_type: "custom",
          label: "Childcare payment",
          due_date: registration.enrollmentDate || camp.start,
          amount: childcarePaid,
          sequence_number: 1,
          status: "paid",
          charge_category: "addon",
          paid_at:
            registration.childcareParts.find((p) => p.iso)?.iso || firstPaidIso,
          metadata: { import_tag: IMPORT_TAG },
        })
      }
    }
  }

  if (registration.couponClass.type === "financial_assistance" && !registration.cancelled) {
    await sb
      .from("program_enrollment_fa_awards")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("enrollment_id", enrollmentId)
      .eq("status", "active")

    const { error: faError } = await sb.from("program_enrollment_fa_awards").insert({
      organization_id: orgId,
      enrollment_id: enrollmentId,
      program_id: programId,
      offering_id: offering.id,
      participant_contact_id: participant.id,
      participant_name: child.childName,
      original_amount: child.originalFee,
      assisted_amount: child.assistedFee,
      discount_amount: round2(Math.max(child.originalFee - child.assistedFee, 0)),
      plan_type: "total_fee",
      note: `Imported ${IMPORT_TAG}; coupon ${registration.couponCode}`,
      status: "active",
    })
    if (faError) {
      console.warn(`FA award warn (${child.childName}): ${faError.message}`)
    }
  }

  return { enrollmentId, chargeId, importKey }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY-RUN"}`)
  console.log(`CSV: ${args.csv}`)
  console.log(`Org: ${args.orgId}`)

  const rows = loadPayments(args.csv)
  const plan = buildPlan(rows)

  const stamp = new Date().toISOString().slice(0, 10)
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(reportDir, `summer-camps-2026-import-${stamp}.json`)

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    phase: 1,
    phaseNote:
      "Payments CSV only. Master roster / staff payroll / expenses come in later phases.",
    calendars: plan.calendars,
    totals: plan.totals,
    couponBreakdown: plan.couponBreakdown,
    skippedNoMembers: plan.skippedNoMembers,
    sampleRegistrations: plan.registrations.slice(0, 25).map((r) => ({
      customerName: r.customerName,
      email: r.email,
      campKey: r.campKey,
      members: r.members,
      couponCode: r.couponCode,
      couponType: r.couponClass.type,
      sessionPlan: r.sessionPlan,
      subscriptionFees: r.subscriptionFees,
      addOnsAmount: r.addOnsAmount,
      netTuition: r.netTuition,
      netChildcare: r.netChildcare,
      cancelled: r.cancelled,
      children: r.children,
    })),
    staffCreditQueue: plan.registrations
      .filter((r) => r.couponClass.type === "staff_credit")
      .map((r) => ({
        customerName: r.customerName,
        email: r.email,
        campKey: r.campKey,
        members: r.members,
        couponCode: r.couponCode,
        couponValue: r.couponValue,
        subscriptionFees: r.subscriptionFees,
        netTuition: r.netTuition,
      })),
    created: {
      departmentId: null,
      programId: null,
      offerings: 0,
      sessions: 0,
      contacts: 0,
      enrollments: 0,
      faAwards: 0,
      cancelled: 0,
    },
  }

  if (!args.execute) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log("\n=== DRY-RUN SUMMARY ===")
    console.log(JSON.stringify(plan.totals, null, 2))
    console.log("\nCalendars (Mon–Thu 11:00–16:00):")
    for (const cal of plan.calendars) {
      console.log(`  ${cal.offeringName}: ${cal.start} → ${cal.end}`)
      for (const w of cal.weeks) {
        console.log(`    ${w.name}: ${w.start} → ${w.end}`)
      }
    }
    console.log("\nTop coupons:")
    for (const [code, count] of Object.entries(plan.couponBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)) {
      console.log(`  ${code}: ${count}`)
    }
    console.log(`\nStaff-credit groups (payroll phase later): ${report.staffCreditQueue.length}`)
    console.log(`Report: ${reportPath}`)
    console.log("Re-run with --execute to write to Supabase.")
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const orgId = args.orgId

  const department = await ensureDepartment(sb, orgId, true)
  const program = await ensureYearProgram(sb, orgId, department.id, true)
  report.created.departmentId = department.id
  report.created.programId = program.id

  const offeringCache = new Map()
  const sessionCache = new Map()
  const contactCache = new Map()
  const sessionsByCamp = new Map()

  for (const camp of CAMPS) {
    const offering = await ensureOffering(sb, orgId, program.id, camp, true, offeringCache)
    report.created.offerings += 1
    await ensureRegistrationOptions(sb, orgId, program.id, offering.id, true)
    const sessions = await ensureSessions(
      sb,
      orgId,
      program.id,
      offering.id,
      camp,
      true,
      sessionCache
    )
    sessionsByCamp.set(camp.key, sessions)
    report.created.sessions += sessions.length
    await ensureWeeklySchedule(sb, orgId, program.id, offering.id, camp, true)
  }

  for (const registration of plan.registrations) {
    const camp = CAMPS.find((c) => c.key === registration.campKey)
    const offering = offeringCache.get(registration.campKey)
    const sessions = sessionsByCamp.get(registration.campKey) || []

    const payer = await ensureContact(
      sb,
      orgId,
      registration.customerName,
      registration.email,
      registration.phone,
      true,
      contactCache
    )
    report.created.contacts += 1

    for (const child of registration.children) {
      const participant = await ensureContact(
        sb,
        orgId,
        child.childName,
        null,
        null,
        true,
        contactCache
      )
      report.created.contacts += 1
      await ensureFamilyLink(sb, orgId, payer, participant, true)

      await upsertEnrollmentAndCharges(sb, {
        orgId,
        programId: program.id,
        departmentId: department.id,
        offering,
        camp,
        sessions,
        registration,
        child,
        payer,
        participant,
        execute: true,
      })
      report.created.enrollments += 1
      if (registration.cancelled) report.created.cancelled += 1
      if (registration.couponClass.type === "financial_assistance") {
        report.created.faAwards += 1
      }
    }
  }

  let affiliationsSynced = 0
  for (const contact of contactCache.values()) {
    if (!contact?.id || String(contact.id).startsWith("dry-run:")) continue
    const { error: syncError } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: contact.id,
    })
    if (syncError) {
      console.warn(`affiliation sync failed (${contact.full_name}):`, syncError.message)
      continue
    }
    affiliationsSynced += 1
  }
  report.created.affiliationsSynced = affiliationsSynced

  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log("\n=== EXECUTE COMPLETE ===")
  console.log(JSON.stringify(report.created, null, 2))
  console.log(`Report: ${reportPath}`)
  console.log(`Open Workforce → Departments → ${department.name}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
