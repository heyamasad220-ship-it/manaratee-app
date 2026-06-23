/**
 * Merge placeholder "???" donors into the canonical Anonymous user donor.
 *
 * Matches donor names that are:
 * - only question marks / whitespace, or
 * - start with "?" (import corruption prefix)
 *
 * Usage:
 *   node scripts/merge-mas-anonymous-placeholder-donors.mjs
 *   node scripts/merge-mas-anonymous-placeholder-donors.mjs --target "Anonymous user"
 *   node scripts/merge-mas-anonymous-placeholder-donors.mjs --execute
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const STAMP = new Date().toISOString().slice(0, 10)

function parseArgs() {
  const args = { target: "Anonymous", targetId: null }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--target") args.target = argv[++i]
    if (argv[i] === "--target-id") args.targetId = argv[++i]
  }
  return args
}

function loadEnv() {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

function normalizeTargetName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function isAnonymousName(name, targetName) {
  const normalized = normalizeTargetName(name)
  const target = normalizeTargetName(targetName)
  if (normalized === target) return true
  if (normalized === "anonymous" && target === "anonymous user") return true
  if (normalized === "anonymous user" && target === "anonymous") return true
  return false
}

function hasSubstantialLatinWord(name) {
  return /\b[a-zA-Z]{4,}\b/.test(String(name || ""))
}

function isPlaceholderDonorName(name, targetName) {
  const trimmed = String(name || "").trim()
  if (!trimmed) return false
  if (isAnonymousName(trimmed, targetName)) return false

  if (/^[\s?]+$/.test(trimmed)) return true
  if (trimmed.startsWith("?") && !hasSubstantialLatinWord(trimmed.replace(/^\?+/, ""))) return true
  if (trimmed.startsWith("?") && trimmed.length <= 20) return true

  const questionCount = (trimmed.match(/\?/g) || []).length
  if (questionCount >= 3 && questionCount / trimmed.length >= 0.25 && !hasSubstantialLatinWord(trimmed)) {
    return true
  }

  return false
}

loadEnv()
const args = parseArgs()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, filters = []) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + 999)
    for (const f of filters) {
      if (f.op === "eq") q = q.eq(f.col, f.val)
      if (f.op === "in") q = q.in(f.col, f.val)
    }
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function updateByDonorIds(table, donorIds, patch) {
  if (!donorIds.length) return 0
  if (!execute) return donorIds.length
  let updated = 0
  for (let i = 0; i < donorIds.length; i += 50) {
    const chunk = donorIds.slice(i, i + 50)
    const { error } = await sb
      .from(table)
      .update(patch)
      .eq("organization_id", MAS)
      .in("donor_id", chunk)
    if (error) throw new Error(`${table} update: ${error.message}`)
    updated += chunk.length
  }
  return updated
}

async function deleteByIds(table, ids) {
  if (!ids.length) return 0
  if (!execute) return ids.length
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { error } = await sb.from(table).delete().in("id", chunk)
    if (error) throw new Error(`${table} delete: ${error.message}`)
    deleted += chunk.length
  }
  return deleted
}

async function donorActivityScore(donorId) {
  const { count: paymentCount } = await sb
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", MAS)
    .eq("donor_id", donorId)
  const { count: pledgeCount } = await sb
    .from("pledges")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", MAS)
    .eq("donor_id", donorId)
  return (paymentCount ?? 0) + (pledgeCount ?? 0)
}

async function resolveTargetDonor(donors) {
  if (args.targetId) {
    const match = donors.find((d) => d.id === args.targetId)
    if (!match) {
      return { error: `Target donor not found for id ${args.targetId}` }
    }
    return { target: match, duplicateAnonymous: [] }
  }

  const targetCandidates = donors.filter((d) => isAnonymousName(d.full_name, args.target))
  if (!targetCandidates.length) {
    return { error: `No target donor found matching "${args.target}"` }
  }

  const scored = await Promise.all(
    targetCandidates.map(async (donor) => ({
      donor,
      score: await donorActivityScore(donor.id),
    }))
  )
  scored.sort((a, b) => b.score - a.score)
  const target = scored[0].donor
  const duplicateAnonymous = scored.slice(1).map((entry) => entry.donor)
  return { target, duplicateAnonymous }
}

async function main() {
  const donors = await fetchAll("donors", [{ op: "eq", col: "organization_id", val: MAS }])

  const resolved = await resolveTargetDonor(donors)
  if (resolved.error) {
    console.log(
      JSON.stringify(
        {
          mode: execute ? "execute" : "preview",
          error: resolved.error,
        },
        null,
        2
      )
    )
    process.exit(1)
  }

  const { target, duplicateAnonymous } = resolved
  const placeholderSources = donors.filter(
    (d) => isPlaceholderDonorName(d.full_name, args.target) && d.id !== target.id
  )
  const sources = [...duplicateAnonymous, ...placeholderSources.filter((d) => d.id !== target.id)]
  const uniqueSources = [...new Map(sources.map((d) => [d.id, d])).values()]
  const sourceDonorIds = uniqueSources.map((d) => d.id)
  const sourceContactIds = [...new Set(uniqueSources.map((d) => d.contact_id).filter(Boolean))]

  const pledges = sourceDonorIds.length
    ? await fetchAll("pledges", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: sourceDonorIds },
      ])
    : []
  const payments = sourceDonorIds.length
    ? await fetchAll("payments", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: sourceDonorIds },
      ])
    : []
  const recurringPlans = sourceDonorIds.length
    ? await fetchAll("recurring_donation_plans", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "in", col: "donor_id", val: sourceDonorIds },
      ])
    : []

  const paymentIds = payments.map((p) => p.id)
  const pledgeIds = pledges.map((p) => p.id)

  const report = {
    mode: execute ? "execute" : "preview",
    organizationId: MAS,
    target: {
      id: target.id,
      full_name: target.full_name,
      contact_id: target.contact_id,
    },
    duplicateAnonymousMerged: duplicateAnonymous.map((d) => ({
      id: d.id,
      full_name: d.full_name,
    })),
    sourceDonorCount: uniqueSources.length,
    sources: uniqueSources.map((d) => ({
      id: d.id,
      full_name: d.full_name,
      contact_id: d.contact_id,
      email: d.email,
    })),
    inventory: {
      pledges: pledges.length,
      payments: payments.length,
      recurringPlans: recurringPlans.length,
      paymentTotal: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      pledgeTotal: pledges.reduce((sum, p) => sum + Number(p.amount_pledged || 0), 0),
    },
    steps: [],
  }

  if (!uniqueSources.length) {
    report.message = "No placeholder donors matched."
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const donorPatch = {
    donor_id: target.id,
    ...(target.contact_id ? { contact_id: target.contact_id } : {}),
  }

  if (execute) {
    if (paymentIds.length) {
      const { error } = await sb
        .from("donation_receipts")
        .update({
          donor_id: target.id,
          ...(target.contact_id ? { contact_id: target.contact_id } : {}),
        })
        .eq("organization_id", MAS)
        .in("payment_id", paymentIds)
      if (error) throw new Error(`donation_receipts update: ${error.message}`)
    }

    if (pledgeIds.length) {
      const { error } = await sb
        .from("pledge_reminders")
        .update({
          donor_id: target.id,
          ...(target.contact_id ? { contact_id: target.contact_id } : {}),
        })
        .eq("organization_id", MAS)
        .in("pledge_id", pledgeIds)
      if (error) throw new Error(`pledge_reminders update: ${error.message}`)
    }

    report.steps.push({
      table: "payments",
      reassigned: await updateByDonorIds("payments", sourceDonorIds, donorPatch),
      rows: payments.length,
    })
    report.steps.push({
      table: "pledges",
      reassigned: await updateByDonorIds("pledges", sourceDonorIds, { donor_id: target.id }),
      rows: pledges.length,
    })
    report.steps.push({
      table: "recurring_donation_plans",
      reassigned: await updateByDonorIds("recurring_donation_plans", sourceDonorIds, donorPatch),
      rows: recurringPlans.length,
    })
    report.steps.push({
      table: "donation_checkout_sessions",
      reassigned: await updateByDonorIds("donation_checkout_sessions", sourceDonorIds, donorPatch),
    })

    report.steps.push({ table: "donors", deleted: await deleteByIds("donors", sourceDonorIds) })

    for (const contactId of sourceContactIds) {
      const remaining = await fetchAll("donors", [
        { op: "eq", col: "organization_id", val: MAS },
        { op: "eq", col: "contact_id", val: contactId },
      ])
      if (remaining.length === 0) {
        await sb.from("donation_receipts").delete().eq("organization_id", MAS).eq("contact_id", contactId)
        await sb.from("contact_roles").delete().eq("contact_id", contactId)
        await sb.from("contact_notes").delete().eq("contact_id", contactId)
        report.steps.push({
          table: "contacts",
          deleted: await deleteByIds("contacts", [contactId]),
        })
      }
    }
  } else {
    report.steps.push({ dryRun: true, wouldReassign: report.inventory })
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `mas-anonymous-placeholder-donor-merge-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  if (!execute) {
    console.error(`Dry run only. Re-run with --execute to merge into "${args.target}".`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
