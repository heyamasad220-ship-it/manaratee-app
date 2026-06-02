"use client"

import Link from "next/link"
import { UserCheck } from "lucide-react"
import { ROLE_VALUE_TO_LABEL } from "@/lib/contacts/contact-constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ContactMemberPanelProps = {
  contactStatus?: string | null
  contactCreatedAt?: string | null
  teamsCount: number
}

function formatText(value: string | null | undefined) {
  if (!value) return "-"
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function ContactMemberPanel({
  contactStatus,
  contactCreatedAt,
  teamsCount,
}: ContactMemberPanelProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="size-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Membership</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/hr/members">View members</Link>
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Member affiliation is recorded on this contact. Detailed membership records (type,
          renewal, benefits) are not configured yet — only the affiliation is shown below.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Affiliation</p>
            <Badge variant="secondary" className="mt-1">
              {ROLE_VALUE_TO_LABEL.member}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Membership status</p>
            <p className="font-medium">{formatText(contactStatus || "active")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Member since</p>
            <p className="font-medium">{formatDate(contactCreatedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Teams</p>
            <p className="font-medium">{teamsCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
