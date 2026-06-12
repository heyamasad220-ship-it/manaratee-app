import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { deliverVendorEventAnnouncement } from "@/lib/vendor-hub/vendor-announcement-delivery"
import { fillAnnouncementTemplate } from "@/lib/vendor-hub/vendor-announcement-types"

export const VENDOR_BAZAAR_REMINDER_DAYS = [7, 3, 1] as const

export type VendorBazaarReminderDay = (typeof VENDOR_BAZAAR_REMINDER_DAYS)[number]

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function reminderCopy(daysBefore: VendorBazaarReminderDay, eventName: string) {
  const dayLabel = daysBefore === 1 ? "tomorrow" : `in ${daysBefore} days`

  return {
    subject: `Reminder: ${eventName} is ${dayLabel}`,
    body: `This is an automated reminder that ${eventName} is ${dayLabel}. Please review your booth reservation and payment status in My Bazaars.`,
  }
}

export async function runVendorBazaarReminderJob(input?: { asOf?: Date }) {
  const supabase = createServiceRoleClient()
  const asOf = input?.asOf ?? new Date()

  const summary: Array<{
    eventId: string
    eventName: string
    daysBefore: VendorBazaarReminderDay
    recipientCount: number
    skipped?: string
  }> = []

  for (const daysBefore of VENDOR_BAZAAR_REMINDER_DAYS) {
    const targetDate = formatDateKey(addUtcDays(asOf, daysBefore))

    const { data: events, error } = await supabase
      .from("vendor_hub_events")
      .select("id, name, organization_id, event_date, status, calendar_status")
      .eq("event_date", targetDate)
      .not("status", "in", "(completed,cancelled)")
      .in("calendar_status", ["community_visible", "published"])

    if (error) {
      if (error.code === "42P01") {
        throw new Error("vendor_hub_events table is not available.")
      }
      throw new Error(error.message)
    }

    for (const event of events ?? []) {
      const eventId = event.id as string
      const organizationId = event.organization_id as string

      const { data: existingLog } = await supabase
        .from("vendor_hub_event_reminder_log")
        .select("id")
        .eq("vendor_hub_event_id", eventId)
        .eq("days_before", daysBefore)
        .maybeSingle()

      if (existingLog) {
        summary.push({
          eventId,
          eventName: event.name as string,
          daysBefore,
          recipientCount: 0,
          skipped: "already_sent",
        })
        continue
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle()

      const copy = reminderCopy(daysBefore, event.name as string)

      const delivery = await deliverVendorEventAnnouncement({
        supabase,
        eventId,
        organizationId,
        announcementType: "reminder",
        audience: "event_participants",
        subject: copy.subject,
        body: fillAnnouncementTemplate(copy.body, {
          eventName: event.name as string,
          organizationName: (org?.name as string | undefined) ?? undefined,
        }),
        sentBy: null,
        organizationName: (org?.name as string | null) ?? null,
      })

      if (delivery.recipientCount === 0) {
        summary.push({
          eventId,
          eventName: event.name as string,
          daysBefore,
          recipientCount: 0,
          skipped: "no_participants",
        })
        continue
      }

      const { error: logError } = await supabase.from("vendor_hub_event_reminder_log").insert({
        vendor_hub_event_id: eventId,
        days_before: daysBefore,
        announcement_id: delivery.announcementId,
      })

      if (logError && logError.code !== "23505") {
        console.error("vendor reminder log insert failed:", logError)
      }

      summary.push({
        eventId,
        eventName: event.name as string,
        daysBefore,
        recipientCount: delivery.recipientCount,
      })
    }
  }

  return {
    ranAt: asOf.toISOString(),
    processed: summary.length,
    sent: summary.filter((row) => row.recipientCount > 0).length,
    items: summary,
  }
}
