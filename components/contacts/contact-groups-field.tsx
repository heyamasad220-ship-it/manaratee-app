"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Label } from "@/components/ui/label"
import { fetchContactGroupsAction } from "@/lib/contacts/group-member-actions"
import type { ContactGroupSummary } from "@/lib/contacts/group-member-types"
import { donationGroupHref } from "@/lib/donations/donation-group-path"
import { cn } from "@/lib/utils"

type ContactGroupsFieldProps = {
  contactId: string
  editing?: boolean
  className?: string
}

export function ContactGroupsField({
  contactId,
  editing = false,
  className,
}: ContactGroupsFieldProps) {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<ContactGroupSummary[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchContactGroupsAction(contactId)
    setLoading(false)
    if (!result.success) {
      setGroups([])
      return
    }
    setGroups(result.groups)
  }, [contactId])

  useEffect(() => {
    void load()
  }, [load])

  const list = loading ? (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>Loading...</span>
    </div>
  ) : groups.length === 0 ? (
    <span>—</span>
  ) : (
    <ul className="space-y-1">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={donationGroupHref(group.id, {
              tab: "financial",
              returnTo: "/donations/reports/donors?view=group",
            })}
            className="text-foreground hover:underline"
          >
            {group.groupName || "Unnamed group"}
          </Link>
        </li>
      ))}
    </ul>
  )

  if (editing) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label>Groups</Label>
        <div className="min-h-9 text-sm">{list}</div>
      </div>
    )
  }

  return (
    <div className={cn(className)}>
      <dt className="text-xs font-medium text-muted-foreground">Groups</dt>
      <dd className="mt-0.5">{list}</dd>
    </div>
  )
}
