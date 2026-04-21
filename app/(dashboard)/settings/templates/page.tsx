import { Header } from "@/components/layout/header"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export default function TemplatesPage() {
  return (
    <>
      <Header title="Templates" />
      <div className="p-6">
        <PlaceholderPage
          title="Templates"
          description="Manage your event and communication templates."
        />
      </div>
    </>
  )
}
