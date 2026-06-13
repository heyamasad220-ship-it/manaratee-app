"use client"

import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { enterOrganizationAsPlatformAdmin } from "@/lib/platform/platform-org-access-actions"

export function PlatformEnterOrganizationButton({
  organizationId,
  organizationName,
}: {
  organizationId: string
  organizationName: string
}) {
  const enterOrganization = enterOrganizationAsPlatformAdmin.bind(null, organizationId)

  return (
    <form action={enterOrganization}>
      <Button
        type="submit"
        className="bg-emerald-600 text-white hover:bg-emerald-700"
        title={`Open ${organizationName} dashboard`}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open organization dashboard
      </Button>
    </form>
  )
}
