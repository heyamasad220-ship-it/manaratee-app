/**
 * Enrich Summer Camp 2026 parents from the registration roster CSV:
 * phone, address, emergency-contact notes, and spouse/household links.
 *
 * Only fills empty contact fields. Does not overwrite existing values.
 *
 * Usage:
 *   node scripts/enrich-summer-camp-parents-from-roster.mjs
 *   node scripts/enrich-summer-camp-parents-from-roster.mjs --execute
 *   node scripts/enrich-summer-camp-parents-from-roster.mjs --csv "C:/Users/danan/Downloads/Summer Camp 2026.csv" --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "e6436c28-666c-4327-b3c1-4234d2379a42"
const DEFAULT_CSV = "C:/Users/danan/Downloads/Summer Camp 2026.csv"
const NOTE_MARKER = "Summer Camp 2026 emergency contacts"

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

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  return process.argv[idx + 1] || null
}

function normEmail(value) {
  const raw = String(value || "")
    .toLowerCase()
    .trim()
  if (!raw || raw === "undefined" || !raw.includes("@")) return null
  return raw
}

function digitsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  if (digits.length === 10) return digits
  return digits.length >= 10 ? digits.slice(-10) : null
}

function formatPhone(digits) {
  if (!digits || digits.length !== 10) return null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Parse "phone,email,address..." blobs from the roster. */
function parseEmergencyBlob(raw) {
  const text = String(raw || "").trim()
  if (!text || text === ", ," || text === ",,") return null

  const parts = text.split(",").map((p) => p.trim())
  let phone = null
  let email = null
  const addressParts = []

  for (const part of parts) {
    if (!part || part.toLowerCase() === "undefined") continue
    if (!phone && digitsPhone(part)) {
      phone = formatPhone(digitsPhone(part))
      continue
    }
    if (!email && part.includes("@")) {
      email = normEmail(part)
      continue
    }
    addressParts.push(part)
  }

  const addressRaw = addressParts.join(", ").trim()
  if (!phone && !email && !addressRaw) return null

  return {
    phone,
    email,
    ...splitAddress(addressRaw),
    addressRaw: addressRaw || null,
  }
}

function splitAddress(raw) {
  const text = String(raw || "").trim()
  if (!text) {
    return { address: null, city: null, state: null, zip: null }
  }

  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[1] : null

  const stateMatch = text.match(/,\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\b/)
    || text.match(/\b([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\b/)
  let state = null
  if (stateMatch) {
    const candidate = stateMatch[1].toUpperCase()
    const US = new Set([
      "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
      "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
      "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
      "VA","WA","WV","WI","WY","DC",
    ])
    if (US.has(candidate)) state = candidate
  }

  let city = null
  let address = text
  if (state) {
    const idx = text.toUpperCase().lastIndexOf(state)
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/[,\s]+$/, "").trim()
      const cityMatch = before.match(/([^,]+)$/)
      if (cityMatch) {
        city = cityMatch[1].trim()
        address = before.slice(0, before.length - city.length).replace(/[,\s]+$/, "").trim() || before
      }
    }
  }

  // If we couldn't split, keep full text on address line.
  if (!address) address = text

  return {
    address: address || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
  }
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function findContactByEmail(sb, email, cache) {
  if (!email) return null
  if (cache.has(email)) return cache.get(email)
  const { data } = await sb
    .from("contacts")
    .select("id, full_name, email, phone, address, city, state, zip, person_id")
    .eq("organization_id", ORG_ID)
    .ilike("email", email)
    .limit(1)
    .maybeSingle()
  cache.set(email, data || null)
  return data || null
}

async function ensurePersonRelationship(sb, personId, relatedPersonId, relationshipType) {
  const { data: existing } = await sb
    .from("person_relationships")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("person_id", personId)
    .eq("related_person_id", relatedPersonId)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data, error } = await sb
    .from("person_relationships")
    .insert({
      organization_id: ORG_ID,
      person_id: personId,
      related_person_id: relatedPersonId,
      relationship_type: relationshipType,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const csvPath = argValue("--csv") || DEFAULT_CSV
  if (!existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const text = readFileSync(csvPath, "utf8")
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (parsed.errors?.length) console.warn(`CSV parse warnings: ${parsed.errors.length}`)

  /** @type {Map<string, any>} */
  const byParentEmail = new Map()

  for (const row of parsed.data || []) {
    const parentEmail = normEmail(row["Parent Email"])
    if (!parentEmail) continue

    const parentPhone = formatPhone(digitsPhone(row["Parent Contact Number"]))
    const parentName = String(row["Parent Name"] || "").trim()
    const ec1 = parseEmergencyBlob(row["Emergency Contact Details 1"])
    const ec2 = parseEmergencyBlob(row["Emergency Contact Details 2"])
    const childName = String(row["Child Name"] || "").trim()

    if (!byParentEmail.has(parentEmail)) {
      byParentEmail.set(parentEmail, {
        parentEmail,
        parentName,
        parentPhone,
        ec1,
        ec2,
        children: [],
      })
    }
    const entry = byParentEmail.get(parentEmail)
    if (!entry.parentPhone && parentPhone) entry.parentPhone = parentPhone
    if (!entry.parentName && parentName) entry.parentName = parentName
    if (!entry.ec1 && ec1) entry.ec1 = ec1
    if (!entry.ec2 && ec2) entry.ec2 = ec2
    if (childName) entry.children.push(childName)
  }

  const report = {
    mode: execute ? "execute" : "dry-run",
    csvPath,
    parentsInRoster: byParentEmail.size,
    matchedParents: 0,
    unmatchedParents: [],
    contactPatches: 0,
    contactsUpdated: 0,
    notesAdded: 0,
    spousesLinked: 0,
    householdsSynced: 0,
    samples: [],
    fieldFills: { phone: 0, address: 0, city: 0, state: 0, zip: 0 },
  }

  const emailCache = new Map()
  const parentsToSync = new Set()

  for (const [email, entry] of byParentEmail) {
    const contact = await findContactByEmail(sb, email, emailCache)
    if (!contact) {
      report.unmatchedParents.push({ email, name: entry.parentName || null })
      continue
    }
    report.matchedParents += 1

    const patch = {}
    if (entry.parentPhone && !contact.phone) {
      patch.phone = entry.parentPhone
      report.fieldFills.phone += 1
    }

    // Prefer address from emergency contact blobs (often has street/city).
    const addressSource = entry.ec1?.addressRaw ? entry.ec1 : entry.ec2
    if (addressSource) {
      if (addressSource.address && !contact.address) {
        patch.address = addressSource.address
        report.fieldFills.address += 1
      }
      if (addressSource.city && !contact.city) {
        patch.city = addressSource.city
        report.fieldFills.city += 1
      }
      if (addressSource.state && !contact.state) {
        patch.state = addressSource.state
        report.fieldFills.state += 1
      }
      if (addressSource.zip && !contact.zip) {
        patch.zip = addressSource.zip
        report.fieldFills.zip += 1
      }
    }

    const noteLines = []
    if (entry.ec1) {
      noteLines.push(
        [
          "1)",
          entry.ec1.phone ? `phone ${entry.ec1.phone}` : null,
          entry.ec1.email ? `email ${entry.ec1.email}` : null,
          entry.ec1.addressRaw ? `address ${entry.ec1.addressRaw}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      )
    }
    if (entry.ec2) {
      noteLines.push(
        [
          "2)",
          entry.ec2.phone ? `phone ${entry.ec2.phone}` : null,
          entry.ec2.email ? `email ${entry.ec2.email}` : null,
          entry.ec2.addressRaw ? `address ${entry.ec2.addressRaw}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      )
    }
    const noteBody =
      noteLines.length > 0
        ? `${NOTE_MARKER}\nChildren: ${entry.children.join(", ")}\n${noteLines.join("\n")}`
        : null

    if (Object.keys(patch).length > 0) {
      report.contactPatches += 1
      if (report.samples.length < 12) {
        report.samples.push({
          contact: contact.full_name,
          email,
          patch,
          willAddNote: Boolean(noteBody),
        })
      }
    }

    if (!execute) {
      if (noteBody) report.notesAdded += 1
      continue
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await sb
        .from("contacts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("organization_id", ORG_ID)
        .eq("id", contact.id)
      if (error) {
        console.warn(`contact update failed ${contact.id}: ${error.message}`)
      } else {
        report.contactsUpdated += 1
        Object.assign(contact, patch)
      }
    }

    if (noteBody) {
      const { data: existingNotes } = await sb
        .from("contact_notes")
        .select("id, note")
        .eq("organization_id", ORG_ID)
        .eq("contact_id", contact.id)
        .ilike("note", `%${NOTE_MARKER}%`)
        .limit(1)

      if (!existingNotes?.length) {
        const { error } = await sb.from("contact_notes").insert({
          organization_id: ORG_ID,
          contact_id: contact.id,
          note: noteBody,
        })
        if (error) {
          console.warn(`note insert failed ${contact.id}: ${error.message}`)
        } else {
          report.notesAdded += 1
        }
      }
    }

    // Link second emergency email as spouse when it resolves to another contact.
    const spouseEmail = entry.ec2?.email && entry.ec2.email !== email ? entry.ec2.email : null
    if (spouseEmail && contact.person_id) {
      const spouse = await findContactByEmail(sb, spouseEmail, emailCache)
      if (spouse?.person_id && spouse.id !== contact.id) {
        try {
          await ensurePersonRelationship(sb, contact.person_id, spouse.person_id, "spouse")
          await ensurePersonRelationship(sb, spouse.person_id, contact.person_id, "spouse")
          report.spousesLinked += 1
          parentsToSync.add(contact.id)
          parentsToSync.add(spouse.id)
        } catch (err) {
          console.warn(
            `spouse link failed ${contact.id} ↔ ${spouse.id}: ${
              err instanceof Error ? err.message : err
            }`
          )
        }
      }
    }

    parentsToSync.add(contact.id)
  }

  // Prefer running household sync separately (camp parents):
  //   node scripts/sync-summer-camp-households.mjs --execute
  if (execute && parentsToSync.size > 0) {
    report.householdsSynced = 0
    report.householdSyncHint =
      "Run: node scripts/sync-summer-camp-households.mjs --execute (and repair-household-spouse-dependents for linked spouses)"
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = resolve(reportsDir, `enrich-summer-camp-parents-${stamp}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        parentsInRoster: report.parentsInRoster,
        matchedParents: report.matchedParents,
        unmatchedParents: report.unmatchedParents.length,
        contactPatches: report.contactPatches,
        contactsUpdated: report.contactsUpdated,
        notesAdded: report.notesAdded,
        spousesLinked: report.spousesLinked,
        householdsSynced: report.householdsSynced,
        fieldFills: report.fieldFills,
        report: outPath,
        unmatchedSample: report.unmatchedParents.slice(0, 10),
        samples: report.samples,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
