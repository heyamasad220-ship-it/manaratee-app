import { isCustomerPortalModuleEnabled } from "@/lib/customer/customer-portal-modules"

export type CustomerNotificationPreferenceKey =
  | "emailPaymentCompleted"
  | "emailPaymentCharges"
  | "emailFailedTransactions"
  | "emailPledgeReminders"
  | "emailBookings"
  | "emailProgramUpdates"
  | "emailNewsletter"
  | "smsPaymentReminders"

export type CustomerNotificationPreferenceDefinition = {
  key: CustomerNotificationPreferenceKey
  label: string
  description: string
  moduleSlug: string | null
}

export const CUSTOMER_NOTIFICATION_PREFERENCES: CustomerNotificationPreferenceDefinition[] =
  [
    {
      key: "emailPaymentCompleted",
      label: "Payment completed",
      description: "Get an email when a donation or pledge payment is successfully processed.",
      moduleSlug: "donations",
    },
    {
      key: "emailPaymentCharges",
      label: "Payment charges",
      description:
        "Get an email when a recurring gift or scheduled pledge installment is charged.",
      moduleSlug: "donations",
    },
    {
      key: "emailFailedTransactions",
      label: "Failed transactions",
      description:
        "Get an email if a card charge fails so you can update your payment method.",
      moduleSlug: "donations",
    },
    {
      key: "emailPledgeReminders",
      label: "Pledge payment reminders",
      description: "Receive email reminders before upcoming pledge payments are due.",
      moduleSlug: "donations",
    },
    {
      key: "smsPaymentReminders",
      label: "SMS payment reminders",
      description: "Get text reminders for upcoming pledge or recurring donation charges.",
      moduleSlug: "donations",
    },
    {
      key: "emailBookings",
      label: "Booking notifications",
      description: "Updates about your venue booking requests.",
      moduleSlug: "bookings",
    },
    {
      key: "emailProgramUpdates",
      label: "Program updates",
      description: "Receive emails about programs you are registered for.",
      moduleSlug: "programs",
    },
    {
      key: "emailNewsletter",
      label: "Newsletter",
      description: "Receive our monthly community newsletter.",
      moduleSlug: null,
    },
  ]

export type CustomerNotificationSettings = Record<CustomerNotificationPreferenceKey, boolean>

export function createDefaultCustomerNotificationSettings(): CustomerNotificationSettings {
  return CUSTOMER_NOTIFICATION_PREFERENCES.reduce((settings, preference) => {
    settings[preference.key] = false
    return settings
  }, {} as CustomerNotificationSettings)
}

export function getVisibleCustomerNotificationPreferences(enabledModuleSlugs: string[]) {
  const enabledSlugs = new Set(enabledModuleSlugs)

  return CUSTOMER_NOTIFICATION_PREFERENCES.filter((preference) =>
    isCustomerPortalModuleEnabled(enabledSlugs, preference.moduleSlug)
  )
}
