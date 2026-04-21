import { Header } from "@/components/layout/header"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export default function EmailSettingsPage() {
  return (
    <>
      <Header title="Email Settings" />
      <div className="p-6">
        <PlaceholderPage
          title="Email Settings"
          description="Configure email notifications and communication preferences."
        />
      </div>
    </>
  )
}
