import { Header } from "@/components/layout/header"
import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { requireSignUpsAccess } from "@/lib/sign-ups/sign-up-access"

export default async function SignUpsNotificationsPage() {
  await requireSignUpsAccess()

  return (
    <>
      <Header title="Notifications" />
      <PlaceholderPage
        title="Notifications"
        description="Notifications to volunteers will be set up on this page."
      />
    </>
  )
}
