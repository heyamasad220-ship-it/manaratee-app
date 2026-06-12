import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { enterCustomerPortalAsUser } from "@/lib/organizations/org-user-access-actions"

export function EnterCustomerPortalAsUserButton({
  organizationId,
  targetUserId,
  userLabel,
  variant = "default",
  size = "sm",
}: {
  organizationId: string
  targetUserId: string
  userLabel: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}) {
  const openPortal = enterCustomerPortalAsUser.bind(
    null,
    organizationId,
    targetUserId
  )

  return (
    <form action={openPortal}>
      <Button
        type="submit"
        variant={variant}
        size={size}
        title={`Open customer portal as ${userLabel}`}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open portal as user
      </Button>
    </form>
  )
}
