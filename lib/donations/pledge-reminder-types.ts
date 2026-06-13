export const PLEDGE_REMINDER_SCHEDULES = ["manual", "monthly", "days_before_due"] as const
export type PledgeReminderSchedule = (typeof PLEDGE_REMINDER_SCHEDULES)[number]

export const PLEDGE_REMINDER_TYPES = ["manual", "monthly", "days_before_due", "contacted"] as const
export type PledgeReminderType = (typeof PLEDGE_REMINDER_TYPES)[number]

export const PLEDGE_REMINDER_STATUSES = ["draft", "sent", "failed", "skipped"] as const
export type PledgeReminderStatus = (typeof PLEDGE_REMINDER_STATUSES)[number]

export type PledgeReminderSettingsFields = {
  enable_pledge_reminders: boolean
  pledge_reminder_message: string | null
  pledge_reminder_subject: string | null
  pledge_reminder_schedule: PledgeReminderSchedule
  pledge_reminder_days_before_due: number | null
  pledge_reminder_footer_text: string | null
  pledge_payment_instructions: string | null
}

export type OutstandingPledgeRow = {
  id: string
  donorId: string | null
  contactId: string | null
  donorName: string
  campaignName: string | null
  amountPledged: number
  amountPaid: number
  balanceRemaining: number
  status: string
  pledgeDate: string | null
  lastPaymentDate: string | null
  lastReminderAt: string | null
  lastReminderStatus: PledgeReminderStatus | null
  lastContactedAt: string | null
  reminderCount: number
}

export type PledgeReminderMessage = {
  subject: string
  body: string
  donorName: string
  organizationName: string
  campaignName: string | null
  amountPledged: number
  amountPaid: number
  balanceRemaining: number
  paymentInstructions: string | null
}

export type PledgeReminderRecord = {
  id: string
  pledge_id: string
  donor_id: string | null
  contact_id: string | null
  reminder_type: PledgeReminderType
  status: PledgeReminderStatus
  message_subject: string | null
  message_body: string
  delivered_externally: boolean
  contact_notes: string | null
  sent_at: string | null
  sent_by: string | null
  created_at: string
}

export const DEFAULT_PLEDGE_REMINDER_SUBJECT =
  "Friendly reminder about your pledge to {{organization_name}}"

export const DEFAULT_PLEDGE_REMINDER_MESSAGE = `Dear {{donor_name}},

This is a friendly reminder about your outstanding pledge to {{organization_name}}.

Campaign: {{campaign_name}}
Pledge amount: {{pledge_amount}}
Amount paid: {{amount_paid}}
Balance remaining: {{balance_remaining}}

{{payment_instructions}}

Thank you for your generous support.`

export const DEFAULT_PLEDGE_REMINDER_FOOTER =
  "If you have already sent your payment, please disregard this reminder. Thank you."

export const DEFAULT_PLEDGE_PAYMENT_INSTRUCTIONS =
  "You can make a payment through your donor portal or contact our office for payment options."

export function isPledgeEligibleForReminder(
  calculatedStatus: string | null | undefined,
  balanceRemaining: number
): boolean {
  const status = String(calculatedStatus || "").toLowerCase()
  if (status === "fulfilled" || status === "paid" || status === "cancelled") return false
  return balanceRemaining > 0.009
}

export function formatPledgeReminderStatusLabel(status: string | null | undefined): string {
  if (!status) return "No reminder"
  switch (status) {
    case "sent":
      return "Email sent"
    case "draft":
      return "Draft"
    case "failed":
      return "Failed"
    case "skipped":
      return "Skipped"
    default:
      return status
  }
}
