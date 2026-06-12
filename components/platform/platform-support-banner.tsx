import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  exitPlatformAdminOrgAccess,
  getPlatformSupportSessionInfo,
} from "@/lib/platform/platform-org-access-actions"

export async function PlatformSupportBanner() {
  const session = await getPlatformSupportSessionInfo()

  if (!session) {
    return null
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">Platform support mode</span> — viewing{" "}
            <span className="font-medium">{session.organizationName}</span> as a platform
            admin. Changes affect this organization&apos;s live data.
          </p>
        </div>
        <form action={exitPlatformAdminOrgAccess}>
          <Button type="submit" size="sm" variant="outline" className="shrink-0 bg-white">
            Exit to Platform Admin
          </Button>
        </form>
      </div>
    </div>
  )
}
