import { UserRoundSearch } from "lucide-react"

import { Button } from "@/components/ui/button"
import { exitOrgUserSupport, getOrgUserSupportSessionInfo } from "@/lib/organizations/org-user-access-actions"

export async function OrgUserSupportBanner() {
  const session = await getOrgUserSupportSessionInfo()

  if (!session) {
    return null
  }

  return (
    <div className="border-b border-sky-300 bg-sky-50 px-4 py-2 text-sky-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <UserRoundSearch className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">User support mode</span> — viewing{" "}
            <span className="font-medium">{session.targetUserName}</span>
            {session.targetUserEmail ? (
              <>
                {" "}
                (<span className="font-mono text-xs">{session.targetUserEmail}</span>)
              </>
            ) : null}{" "}
            at <span className="font-medium">{session.organizationName}</span>. Actions you take
            apply to this user&apos;s account.
          </p>
        </div>
        <form action={exitOrgUserSupport}>
          <Button type="submit" size="sm" variant="outline" className="shrink-0 bg-white">
            Exit user support
          </Button>
        </form>
      </div>
    </div>
  )
}
