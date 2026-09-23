import { Header } from "@/components/layout/header"
import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { requireSignUpsAccess } from "@/lib/sign-ups/sign-up-access"

export default async function SignUpsSettingsPage() {
  await requireSignUpsAccess()

  return (
    <>
      <Header title="Settings" />
      <PlaceholderPage
        title="Settings"
        description="Sign-up settings will be set up on this page."
      />
    </>
  )
}