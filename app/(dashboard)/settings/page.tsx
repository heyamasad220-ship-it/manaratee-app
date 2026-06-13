import { PlaceholderPage } from "@/components/layout/placeholder-page"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function GlobalSettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <PlaceholderPage
        title="Settings"
        description="Manage your organization account, access, and subscription."
      />
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/settings/users">Users</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/settings/roles-permissions">Roles &amp; Permissions</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/settings/subscription">Subscription</Link>
        </Button>
      </div>
    </div>
  )
}
