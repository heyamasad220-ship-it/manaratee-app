import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"
import { parseDirectoryRoleKey } from "@/lib/directory/directory-paths"
import { isDirectoryFacilitiesEnabled } from "@/lib/directory/directory-nav-summary"
import { getDirectoryRoleDef } from "@/lib/directory/directory-roles"

export default async function DirectoryRoleViewPage({
  params,
}: {
  params: Promise<{ role: string }>
}) {
  const { role } = await params
  const roleKey = parseDirectoryRoleKey(role)
  if (!roleKey) notFound()

  const facilitiesEnabled = await isDirectoryFacilitiesEnabled()
  if (roleKey === "service-providers" && !facilitiesEnabled) notFound()

  const def = getDirectoryRoleDef(roleKey)

  return (
    <>
      <Header title={def.label} />
      <ContactsCrmList
        lockedRoleKey={roleKey}
        showStats={false}
        defaultAddRoles={def.contactRole ? [def.contactRole] : []}
        facilitiesEnabled={facilitiesEnabled}
        emptyTitle={`No ${def.label.toLowerCase()} yet`}
        emptyDescription={
          "emptyDescription" in def && def.emptyDescription
            ? def.emptyDescription
            : "This view lists canonical Directory records with this role. Operational work stays in the related module."
        }
        intro={
          def.operationalHref ? (
            <p className="text-sm text-muted-foreground">
              Directory lookup only. {def.operationalLabel ? (
                <a href={def.operationalHref} className="font-medium text-primary hover:underline">
                  {def.operationalLabel}
                </a>
              ) : null}
            </p>
          ) : null
        }
      />
    </>
  )
}
