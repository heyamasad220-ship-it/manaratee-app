/**
 * Link donors without a valid People contact so they appear under
 * Contacts → People with the Donor filter and open canonical contact profiles.
 *
 * Targets donors where contact_id IS NULL or points at a deleted contact row.
 * For each orphan donor with at least one non-voided payment:
 * 1. Match an existing contact by email, phone, or normalized name
 * 2. If the contact already has a donor row → merge orphan into that donor
 * 3. Otherwise link donor.contact_id and set payments.contact_id
 * 4. If no match → create contact via find_or_create_contact_for_org
 * 5. sync_contact_affiliations for each affected contact
 * 6. Backfill payments.contact_id from donor.contact_id where still null
 *
 * Run before or with sync-donor-affiliations.mjs for full People donor coverage.
 *
 * Usage:
 *   node scripts/link-orphan-donors-to-contacts.mjs
 *   node scripts/link-orphan-donors-to-contacts.mjs --execute
 *   node scripts/link-orphan-donors-to-contacts.mjs --org <uuid> --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

function parseArgs(argv) {
  const args = { orgId: DEFAULT_ORG_ID }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--org") args.orgId = argv[++index]
  }
  return args
}

function loadEnv() {
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

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase() || null
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(queryFn) {
  const rows = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await queryFn(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

function buildContactIndex(contacts) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byName = new Map()

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = normalizeName(contact.full_name)

    if (email && !byEmail.has(email)) byEmail.set(email, contact.id)
    if (phone && !byPhone.has(phone)) byPhone.set(phone, contact.id)
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, contact.id)
  }

  return { byEmail, byPhone, byName }
}

function matchContactId(donor, index) {
  const email = normalizeEmail(donor.email)
  const phone = normalizePhone(donor.phone)
  const nameKey = normalizeName(donor.full_name)

  if (email && index.byEmail.has(email)) return index.byEmail.get(email)
  if (phone && index.byPhone.has(phone)) return index.byPhone.get(phone)
  if (nameKey && index.byName.has(nameKey)) return index.byName.get(nameKey)
  return null
}

async function findOrCreateContact(orgId, donor) {
  const fullName = String(donor.full_name || "").trim() || "Unnamed Donor"
  const contactType = donor.donor_type === "organization" ? "organization" : "individual"

  const { data: contactId, error } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: fullName,
    p_email: normalizeEmail(donor.email),
    p_phone: normalizePhone(donor.phone) || null,
    p_contact_type: contactType,
  })

  if (error || !contactId) {
    throw new Error(error?.message || `Could not create contact for donor ${donor.id}`)
  }

  return contactId
}

async function mergeDonorIntoTarget(orgId, sourceDonorId, targetDonorId, contactId) {
  const paymentPatch = { donor_id: targetDonorId, contact_id: contactId }
  const pledgePatch = { donor_id: targetDonorId }

  for (const table of ["payments", "pledges", "recurring_donation_plans"]) {
    const { error } = await sb
      .from(table)
      .update(table === "payments" ? paymentPatch : pledgePatch)
      .eq("organization_id", orgId)
      .eq("donor_id", sourceDonorId)

    if (error && error.code !== "42P01") {
      throw new Error(`${table} merge (${sourceDonorId} → ${targetDonorId}): ${error.message}`)
    }
  }

  const { error: deleteError } = await sb.from("donors").delete().eq("id", sourceDonorId)
  if (deleteError) {
    throw new Error(`donor delete (${sourceDonorId}): ${deleteError.message}`)
  }
}

async function linkDonorToContact(orgId, donorId, contactId) {
  const { error: donorError } = await sb
    .from("donors")
    .update({ contact_id: contactId })
    .eq("organization_id", orgId)
    .eq("id", donorId)

  if (donorError) {
    throw new Error(`donor link (${donorId}): ${donorError.message}`)
  }

  const { error: paymentError } = await sb
    .from("payments")
    .update({ contact_id: contactId })
    .eq("organization_id", orgId)
    .eq("donor_id", donorId)
    .is("contact_id", null)

  if (paymentError) {
    throw new Error(`payments contact link (${donorId}): ${paymentError.message}`)
  }
}

async function syncAffiliation(orgId, contactId) {
  const { error } = await sb.rpc("sync_contact_affiliations", {
    p_organization_id: orgId,
    p_contact_id: contactId,
  })
  if (error) {
    throw new Error(`sync_contact_affiliations (${contactId}): ${error.message}`)
  }
}

async function donorHasNonVoidedPayment(orgId, donorId) {
  const { count, error } = await sb
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("donor_id", donorId)
    .neq("status", "voided")

  if (error) throw error
  return (count ?? 0) > 0
}

async function backfillPaymentContactIds(orgId, execute) {
  if (!execute) {
    const { count, error } = await sb
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("contact_id", null)
      .neq("status", "voided")
      .not("donor_id", "is", null)

    if (error) throw error
    return { wouldBackfill: count ?? 0, backfilled: 0 }
  }

  const donorsWithContact = await fetchAll((from, to) =>
    sb
      .from("donors")
      .select("id, contact_id")
      .eq("organization_id", orgId)
      .not("contact_id", "is", null)
      .range(from, to)
  )

  let backfilled = 0
  for (const donor of donorsWithContact) {
    const { count, error } = await sb
      .from("payments")
      .update({ contact_id: donor.contact_id })
      .eq("organization_id", orgId)
      .eq("donor_id", donor.id)
      .is("contact_id", null)
      .neq("status", "voided")
      .select("id", { count: "exact", head: true })

    if (error) throw error
    backfilled += count ?? 0
  }

  return { wouldBackfill: backfilled, backfilled }
}

async function main() {
  const { orgId } = parseArgs(process.argv.slice(2))

  const [contacts, donors, allDonors] = await Promise.all([
    fetchAll((from, to) =>
      sb
        .from("contacts")
        .select("id, full_name, email, phone, contact_type")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
    fetchAll((from, to) =>
      sb
        .from("donors")
        .select("id, contact_id, full_name, email, phone, donor_type")
        .eq("organization_id", orgId)
        .not("contact_id", "is", null)
        .range(from, to)
    ),
    fetchAll((from, to) =>
      sb
        .from("donors")
        .select("id, contact_id, full_name, email, phone, donor_type")
        .eq("organization_id", orgId)
        .range(from, to)
    ),
  ])

  const existingContactIds = new Set(contacts.map((row) => row.id))
  const orphanDonors = allDonors.filter(
    (row) => !row.contact_id || !existingContactIds.has(row.contact_id)
  )

  const contactIndex = buildContactIndex(contacts)
  const donorByContactId = new Map(
    donors.map((row) => [row.contact_id, row.id])
  )

  const report = {
    generatedAt: new Date().toISOString(),
    orgId,
    execute,
    orphanDonorsScanned: orphanDonors.length,
    brokenContactLinks: orphanDonors.filter((row) => row.contact_id).length,
    linked: 0,
    merged: 0,
    contactsCreated: 0,
    matchedExistingContact: 0,
    skippedNoPayments: 0,
    affiliationsSynced: 0,
    paymentContactBackfill: null,
    errors: [],
    samples: [],
  }

  const syncedContacts = new Set()

  for (const donor of orphanDonors) {
    const hasPayments = await donorHasNonVoidedPayment(orgId, donor.id)
    if (!hasPayments) {
      report.skippedNoPayments += 1
      continue
    }

    try {
      let contactId = matchContactId(donor, contactIndex)
      let createdContact = false

      if (contactId) {
        report.matchedExistingContact += 1
      } else {
        if (!execute) {
          report.contactsCreated += 1
          report.linked += 1
          if (report.samples.length < 10) {
            report.samples.push({
              donorId: donor.id,
              donorName: donor.full_name,
              action: "would_create_contact_and_link",
            })
          }
          continue
        }

        contactId = await findOrCreateContact(orgId, donor)
        createdContact = true
        report.contactsCreated += 1

        contactIndex.byName.set(normalizeName(donor.full_name), contactId)
        const email = normalizeEmail(donor.email)
        const phone = normalizePhone(donor.phone)
        if (email) contactIndex.byEmail.set(email, contactId)
        if (phone) contactIndex.byPhone.set(phone, contactId)
      }

      if (!execute) {
        const existingDonorId = donorByContactId.get(contactId)
        report[existingDonorId ? "merged" : "linked"] += 1
        if (report.samples.length < 10) {
          report.samples.push({
            donorId: donor.id,
            donorName: donor.full_name,
            contactId,
            action: existingDonorId ? "would_merge_into_existing_donor" : "would_link",
          })
        }
        continue
      }

      const existingDonorId = donorByContactId.get(contactId)

      if (existingDonorId && existingDonorId !== donor.id) {
        await mergeDonorIntoTarget(orgId, donor.id, existingDonorId, contactId)
        report.merged += 1
      } else {
        await linkDonorToContact(orgId, donor.id, contactId)
        donorByContactId.set(contactId, donor.id)
        report.linked += 1
      }

      if (!syncedContacts.has(contactId)) {
        await syncAffiliation(orgId, contactId)
        syncedContacts.add(contactId)
        report.affiliationsSynced += 1
      }

      if (report.samples.length < 10) {
        report.samples.push({
          donorId: donor.id,
          donorName: donor.full_name,
          contactId,
          createdContact,
          action: existingDonorId ? "merged" : "linked",
        })
      }
    } catch (error) {
      report.errors.push({
        donorId: donor.id,
        donorName: donor.full_name,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    report.paymentContactBackfill = await backfillPaymentContactIds(orgId, execute)
  } catch (error) {
    report.errors.push({
      stage: "payment_contact_backfill",
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(
    reportsDir,
    `link-orphan-donors-to-contacts-${new Date().toISOString().slice(0, 10)}.json`
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  if (!execute) {
    console.log("\nDry run only. Re-run with --execute to create/link contacts.")
  } else {
    console.log(`\nDone. Report: ${reportPath}`)
    console.log("Tip: run node scripts/sync-donor-affiliations.mjs --execute for any remaining tags.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
