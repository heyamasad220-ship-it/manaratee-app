"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  fetchContactListStats,
  fetchContactsList,
  type ContactListRow,
  type ContactListStats,
} from "@/lib/contacts/contact-list-actions"
import {
  addContactWithRoles,
} from "@/lib/contacts/contact-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  contactsListSegmentForRecordType,
  type ContactsListSegment,
} from "@/lib/contacts/contact-module-label"
import {
  type ContactRecordType,
  type ContactRoleValue,
  getContactRecordTypeLabel,
  STATUS_COLORS,
  usesPrimaryContactField,
} from "@/lib/contacts/contact-constants"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  User,
} from "lucide-react"

const PAGE_SIZE = 50

export type ContactsCrmListProps = {
  /** Lock the list to people or organizations. */
  lockedRecordType?: ContactRecordType
  /** Show dashboard metric cards. Defaults to true. */
  showStats?: boolean
  /** Pre-selected roles when adding a contact. */
  defaultAddRoles?: ContactRoleValue[]
  /** Optional intro copy above filters. */
  intro?: ReactNode
}

function getInitials(name: string) {
  const fallback = name?.trim() || "?"
  return fallback
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function ContactsCrmList({
  lockedRecordType,
  showStats = true,
  defaultAddRoles = [],
  intro,
}: ContactsCrmListProps = {}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const entityLabel =
    lockedRecordType === "organization"
      ? "Organizations"
      : lockedRecordType === "group"
        ? "Groups"
        : lockedRecordType === "individual"
          ? "People"
          : "Contacts"
  const entitySingular =
    lockedRecordType === "organization"
      ? "organization"
      : lockedRecordType === "group"
        ? "group"
        : lockedRecordType === "individual"
          ? "person"
          : "contact"
  const searchPlaceholder =
    lockedRecordType === "organization"
      ? "Search organizations by name, email, or phone..."
      : lockedRecordType === "group"
        ? "Search groups by name, primary contact, email, or phone..."
        : lockedRecordType === "individual"
          ? "Search people by name, email, or phone..."
          : "Search contacts by name, email, phone, or organization..."
  const addButtonLabel =
    lockedRecordType === "organization"
      ? "Add Organization"
      : lockedRecordType === "group"
        ? "Add Group"
        : lockedRecordType === "individual"
          ? "Add Person"
          : "Add Contact"

  const [stats, setStats] = useState<ContactListStats>({
    total: 0,
    people: 0,
    organizations: 0,
    groups: 0,
  })
  const [contacts, setContacts] = useState<ContactListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isRecentView, setIsRecentView] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [recordTypeFilter, setRecordTypeFilter] = useState<ContactRecordType | "all">("all")

  const [showAddDialog, setShowAddDialog] = useState(false)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactPrimaryContactName, setContactPrimaryContactName] = useState("")
  const [contactType, setContactType] = useState<ContactRecordType>(
    lockedRecordType || "individual"
  )
  const [contactRoles, setContactRoles] = useState<ContactRoleValue[]>(defaultAddRoles)
  const [contactNotes, setContactNotes] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, recordTypeFilter])

  const loadStats = useCallback(async () => {
    try {
      const nextStats = await fetchContactListStats(
        lockedRecordType ? { recordType: lockedRecordType } : undefined
      )
      setStats(nextStats)
    } catch (error) {
      console.error(error)
    }
  }, [lockedRecordType])

  const loadContacts = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")
    try {
      const result = await fetchContactsList({
        search: debouncedSearch || undefined,
        recordType: lockedRecordType ? "all" : recordTypeFilter,
        lockedRecordType,
        page,
        pageSize: PAGE_SIZE,
      })
      setContacts(result.contacts)
      setTotal(result.total)
      setIsRecentView(result.isRecentView)
    } catch (error: any) {
      console.error(error)
      setContacts([])
      setTotal(0)
      setErrorMessage(error?.message || "Could not load contacts.")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, lockedRecordType, page, recordTypeFilter])

  useEffect(() => {
    if (showStats) {
      void loadStats()
    }
  }, [loadStats, showStats])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  const hasActiveFilters = useMemo(() => {
    const recordTypeFiltered = !lockedRecordType && recordTypeFilter !== "all"
    return Boolean(debouncedSearch || recordTypeFiltered)
  }, [debouncedSearch, lockedRecordType, recordTypeFilter])

  const listTitle = isRecentView ? `Recent ${entityLabel}` : entityLabel
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function clearFilters() {
    setSearchQuery("")
    setDebouncedSearch("")
    if (!lockedRecordType) {
      setRecordTypeFilter("all")
    }
    setPage(1)
  }

  function resetAddForm() {
    setContactName("")
    setContactEmail("")
    setContactPhone("")
    setContactPrimaryContactName("")
    setContactType(lockedRecordType || "individual")
    setContactRoles(defaultAddRoles)
    setContactNotes("")
  }

  function usesPrimaryContact(type: ContactRecordType) {
    return usesPrimaryContactField(type)
  }

  function profileListSegmentForContact(contact: ContactListRow): ContactsListSegment {
    if (lockedRecordType === "organization") return "organizations"
    if (lockedRecordType === "group") return "groups"
    if (lockedRecordType === "individual") return "people"
    return contactsListSegmentForRecordType(contact.recordType)
  }

  function profileHrefForContact(contact: ContactListRow, options?: { edit?: boolean }) {
    return contactProfileHref(contact.id, {
      list: profileListSegmentForContact(contact),
      edit: options?.edit,
    })
  }

  async function refreshAfterMutation() {
    const tasks = [loadContacts()]
    if (showStats) {
      tasks.push(loadStats())
    }
    await Promise.all(tasks)
  }

  async function handleAddContact() {
    const cleanName = contactName.trim()
    if (!cleanName) {
      alert("Contact name is required")
      return
    }
    setSaving(true)
    try {
      await addContactWithRoles({
        fullName: cleanName,
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        primaryContactName: usesPrimaryContact(contactType)
          ? contactPrimaryContactName.trim() || undefined
          : undefined,
        contactType,
        notes: contactNotes.trim() || undefined,
        roles: contactRoles,
      })
      resetAddForm()
      setShowAddDialog(false)
      await refreshAfterMutation()
    } catch (error: any) {
      alert(error?.message || "Could not add contact")
    } finally {
      setSaving(false)
    }
  }

  const statCards = lockedRecordType
    ? []
    : [
        { label: "Total Contacts", value: stats.total, icon: User },
        { label: "People", value: stats.people, icon: User },
        { label: "Organizations", value: stats.organizations, icon: Building2 },
      ]

  const tableColumnCount = !lockedRecordType
    ? 7
    : lockedRecordType === "organization" || lockedRecordType === "group"
      ? 7
      : 6

  return (
    <div className="flex flex-col gap-6 p-6">
      {intro}
      {showStats && statCards.length > 0 && (
        <StatCardsRow>
          {statCards.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value.toLocaleString()}
              icon={stat.icon}
              layout="compact"
            />
          ))}
        </StatCardsRow>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-12 pl-12 text-base"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear search
          </Button>
        )}

        <Button
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => {
            resetAddForm()
            setShowAddDialog(true)
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {addButtonLabel}
        </Button>
      </div>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{listTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? `Loading ${entityLabel.toLowerCase()}...`
              : total === 0
                ? `No ${entityLabel.toLowerCase()} yet`
                : isRecentView
                  ? `Showing ${rangeEnd.toLocaleString()} of ${total.toLocaleString()} ${entityLabel.toLowerCase()}`
                  : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()} ${entityLabel.toLowerCase()}`}
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Created by</TableHead>
                <TableHead className="hidden sm:table-cell">Last modified</TableHead>
                {lockedRecordType === "organization" || lockedRecordType === "group" ? (
                  <TableHead className="hidden xl:table-cell">Primary Contact</TableHead>
                ) : null}
                {!lockedRecordType && (
                  <TableHead className="hidden xl:table-cell">Type</TableHead>
                )}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} className="h-24 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading {entityLabel.toLowerCase()}...
                    </div>
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} className="h-24 text-center text-muted-foreground">
                    {hasActiveFilters ? (
                      <div className="flex flex-col items-center gap-2">
                        <span>No {entityLabel.toLowerCase()} found.</span>
                        <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                          Clear search
                        </Button>
                      </div>
                    ) : (
                      `No recent ${entityLabel.toLowerCase()} yet.`
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    onClick={() =>
                      router.push(profileHrefForContact(contact, { edit: true }))
                    }
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-primary hover:underline">
                            {contact.name}
                          </span>
                          <span className="text-sm text-muted-foreground md:hidden">
                            {contact.email || contact.phone || "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {contact.email || "—"}
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {contact.phone || "—"}
                    </TableCell>

                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      —
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDateTime(contact.updatedAt || contact.createdAt)}
                    </TableCell>

                    {lockedRecordType === "organization" || lockedRecordType === "group" ? (
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {contact.primaryContactName || "—"}
                      </TableCell>
                    ) : null}

                    {!lockedRecordType && (
                      <TableCell className="hidden xl:table-cell">
                        <Badge variant="outline">
                          {getContactRecordTypeLabel(contact.recordType)}
                        </Badge>
                      </TableCell>
                    )}

                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[contact.status]}>
                        {contact.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Page 1 of 1"
            : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New {entitySingular === "contact" ? "Contact" : entitySingular === "person" ? "Person" : "Organization"}</DialogTitle>
            <DialogDescription>
              Create a {entitySingular} with basic details. Roles such as Donor are added automatically
              from activity; you can edit roles later on the contact profile. Existing records are
              matched by email, phone, or name — never duplicated.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="crm-name">
                {contactType === "organization"
                  ? "Organization Name"
                  : contactType === "group"
                    ? "Group Name"
                    : "Full Name"}
              </Label>
              <Input
                id="crm-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="crm-email">Email</Label>
                <Input
                  id="crm-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="crm-phone">Phone</Label>
                <Input
                  id="crm-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>
            {usesPrimaryContact(contactType) ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="crm-primary-contact">Primary Contact Name</Label>
                <Input
                  id="crm-primary-contact"
                  placeholder={
                    contactType === "group"
                      ? "Leader or coordinator for this group"
                      : "Person we reach at this organization"
                  }
                  value={contactPrimaryContactName}
                  onChange={(e) => setContactPrimaryContactName(e.target.value)}
                />
              </div>
            ) : null}
            {!lockedRecordType && (
              <div className="flex flex-col gap-2">
                <Label>Record Type</Label>
                <Select
                  value={contactType}
                  onValueChange={(value) => setContactType(value as ContactRecordType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Person</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="crm-notes">Notes</Label>
              <Textarea
                id="crm-notes"
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={saving}>
              {saving ? "Saving..." : addButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
