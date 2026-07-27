"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { removeHouseholdMemberAction } from "@/lib/contacts/family-management-actions"
import type { FamilyMemberGivingRow } from "@/lib/contacts/family-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value)
}

function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildRemoveConfirmMessage(member: FamilyMemberGivingRow) {
  if (member.isMinor || !member.contactId) {
    return [
      `Remove ${member.memberName || "this member"} from this household?`,
      "",
      "They will no longer appear on this household page. Their person record stays under the parent Contact family panel unless you remove it there too.",
    ].join("\n")
  }

  return [
    `Remove ${member.memberName || "this member"} from this household?`,
    "",
    "Their individual contact profile and all donations will stay on their record.",
    "They will no longer appear in this household's giving totals.",
  ].join("\n")
}

type FamilyMembersPanelProps = {
  familyId: string
  primaryContactId: string | null
  members: FamilyMemberGivingRow[]
  canManage: boolean
}

export function FamilyMembersPanel({
  familyId,
  primaryContactId,
  members,
  canManage,
}: FamilyMembersPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  function handleRemove(member: FamilyMemberGivingRow) {
    const isPrimary = Boolean(member.contactId) && primaryContactId === member.contactId
    const hasOtherMembers = members.length > 1

    if (isPrimary && hasOtherMembers) {
      setError("Change the primary contact / head before removing this member from the household.")
      return
    }

    if (!window.confirm(buildRemoveConfirmMessage(member))) {
      return
    }

    setError(null)
    setRemovingMemberId(member.id)
    startTransition(async () => {
      const result = await removeHouseholdMemberAction({
        familyId,
        memberId: member.id,
        memberContactId: member.contactId,
        memberPersonId: member.personId,
      })

      setRemovingMemberId(null)

      if (!result.success) {
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Adults show phone and email from their contact. Minors have no separate contact profile.
          Giving totals use adult contacts only.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="mx-6 mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {members.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No active members.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Lifetime Giving</TableHead>
                <TableHead>Gifts</TableHead>
                {canManage ? <TableHead className="w-[72px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isPrimary =
                  Boolean(member.contactId) && primaryContactId === member.contactId
                const cannotRemove = isPrimary && members.length > 1

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {member.contactId ? (
                          <Link
                            href={contactProfileHref(member.contactId, {
                              list: "families",
                            })}
                            className="text-primary hover:underline"
                          >
                            {member.memberName || "Unnamed"}
                          </Link>
                        ) : (
                          <span>{member.memberName || "Unnamed"}</span>
                        )}
                        {member.isMinor ? (
                          <Badge variant="secondary" className="text-xs">
                            Minor
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>{formatRole(member.role)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.isMinor ? "—" : member.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.isMinor ? "—" : member.email || "—"}
                    </TableCell>
                    <TableCell>
                      {member.isMinor ? "—" : formatCurrency(member.totalDonations)}
                    </TableCell>
                    <TableCell>{member.isMinor ? "—" : member.donationCount}</TableCell>
                    {canManage ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={isPending || cannotRemove}
                          title={
                            cannotRemove
                              ? "Change the household head before removing this member."
                              : "Remove from household"
                          }
                          onClick={() => handleRemove(member)}
                        >
                          {isPending && removingMemberId === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
