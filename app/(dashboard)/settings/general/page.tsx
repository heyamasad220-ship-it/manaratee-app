import { Header } from "@/components/layout/header"
import { DonationReceiptSettingsForm } from "@/components/donations/donation-receipt-settings-form"
import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"

export default async function OrganizationGeneralSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.SETTINGS_USERS_VIEW,
    PERMISSIONS.DONATIONS_MANAGE
  )

  return (
    <>
      <Header title="General Settings" />
      <div className="p-6">
        <DonationReceiptSettingsForm mode="general" />
      </div>
    </>
  )
}
