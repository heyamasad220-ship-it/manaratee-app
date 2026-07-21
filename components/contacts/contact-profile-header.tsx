"use client"

import type { ReactNode } from "react"
import { Building2, Mail, MapPin, Phone, Users } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  getContactRecordTypeLabel,
  mapStatus,
  ROLE_COLORS,
  ROLE_ICONS,
  STATUS_COLORS,
  type ContactRecordType,
  type ContactRoleLabel,
} from "@/lib/contacts/contact-constants"

function getInitials(name: string) {
  return (name?.trim() || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatLocation(contact: {
  city?: string | null
  state?: string | null
  address?: string | null
}) {
  const cityState = [contact.city, contact.state].filter(Boolean).join(", ")
  if (cityState) return cityState
  return contact.address?.trim() || null
}

export function ContactProfileHeader({
  contactName,
  recordType,
  status,
  roleLabels,
  phone,
  email,
  city,
  state,
  address,
  actions,
}: {
  contactName: string
  recordType: ContactRecordType
  status: string | null | undefined
  roleLabels: ContactRoleLabel[]
  phone?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  address?: string | null
  actions?: ReactNode
}) {
  const isOrganization = recordType === "organization"
  const isGroup = recordType === "group"
  const location = formatLocation({ city, state, address })
  const displayName = contactName || "Unnamed Contact"
  const mappedStatus = mapStatus(status)

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <Avatar className="h-14 w-14 shrink-0 border border-border">
          <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
            {isOrganization ? (
              <Building2 className="h-6 w-6" />
            ) : isGroup ? (
              <Users className="h-6 w-6" />
            ) : (
              getInitials(displayName)
            )}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{displayName}</h1>
            <Badge
              variant="secondary"
              className={cn("font-normal", STATUS_COLORS[mappedStatus])}
            >
              {mappedStatus}
            </Badge>
            {roleLabels.length > 0 ? (
              roleLabels.map((label) => {
                const RoleIcon = ROLE_ICONS[label]
                return (
                  <Badge
                    key={label}
                    variant="secondary"
                    className={cn("gap-1 font-normal", ROLE_COLORS[label])}
                  >
                    <RoleIcon className="h-3 w-3" />
                    {label}
                  </Badge>
                )
              })
            ) : isOrganization || isGroup ? (
              <Badge variant="outline" className="font-normal">
                {getContactRecordTypeLabel(recordType)}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {phone ? (
                <a href={`tel:${phone}`} className="text-foreground hover:underline">
                  {phone}
                </a>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {email ? (
                <a href={`mailto:${email}`} className="text-foreground hover:underline">
                  {email}
                </a>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location ? (
                <span className="text-foreground">{location}</span>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
