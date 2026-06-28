"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  addGroupMemberAction,
  fetchContactGroupsAction,
  searchGroupsForContactMemberAction,
} from "@/lib/contacts/group-member-actions"
import type { ContactGroupSummary } from "@/lib/contacts/group-member-types"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

type GroupSearchResult = {
  contactId: string
  full_name: string | null
  primary_contact_name: string | null
}

function formatGroupLabel(group: GroupSearchResult) {
  return group.full_name || group.primary_contact_name || "Unnamed group"
}

export function ContactOverviewGroupsBar({ contactId }: { contactId: string }) {
  const [loaded, setLoaded] = useState(false)
  const [groups, setGroups] = useState<ContactGroupSummary[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<GroupSearchResult[]>([])
  const [saving, setSaving] = useState(false)

  const loadGroups = useCallback(async () => {
    setLoaded(false)
    try {
      const result = await fetchContactGroupsAction(contactId)
      setGroups(result.success ? result.groups : [])
    } catch (error) {
      console.error("Error loading contact groups:", error)
      setGroups([])
    } finally {
      setLoaded(true)
    }
  }, [contactId])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  useEffect(() => {
    if (!dialogOpen) return

    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const result = await searchGroupsForContactMemberAction(search.trim(), 20)
        if (!result.success) {
          setResults([])
          return
        }
        const assignedGroupIds = new Set(groups.map((group) => group.id))
        setResults(result.groups.filter((group) => !assignedGroupIds.has(group.contactId)))
      } catch (error) {
        console.error("Error searching groups:", error)
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [dialogOpen, groups, search])

  async function handleAssignGroup(groupContactId: string) {
    setSaving(true)
    try {
      const result = await addGroupMemberAction({
        groupContactId,
        memberContactId: contactId,
      })
      if (!result.success) {
        alert(result.error)
        return
      }
      setDialogOpen(false)
      setSearch("")
      setResults([])
      await loadGroups()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {loaded
          ? groups.map((group) => (
              <Badge key={group.id} variant="outline" className="font-normal" asChild>
                <Link href={contactProfileHref(group.id, { list: "groups", tab: "financial" })}>
                  {group.groupName || "Unnamed group"}
                </Link>
              </Badge>
            ))
          : null}
        <Button
          type="button"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Assign to a group
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign to group</DialogTitle>
            <DialogDescription>
              Search for a group to add this contact as a member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="contact-group-search">Search groups</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="contact-group-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Group name or primary contact"
                  className="pl-9"
                  autoFocus
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
                {results.map((group) => (
                  <button
                    key={group.contactId}
                    type="button"
                    disabled={saving}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    onClick={() => void handleAssignGroup(group.contactId)}
                  >
                    <p className="font-medium">{formatGroupLabel(group)}</p>
                    {group.primary_contact_name && group.full_name ? (
                      <p className="text-xs text-muted-foreground">
                        Primary contact: {group.primary_contact_name}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : loaded && !searching && search.trim().length > 0 ? (
              <p className="text-sm text-muted-foreground">No matching groups found.</p>
            ) : !searching && results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups available to assign.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
