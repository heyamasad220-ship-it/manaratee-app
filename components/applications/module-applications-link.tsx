import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  moduleApplicationsUrl,
  peopleManagementApplicationsUrl,
} from "@/lib/applications/application-routes"
import type { ModuleOwner } from "@/lib/applications/application-types"
import { FileText } from "lucide-react"

export function ModuleApplicationsLink({
  applicationType,
  moduleOwner,
  label = "Applications",
}: {
  applicationType?: string
  moduleOwner?: ModuleOwner
  label?: string
}) {
  const href =
    moduleOwner === "hr" || applicationType
      ? peopleManagementApplicationsUrl({
          pageTab: "submissions",
          applicationType,
        })
      : moduleApplicationsUrl({ moduleOwner })

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>
        <FileText className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}
