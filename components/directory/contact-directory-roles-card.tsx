"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ROLE_COLORS,
  ROLE_VALUE_TO_LABEL,
  type ContactRoleValue,
} from "@/lib/contacts/contact-constants"
import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

type RoleLink = {
  role: ContactRoleValue
  href: string
  action: string
}

function linksForRoles(input: {
  contactId: string
  roles: ContactRoleValue[]
  modules: ContactProfileModuleFlags
  staffRecordId: string | null
}): RoleLink[] {
  const links: RoleLink[] = []
  const { contactId, roles, modules, staffRecordId } = input

  if (roles.includes("employee") && modules.workforce) {
    links.push({
      role: "employee",
      href: staffRecordId ? contactProfileHref(contactId) : "/workforce/employees",
      action: staffRecordId ? "Open Workforce" : "Complete setup in Workforce",
    })
  }
  if (roles.includes("volunteer") && modules.workforce) {
    links.push({
      role: "volunteer",
      href: "/workforce/volunteers",
      action: "Open Workforce",
    })
  }
  if (roles.includes("member") && modules.membership) {
    links.push({
      role: "member",
      href: "/membership/members",
      action: "Open Membership",
    })
  }
  if (roles.includes("donor") && modules.donations) {
    links.push({
      role: "donor",
      href: contactProfileHref(contactId, { tab: "financial" }),
      action: "Open Fund Development history",
    })
  }
  if (roles.includes("sponsor") && modules.donations) {
    links.push({
      role: "sponsor",
      href: "/donations/campaigns",
      action: "Open Fund Development",
    })
  }
  if (roles.includes("vendor") && modules.vendorHub) {
    links.push({
      role: "vendor",
      href: VENDOR_HUB_ROUTES.network.vendor(contactId),
      action: "Open Vendor Hub",
    })
  }
  if (roles.includes("service_provider") && modules.workforce) {
    links.push({
      role: "service_provider",
      href: "/workforce/service-providers",
      action: "Open Workforce",
    })
  }
  if (roles.includes("childcare_provider") && modules.workforce) {
    links.push({
      role: "childcare_provider",
      href: "/workforce/childcare",
      action: "Open Workforce",
    })
  }
  if (roles.includes("customer") && modules.bookings) {
    links.push({
      role: "customer",
      href: "/bookings/requests",
      action: "Open Venue Rentals",
    })
  }

  return links
}

export function ContactDirectoryRolesCard({
  contactId,
  roles,
  modules,
  staffRecordId,
}: {
  contactId: string
  roles: ContactRoleValue[]
  modules: ContactProfileModuleFlags
  staffRecordId: string | null
}) {
  if (roles.length === 0) return null

  const links = linksForRoles({ contactId, roles, modules, staffRecordId })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Roles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {roles.map((role) => {
            const label = ROLE_VALUE_TO_LABEL[role]
            return (
              <Badge key={role} variant="secondary" className={ROLE_COLORS[label]}>
                {label}
              </Badge>
            )
          })}
        </div>
        {links.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {links.map((link) => (
              <li key={link.role} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-muted-foreground">{ROLE_VALUE_TO_LABEL[link.role]}</span>
                <Link href={link.href} className="font-medium text-primary hover:underline">
                  {link.action}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            This is the Directory identity record. Operational work stays in the related module.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
