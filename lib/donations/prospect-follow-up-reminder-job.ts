import { sendProspectFollowUpReminderEmail } from "@/lib/donations/donation-email-delivery"
import {
  isProspectFollowUpOverdue,
  normalizeProspectStage,
  type CampaignProspectStage,
} from "@/lib/donations/campaign-prospect-types"
import { getAppBaseUrl } from "@/lib/stripe/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type OverdueProspectRow = {
  id: string
  organization_id: string
  campaign_id: string
  contact_id: string
  assigned_to_contact_id: string | null
  stage: string
  next_follow_up_at: string | null
}

function formatFollowUpDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function contactDisplayName(row: {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  email?: string | null
}) {
  const full = String(row.full_name || "").trim()
  if (full) return full
  const parts = [row.first_name, row.last_name].map((part) => String(part || "").trim()).filter(Boolean)
  if (parts.length) return parts.join(" ")
  return row.email?.trim() || "Contact"
}

export async function runProspectFollowUpReminderJob(input?: { asOf?: Date }) {
  const supabase = createServiceRoleClient()
  const asOf = input?.asOf ?? new Date()
  const reminderDate = asOf.toISOString().slice(0, 10)
  const baseUrl = getAppBaseUrl()

  const { data: prospects, error } = await supabase
    .from("campaign_prospects")
    .select(
      "id, organization_id, campaign_id, contact_id, assigned_to_contact_id, stage, next_follow_up_at"
    )
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", reminderDate)

  if (error) {
    if (error.code === "42P01") {
      throw new Error("campaign_prospects table is not available.")
    }
    throw new Error(error.message)
  }

  const overdue = ((prospects ?? []) as OverdueProspectRow[]).filter((row) =>
    isProspectFollowUpOverdue(
      row.next_follow_up_at,
      normalizeProspectStage(row.stage) as CampaignProspectStage
    )
  )

  if (overdue.length === 0) {
    return { sent: 0, skipped: 0, overdueCount: 0 }
  }

  const orgIds = [...new Set(overdue.map((row) => row.organization_id))]
  const campaignIds = [...new Set(overdue.map((row) => row.campaign_id))]
  const contactIds = [
    ...new Set(
      overdue.flatMap((row) =>
        [row.contact_id, row.assigned_to_contact_id].filter(Boolean) as string[]
      )
    ),
  ]

  const [{ data: orgs }, { data: campaigns }, { data: contacts }] = await Promise.all([
    supabase.from("organizations").select("id, name").in("id", orgIds),
    supabase.from("campaigns").select("id, name").in("id", campaignIds),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, full_name, email")
      .in("id", contactIds),
  ])

  const orgNameById = new Map((orgs ?? []).map((row) => [row.id as string, row.name as string]))
  const campaignNameById = new Map(
    (campaigns ?? []).map((row) => [row.id as string, row.name as string])
  )
  const contactById = new Map(
    (contacts ?? []).map((row) => [row.id as string, row as Record<string, string | null>])
  )

  type BucketItem = {
    prospectName: string
    campaignName: string
    followUpDate: string
    href: string
  }

  type Bucket = {
    organizationId: string
    organizationName: string
    assigneeContactId: string | null
    assigneeName: string
    recipientEmail: string
    items: BucketItem[]
  }

  const buckets = new Map<string, Bucket>()

  for (const row of overdue) {
    const assigneeId = row.assigned_to_contact_id
    const assignee = assigneeId ? contactById.get(assigneeId) : null
    const recipientEmail = assignee?.email?.trim().toLowerCase() || null
    if (!recipientEmail) continue

    const prospect = contactById.get(row.contact_id)
    const key = `${row.organization_id}:${recipientEmail}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        organizationId: row.organization_id,
        organizationName: orgNameById.get(row.organization_id) || "Organization",
        assigneeContactId: assigneeId,
        assigneeName: contactDisplayName(assignee || {}),
        recipientEmail,
        items: [],
      }
      buckets.set(key, bucket)
    }

    bucket.items.push({
      prospectName: contactDisplayName(prospect || {}),
      campaignName: campaignNameById.get(row.campaign_id) || "Campaign",
      followUpDate: formatFollowUpDate(row.next_follow_up_at || reminderDate),
      href: `${baseUrl}/donations/campaigns/${row.campaign_id}?tab=prospects&followUp=overdue`,
    })
  }

  let sent = 0
  let skipped = 0

  for (const bucket of buckets.values()) {
    const { data: existing } = await supabase
      .from("prospect_follow_up_reminder_log")
      .select("id")
      .eq("organization_id", bucket.organizationId)
      .eq("recipient_email", bucket.recipientEmail)
      .eq("reminder_date", reminderDate)
      .maybeSingle()

    if (existing?.id) {
      skipped += 1
      continue
    }

    const delivery = await sendProspectFollowUpReminderEmail(supabase, {
      organizationId: bucket.organizationId,
      recipient: bucket.recipientEmail,
      organizationName: bucket.organizationName,
      assigneeName: bucket.assigneeName,
      overdueCount: bucket.items.length,
      items: bucket.items,
    })

    if (!delivery.sent) {
      skipped += 1
      continue
    }

    const { error: logError } = await supabase.from("prospect_follow_up_reminder_log").insert({
      organization_id: bucket.organizationId,
      assignee_contact_id: bucket.assigneeContactId,
      recipient_email: bucket.recipientEmail,
      reminder_date: reminderDate,
      overdue_count: bucket.items.length,
    })

    if (logError && logError.code !== "23505") {
      console.warn("[prospect-follow-up] log insert failed:", logError.message)
    }

    sent += 1
  }

  return {
    sent,
    skipped,
    overdueCount: overdue.length,
    digestCount: buckets.size,
  }
}
