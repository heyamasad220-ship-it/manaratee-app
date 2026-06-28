"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchContactGroupsAction } from "@/lib/contacts/group-member-actions"
import type { ContactGroupSummary } from "@/lib/contacts/group-member-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

type ContactMemberGroupsPanelProps = {
  contactId: string
  contactName: string
}

export function ContactMemberGroupsPanel({
  contactId,
  contactName,
}: ContactMemberGroupsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<ContactGroupSummary[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await fetchContactGroupsAction(contactId)
      setLoading(false)
      if (!result.success) {
        setGroups([])
        return
      }
      setGroups(result.groups)
    }
    void load()
  }, [contactId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading groups...
        </CardContent>
      </Card>
    )
  }

  if (groups.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Groups
        </CardTitle>
        <CardDescription>
          Collectives {contactName} belongs to. Group gifts are recorded on the group profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.map((group) => (
          <Link
            key={group.id}
            href={contactProfileHref(group.id, "financial")}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            <span className="font-medium">{group.groupName || "Unnamed group"}</span>
            <span className="text-muted-foreground">View group giving →</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
