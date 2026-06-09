import { Header } from "@/components/layout/header"
import { MembershipTypesSettings } from "@/components/memberships/membership-types-settings"

export default function MembershipSettingsPage() {
  return (
    <>
      <Header title="Settings" />
      <div className="p-6">
        <MembershipTypesSettings />
      </div>
    </>
  )
}
