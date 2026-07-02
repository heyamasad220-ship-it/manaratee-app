import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  pledgeGroupBadgeClassName,
  showsPrimaryContactSubline,
  type PledgeMemberGroup,
} from "@/lib/donations/pledge-donor-context"
import type { ContactRecordType } from "@/lib/contacts/contact-constants"

type PledgeDonorSublineProps = {
  contactType: ContactRecordType | null
  primaryContactName?: string | null
  memberGroups: PledgeMemberGroup[]
  className?: string
  onNavigate?: () => void
}

export function PledgeDonorSubline({
  contactType,
  primaryContactName,
  memberGroups,
  className,
  onNavigate,
}: PledgeDonorSublineProps) {
  if (showsPrimaryContactSubline(contactType)) {
    const label = primaryContactName?.trim()
      ? `Primary contact: ${primaryContactName.trim()}`
      : "Primary contact"

    return <p className={className ?? "text-sm text-muted-foreground"}>{label}</p>
  }

  if (memberGroups.length === 0) {
    return null
  }

  return (
    <div className={className ?? "mt-0.5 flex flex-wrap gap-1"}>
      {memberGroups.map((group, index) => (
        <Badge
          key={group.id}
          className={`text-xs font-normal ${pledgeGroupBadgeClassName(index)}`}
          asChild
        >
          <Link
            href={contactProfileHref(group.id, { list: "groups", tab: "financial" })}
            onClick={(event) => {
              event.stopPropagation()
              onNavigate?.()
            }}
          >
            {group.groupName || "Unnamed group"}
          </Link>
        </Badge>
      ))}
    </div>
  )
}
