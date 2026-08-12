/**
 * Fix QIL 2026–27 imported applications: replace Arabic names with English
 * names from existing contacts / prior QIL enrollments / payment export.
 * Prefer matching by email (exact + local-part) and phone; avoid duplicates.
 *
 * Usage:
 *   node scripts/fix-qil-2026-2027-english-names.mjs
 *   node scripts/fix-qil-2026-2027-english-names.mjs --execute
 */
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const require = createRequire(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_2026_27_APPS_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "78616758-d6fc-4a48-a99c-f8ea24a34646"
const PRIOR_PROGRAM_ID = "88a39883-baa8-424b-91c0-93a309978c3b"
const DEFAULT_PAYMENTS = "c:/Users/danan/Downloads/QIL25-26_Payments.csv"

/** When email/phone miss but a unique English contact already exists. */
const NAME_ALIASES = {
  "ازال علي الحرازي": "Azal Alharazi",
  "إسراء لطيف محمد الإعميري": "Israa Alaomairi",
  "بسمة احمد علي": "Basma Ali",
  "سناء محمود حمدان": "Sana Hamdan",
  "وفاء يرو": "Wafaa Yarro",
  "سمية بوهلال": "Soumia Bouhlal",
  "منى عبد الله النعيمى": "Mona Alnaeemi",
  "إيمان لطرش": "Imene Latrehe",
  "أسماء إسماعيل علي محمد": "Asmaa Ali Ismail Mohamed",
  // No separate English contact found — transliterate in place (same contact).
  "ايمان عماد الحرازنه": "Eman Emad Alharazna",
  "رولا هاشم صبري": "Rula Hashim Sabri",
  "علا محمد وليد الخوصي": "Viola Mohamed Alkhousi",
  "نسرين محمد المراغي": "Nisreen Mohamed Almaraghi",
  "وئام محمد ثابت": "Weam Mohamed Thabet",
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
    execute: false,
    orgId: DEFAULT_ORG_ID,
    payments: DEFAULT_PAYMENTS,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
    else if (argv[i] === "--payments") args.payments = argv[++i]
  }
  return args
}

function hasNonAscii(value) {
  return /[^\x00-\x7F]/.test(String(value || ""))
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
}

function emailLocalPart(value) {
  const email = normalizeEmail(value)
  const at = email.indexOf("@")
  return at > 0 ? email.slice(0, at) : ""
}

function phoneDigits(value) {
  return String(value || "").replace(/[^0-9]/g, "")
}

function phoneLast10(value) {
  const digits = phoneDigits(value)
  if (digits.length >= 10) return digits.slice(-10)
  return digits.length >= 7 ? digits : ""
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isPersonLikeName(name) {
  const text = String(name || "").trim()
  if (!text || hasNonAscii(text)) return false
  if (/quran\s*institute|vendor|bazaar|booth|organization|mas\s/i.test(text)) {
    return false
  }
  if (/^\d+$/.test(text)) return false
  const parts = text.split(/\s+/).filter(Boolean)
  return parts.length >= 2
}

function titleCaseName(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

async function fetchAll(sb, table, select, applyFilter) {
  const pageSize = 1000
  let from = 0
  const out = []
  for (;;) {
    let query = sb.from(table).select(select).range(from, from + pageSize - 1)
    if (applyFilter) query = applyFilter(query)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return out
}

function loadPaymentHints(path) {
  const byEmail = new Map()
  const byPhone = new Map()
  if (!path || !existsSync(path)) return { byEmail, byPhone }
  const text = readFileSync(path, "utf8")
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  for (const row of parsed.data || []) {
    const name = String(row["Customer Name"] || "").trim()
    const email = normalizeEmail(row["Customer Email"])
    const phone = phoneLast10(row["Customer Phone"])
    if (!name || hasNonAscii(name)) continue
    if (email && !byEmail.has(email)) byEmail.set(email, name)
    if (phone && !byPhone.has(phone)) byPhone.set(phone, name)
  }
  return { byEmail, byPhone }
}

function findContactByEnglishName(allContacts, englishName) {
  const target = normalizeName(englishName)
  if (!target) return null
  const exact = allContacts.filter(
    (c) => !hasNonAscii(c.full_name) && normalizeName(c.full_name) === target
  )
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) {
    return exact.sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
    )[0]
  }
  // soft: first+last match
  const parts = target.split(" ")
  if (parts.length < 2) return null
  const soft = allContacts.filter((c) => {
    if (hasNonAscii(c.full_name)) return false
    const n = normalizeName(c.full_name).split(" ")
    return n[0] === parts[0] && n[n.length - 1] === parts[parts.length - 1]
  })
  return soft.length === 1 ? soft[0] : null
}

function pickPersonContact(candidates, excludeId) {
  return (candidates || [])
    .filter((c) => c.id !== excludeId && isPersonLikeName(c.full_name))
    .sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
    )[0] || null
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const apps = await fetchAll(
    sb,
    "program_applications",
    "id, participant_name, registrant_contact_id, participant_contact_id, applicant_type, evaluation_notes",
    (q) =>
      q
        .eq("organization_id", args.orgId)
        .eq("program_id", PROGRAM_ID)
        .ilike("evaluation_notes", `%${IMPORT_TAG}%`)
  )

  const appContactIds = [
    ...new Set(
      apps.flatMap((a) =>
        [a.registrant_contact_id, a.participant_contact_id].filter(Boolean)
      )
    ),
  ]
  const { data: appContacts, error: appContactsError } = await sb
    .from("contacts")
    .select("id, full_name, email, phone, created_at")
    .in("id", appContactIds)
  if (appContactsError) throw new Error(appContactsError.message)
  const contactById = new Map((appContacts || []).map((c) => [c.id, c]))

  const allContacts = await fetchAll(
    sb,
    "contacts",
    "id, full_name, email, phone, created_at",
    (q) =>
      q.eq("organization_id", args.orgId).eq("contact_type", "individual")
  )

  const byEmail = new Map()
  const byEmailLocal = new Map()
  const byPhone = new Map()
  for (const contact of allContacts) {
    const email = normalizeEmail(contact.email)
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, [])
      byEmail.get(email).push(contact)
      const local = emailLocalPart(email)
      if (local) {
        if (!byEmailLocal.has(local)) byEmailLocal.set(local, [])
        byEmailLocal.get(local).push(contact)
      }
    }
    const phone = phoneLast10(contact.phone)
    if (phone) {
      if (!byPhone.has(phone)) byPhone.set(phone, [])
      byPhone.get(phone).push(contact)
    }
  }

  const enrollments = await fetchAll(
    sb,
    "program_enrollments",
    "child_name, parent_email, parent_phone, participant_contact_id, registrant_contact_id",
    (q) => q.eq("organization_id", args.orgId).eq("program_id", PRIOR_PROGRAM_ID)
  )
  const enrollmentByEmail = new Map()
  const enrollmentByPhone = new Map()
  for (const row of enrollments) {
    const english = String(row.child_name || "").trim()
    if (!english || hasNonAscii(english)) continue
    const email = normalizeEmail(row.parent_email)
    const phone = phoneLast10(row.parent_phone)
    const hint = {
      englishName: english,
      contactId: row.participant_contact_id || row.registrant_contact_id,
    }
    if (email && !enrollmentByEmail.has(email)) enrollmentByEmail.set(email, hint)
    if (phone && !enrollmentByPhone.has(phone)) enrollmentByPhone.set(phone, hint)
  }

  const payments = loadPaymentHints(args.payments)

  const arabicApps = apps.filter((a) => hasNonAscii(a.participant_name))
  const plan = []
  const orphanArabicContactIds = new Set()
  const contactRenames = new Map() // contactId -> english name

  for (const app of arabicApps) {
    const current = contactById.get(app.registrant_contact_id)
    if (!current) {
      plan.push({
        appId: app.id,
        action: "missing_contact",
        from: app.participant_name,
      })
      continue
    }

    if (isPersonLikeName(current.full_name)) {
      plan.push({
        appId: app.id,
        action: "rename_app",
        from: app.participant_name,
        to: current.full_name,
        contactId: current.id,
        via: "same_contact",
      })
      continue
    }

    const email = normalizeEmail(current.email)
    const local = emailLocalPart(email)
    const phone = phoneLast10(current.phone)

    let englishContact =
      pickPersonContact(email ? byEmail.get(email) : [], current.id) ||
      pickPersonContact(local ? byEmailLocal.get(local) : [], current.id) ||
      pickPersonContact(phone ? byPhone.get(phone) : [], current.id)

    let via = null
    if (englishContact) {
      if (email && (byEmail.get(email) || []).some((c) => c.id === englishContact.id)) {
        via = "email"
      } else if (
        local &&
        (byEmailLocal.get(local) || []).some((c) => c.id === englishContact.id)
      ) {
        via = "email_local"
      } else {
        via = "phone"
      }
    }

    // Prior-year enrollment English name + contact
    const enrollmentHint =
      (email && enrollmentByEmail.get(email)) ||
      (phone && enrollmentByPhone.get(phone)) ||
      null
    if (!englishContact && enrollmentHint?.contactId) {
      const hinted = allContacts.find((c) => c.id === enrollmentHint.contactId)
      if (hinted) {
        englishContact = hinted
        via = "prior_enrollment_contact"
        if (!isPersonLikeName(hinted.full_name) && enrollmentHint.englishName) {
          contactRenames.set(hinted.id, enrollmentHint.englishName)
        }
      }
    }

    // Payment export English name → find contact
    const paymentName =
      (email && payments.byEmail.get(email)) ||
      (phone && payments.byPhone.get(phone)) ||
      null
    if (!englishContact && paymentName) {
      englishContact = findContactByEnglishName(allContacts, paymentName)
      via = englishContact ? "payment_name" : via
    }

    // Explicit Arabic → English alias to existing contact
    const aliasName = NAME_ALIASES[app.participant_name]
    if (!englishContact && aliasName) {
      englishContact = findContactByEnglishName(allContacts, aliasName)
      via = englishContact ? "name_alias" : via
    }

    // Enrollment / payment / alias can supply English display name even without
    // a separate contact — rename the current Arabic contact in place.
    const englishName =
      (englishContact && isPersonLikeName(englishContact.full_name)
        ? englishContact.full_name
        : null) ||
      (englishContact && contactRenames.get(englishContact.id)) ||
      enrollmentHint?.englishName ||
      paymentName ||
      aliasName ||
      null

    if (englishContact && englishContact.id !== current.id && englishName) {
      plan.push({
        appId: app.id,
        action: "repoint_contact",
        from: app.participant_name,
        to: englishName,
        oldContactId: current.id,
        newContactId: englishContact.id,
        via,
        oldEmail: current.email,
        newEmail: englishContact.email,
        oldPhone: current.phone,
        newPhone: englishContact.phone,
        copyEmail: !englishContact.email && current.email ? current.email : null,
        copyPhone: !englishContact.phone && current.phone ? current.phone : null,
      })
      orphanArabicContactIds.add(current.id)
      continue
    }

    if (englishName) {
      plan.push({
        appId: app.id,
        action: "rename_contact_and_app",
        from: app.participant_name,
        to: titleCaseName(englishName),
        contactId: current.id,
        via: via || (paymentName ? "payment_rename" : aliasName ? "alias_rename" : "enrollment_rename"),
      })
      continue
    }

    plan.push({
      appId: app.id,
      action: "unmatched",
      from: app.participant_name,
      contactId: current.id,
      email: current.email,
      phone: current.phone,
      type: app.applicant_type,
    })
  }

  const counts = plan.reduce((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1
    return acc
  }, {})

  console.log(`Apps tagged ${IMPORT_TAG}: ${apps.length}`)
  console.log(`Arabic participant names: ${arabicApps.length}`)
  console.log("Plan:", counts)
  console.log(
    "Repoint sample:",
    plan.filter((p) => p.action === "repoint_contact").slice(0, 12)
  )
  console.log(
    "Rename contact+app:",
    plan.filter((p) => p.action === "rename_contact_and_app")
  )
  console.log(
    "Unmatched:",
    plan.filter((p) => p.action === "unmatched")
  )
  console.log("Contact renames (bad English labels):", [...contactRenames.entries()])

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(
    reportDir,
    `qil-2026-2027-english-names-${args.execute ? "execute" : "dry-run"}.json`
  )
  writeFileSync(
    reportPath,
    JSON.stringify(
      { execute: args.execute, counts, contactRenames: [...contactRenames], plan },
      null,
      2
    )
  )
  console.log(`Report: ${reportPath}`)

  if (!args.execute) {
    console.log("\nDry-run only. Re-run with --execute to apply.")
    return
  }

  // Fix known bad contact labels first (e.g. Quran Institute 17 → Imene Latrehe)
  for (const [contactId, englishName] of contactRenames) {
    const { error } = await sb
      .from("contacts")
      .update({ full_name: englishName, updated_at: new Date().toISOString() })
      .eq("id", contactId)
    if (error) throw new Error(`contact rename ${contactId}: ${error.message}`)
  }

  let renamedApps = 0
  let renamedContacts = 0
  let repointed = 0

  for (const item of plan) {
    if (item.action === "rename_app") {
      const { error } = await sb
        .from("program_applications")
        .update({
          participant_name: item.to,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.appId)
      if (error) throw new Error(`rename app ${item.appId}: ${error.message}`)
      renamedApps += 1
    } else if (item.action === "rename_contact_and_app") {
      const { error: cErr } = await sb
        .from("contacts")
        .update({ full_name: item.to, updated_at: new Date().toISOString() })
        .eq("id", item.contactId)
      if (cErr) throw new Error(`rename contact ${item.contactId}: ${cErr.message}`)
      renamedContacts += 1
      const { error } = await sb
        .from("program_applications")
        .update({
          participant_name: item.to,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.appId)
      if (error) throw new Error(`rename app ${item.appId}: ${error.message}`)
      renamedApps += 1
    } else if (item.action === "repoint_contact") {
      if (item.copyEmail || item.copyPhone) {
        const patch = { updated_at: new Date().toISOString() }
        if (item.copyEmail) patch.email = item.copyEmail
        if (item.copyPhone) patch.phone = item.copyPhone
        const { error: patchErr } = await sb
          .from("contacts")
          .update(patch)
          .eq("id", item.newContactId)
        if (patchErr) {
          console.warn(
            `Could not copy contact info to ${item.newContactId}: ${patchErr.message}`
          )
        }
      }
      const { error } = await sb
        .from("program_applications")
        .update({
          participant_name: item.to,
          registrant_contact_id: item.newContactId,
          participant_contact_id: item.newContactId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.appId)
      if (error) throw new Error(`repoint ${item.appId}: ${error.message}`)
      repointed += 1
    }
  }

  let deletedContacts = 0
  for (const contactId of orphanArabicContactIds) {
    const { data: stillApps } = await sb
      .from("program_applications")
      .select("id")
      .or(
        `registrant_contact_id.eq.${contactId},participant_contact_id.eq.${contactId}`
      )
      .limit(1)
    if ((stillApps || []).length > 0) continue

    const { data: stillEnrollments } = await sb
      .from("program_enrollments")
      .select("id")
      .or(
        `registrant_contact_id.eq.${contactId},participant_contact_id.eq.${contactId}`
      )
      .limit(1)
    if ((stillEnrollments || []).length > 0) continue

    const contact = allContacts.find((c) => c.id === contactId)
    if (!contact || !hasNonAscii(contact.full_name)) continue

    const { error } = await sb.from("contacts").delete().eq("id", contactId)
    if (error) {
      console.warn(`Could not delete contact ${contactId}: ${error.message}`)
      continue
    }
    deletedContacts += 1
  }

  console.log(
    `\nDone. Renamed apps: ${renamedApps}, renamed contacts: ${renamedContacts}, repointed: ${repointed}, deleted Arabic duplicates: ${deletedContacts}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
