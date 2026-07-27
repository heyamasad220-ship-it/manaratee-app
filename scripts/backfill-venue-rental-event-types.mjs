/**
 * Backfill venue_rental_event_type_id from Google Form import notes
 * ("Event type: …") onto existing venue_rentals.
 *
 * Usage:
 *   node scripts/backfill-venue-rental-event-types.mjs
 *   node scripts/backfill-venue-rental-event-types.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const FORM_IMPORT_TAG = "VENUE_RENTAL_GOOGLE_FORM_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

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
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

function parseEventTypeFromNotes(notes) {
  const text = String(notes || "")
  const match = text.match(/Event type:\s*(.+?)(?:\n|$)/i)
  return match ? normalizeText(match[1]) : null
}

/** Map free-text form labels onto catalog names when possible. */
function canonicalEventTypeName(raw) {
  const value = normalizeText(raw)
  if (!value) return null
  const lower = value.toLowerCase()

  // Exact / prefix matches for known Google Form choices (check before keyword rules)
  const formOptions = [
    {
      test: /^party\s*\(/,
      name: "Wedding / Engagement Party",
    },
    {
      test: /^dinner\s*\(/,
      name: "Dinner / Iftar",
    },
    {
      test: /^conference|^seminar|meeting,\s*etc/,
      name: "Meeting",
    },
    { test: /^workshop$/, name: "Workshop" },
    { test: /^henna/, name: "Henna Party" },
    { test: /^film\s*festival/, name: "Film Festival" },
    { test: /^aqeeqa|^aqiqa|^aqiqah/, name: "Aqeeqa" },
  ]
  for (const option of formOptions) {
    if (option.test.test(lower)) return option.name
  }

  const rules = [
    { test: /henna/, name: "Henna Party" },
    { test: /graduation/, name: "Graduation Party" },
    { test: /wedding|nikkah|nikah|katb/, name: "Wedding" },
    { test: /engagement/, name: "Engagement" },
    { test: /baby\s*shower/, name: "Baby Shower" },
    { test: /aqeeqa|aqiqa|aqiqah/, name: "Aqeeqa" },
    { test: /birthday/, name: "Birthday Party" },
    { test: /memorial|condolence|aza\b|janazah/, name: "Memorial Service" },
    { test: /workshop/, name: "Workshop" },
    { test: /corporate|conference|seminar/, name: "Corporate Event" },
    { test: /\bmeeting\b/, name: "Meeting" },
    { test: /iftar|ramadan|quran|khutbah|religious/, name: "Religious Ceremony" },
    { test: /dinner|party|reception/, name: "Other" },
  ]

  for (const rule of rules) {
    if (rule.test.test(lower)) return rule.name
  }

  // Keep original label as a custom type name (trimmed)
  return value.length > 80 ? `${value.slice(0, 77)}…` : value
}

async function ensureEventType(sb, orgId, name, cacheBySlug, cacheByName) {
  const slug = slugify(name) || "other"
  if (cacheBySlug.has(slug)) return cacheBySlug.get(slug)
  const nameKey = name.toLowerCase()
  if (cacheByName.has(nameKey)) return cacheByName.get(nameKey)

  const { data: existing } = await sb
    .from("venue_rental_event_types")
    .select("id, name, slug")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .maybeSingle()

  if (existing) {
    cacheBySlug.set(existing.slug, existing)
    cacheByName.set(existing.name.toLowerCase(), existing)
    return existing
  }

  const { data: created, error } = await sb
    .from("venue_rental_event_types")
    .insert({
      organization_id: orgId,
      name,
      slug,
      is_active: true,
      sort_order: 50,
      description: "Created from Google Form venue rental import",
    })
    .select("id, name, slug")
    .single()

  if (error) {
    // Race / conflict — re-read
    const { data: again } = await sb
      .from("venue_rental_event_types")
      .select("id, name, slug")
      .eq("organization_id", orgId)
      .eq("slug", slug)
      .maybeSingle()
    if (again) {
      cacheBySlug.set(again.slug, again)
      cacheByName.set(again.name.toLowerCase(), again)
      return again
    }
    throw new Error(error.message)
  }

  cacheBySlug.set(created.slug, created)
  cacheByName.set(created.name.toLowerCase(), created)
  return created
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const report = {
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    scanned: 0,
    alreadySet: 0,
    noEventTypeInNotes: 0,
    updated: 0,
    typesCreated: 0,
    errors: [],
    samples: [],
  }

  const { data: rentals, error } = await sb
    .from("venue_rentals")
    .select("id, notes, venue_rental_event_type_id")
    .eq("organization_id", args.orgId)
    .ilike("notes", `%${FORM_IMPORT_TAG}%`)

  if (error) throw new Error(error.message)

  const { data: existingTypes } = await sb
    .from("venue_rental_event_types")
    .select("id, name, slug")
    .eq("organization_id", args.orgId)

  const cacheBySlug = new Map()
  const cacheByName = new Map()
  for (const type of existingTypes || []) {
    cacheBySlug.set(type.slug, type)
    cacheByName.set(type.name.toLowerCase(), type)
  }
  const knownSlugs = new Set(cacheBySlug.keys())

  for (const rental of rentals || []) {
    report.scanned += 1
    try {
      if (rental.venue_rental_event_type_id) {
        report.alreadySet += 1
        continue
      }

      const raw = parseEventTypeFromNotes(rental.notes)
      if (!raw) {
        report.noEventTypeInNotes += 1
        continue
      }

      const canonical = canonicalEventTypeName(raw)
      if (!canonical) {
        report.noEventTypeInNotes += 1
        continue
      }

      const slug = slugify(canonical) || "other"
      const before = knownSlugs.has(slug)
      const eventType = args.execute
        ? await ensureEventType(
            sb,
            args.orgId,
            canonical,
            cacheBySlug,
            cacheByName
          )
        : cacheBySlug.get(slug) ||
          cacheByName.get(canonical.toLowerCase()) || {
            id: `dry-run:${slug}`,
            name: canonical,
            slug,
          }

      if (!before && args.execute && !knownSlugs.has(eventType.slug)) {
        report.typesCreated += 1
        knownSlugs.add(eventType.slug)
      } else if (!before && !args.execute && !cacheBySlug.has(slug)) {
        report.typesCreated += 1
        knownSlugs.add(slug)
      }

      if (args.execute) {
        const { error: updateError } = await sb
          .from("venue_rentals")
          .update({ venue_rental_event_type_id: eventType.id })
          .eq("id", rental.id)
          .eq("organization_id", args.orgId)
        if (updateError) throw new Error(updateError.message)
      }

      report.updated += 1
      if (report.samples.length < 15) {
        report.samples.push({
          rentalId: rental.id,
          raw,
          canonical,
          eventTypeId: eventType.id,
        })
      }
    } catch (err) {
      report.errors.push({
        rentalId: rental.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(
    outDir,
    args.execute
      ? "venue-rental-event-types-backfill-execute.json"
      : "venue-rental-event-types-backfill-dry-run.json"
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outPath}`)
  if (!args.execute) {
    console.log("Dry-run only. Re-run with --execute to update rentals.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
