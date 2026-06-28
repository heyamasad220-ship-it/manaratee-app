"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Search, UserMinus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  addGroupMemberAction,
  removeGroupMemberAction,
  searchIndividualsForGroupMemberAction,
} from "@/lib/contacts/group-member-actions"
import { fetchGroupMembersAction } from "@/lib/contacts/group-members-load-action"
import type { GroupMemberRow } from "@/lib/contacts/group-member-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

type ContactGroupMembersPanelProps = {
  groupContactId: string
  groupName: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function ContactGroupMembersPanel({
  groupContactId,
  groupName,
}: ContactGroupMembersPanelProps) {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<GroupMemberRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<
    Array<{ contactId: string; full_name: string | null; email: string | null; phone: string | null }>
  >([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadMembers() {
      setLoading(true)
      setError(null)

      try {
        const result = await fetchGroupMembersAction(groupContactId)
        if (cancelled) return

        if (!result?.success) {
          setError(result?.error || "Could not load group members.")
          setMembers([])
          return
        }

        setMembers(result.members)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "Could not load group members.")
        setMembers([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMembers()

    return () => {
      cancelled = true
    }
  }, [groupContactId])

  const reloadMembers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchGroupMembersAction(groupContactId)
      if (!result?.success) {
        setError(result?.error || "Could not load group members.")
        setMembers([])
        return
      }
      setMembers(result.members)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load group members.")
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [groupContactId])

  useEffect(() => {
    if (!dialogOpen) return
    if (search.trim().length < 2) {
      setResults([])
      return
    }

    const timer = window.setTimeout(async () => {
      setSearching(true)
      const result = await searchIndividualsForGroupMemberAction(search.trim(), 20)
      setSearching(false)
      if (!result.success) {
        setResults([])
        return
      }
      const memberIds = new Set(members.map((member) => member.memberContactId))
      setResults(result.contacts.filter((contact) => !memberIds.has(contact.contactId)))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [dialogOpen, members, search])

  async function handleAddMember(contactId: string) {
    setSaving(true)
    const result = await addGroupMemberAction({
      groupContactId,
      memberContactId: contactId,
    })
    setSaving(false)

    if (!result.success) {
      alert(result.error)
      return
    }

    setDialogOpen(false)
    setSearch("")
    setResults([])
    await reloadMembers()
  }

  async function handleRemoveMember(membershipId: string, memberName: string | null) {
    if (!confirm(`Remove ${memberName || "this member"} from ${groupName}?`)) return

    const result = await removeGroupMemberAction(membershipId)
    if (!result.success) {
      alert(result.error)
      return
    }
    await reloadMembers()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Members
          </CardTitle>
          <CardDescription>
            People who belong to {groupName}. When a member selects this group on a gift, they are
            added here automatically.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add member
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading members...
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members yet. Add people who donate individually but belong to this group.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Individual giving</TableHead>
                  <TableHead>Last gift</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Link
                        href={contactProfileHref(member.memberContactId, "financial")}
                        className="font-medium text-primary hover:underline"
                      >
                        {member.memberName || "Unnamed contact"}
                      </Link>
                      {member.memberEmail ? (
                        <p className="text-xs text-muted-foreground">{member.memberEmail}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(member.totalDonations)}
                      {member.donationCount > 0 ? (
                        <Badge variant="secondary" className="ml-2">
                          {member.donationCount}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatDate(member.lastDonationDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${member.memberName || "member"}`}
                        onClick={() => void handleRemoveMember(member.id, member.memberName)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add group member</DialogTitle>
            <DialogDescription>
              Search for an individual contact to add to {groupName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-member-search">Search people</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="group-member-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, email, or phone"
                  className="pl-9"
                />
              </div>
            </div>
            {searching ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </p>
            ) : null}
            {results.length > 0 ? (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
                {results.map((contact) => (
                  <button
                    key={contact.contactId}
                    type="button"
                    disabled={saving}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    onClick={() => void handleAddMember(contact.contactId)}
                  >
                    <p className="font-medium">{contact.full_name || "Unnamed contact"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact info"}
                    </p>
                  </button>
                ))}
              </div>
            ) : search.trim().length >= 2 && !searching ? (
              <p className="text-sm text-muted-foreground">No matching people found.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
