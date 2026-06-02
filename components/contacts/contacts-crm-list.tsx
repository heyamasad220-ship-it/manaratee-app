"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  fetchContactListStats,
  fetchContactsList,
  type ContactListRow,
  type ContactListStats,
} from "@/lib/contacts/contact-list-actions"
import {
  addContactWithRoles,
  syncContactRoles,
} from "@/lib/contacts/contact-actions"
import { fetchHrTeams } from "@/lib/hr/hr-team-actions"
import {
  type ContactRecordType,
  type ContactRoleValue,
  type ContactStatus,
  ROLE_COLORS,
  ROLE_ICONS,
  ROLE_OPTIONS,
  STATUS_COLORS,
  STATUS_OPTIONS,
  statusToDbValue,
} from "@/lib/contacts/contact-constants"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react"

const PAGE_SIZE = 50

export type ContactsCrmListProps = {
  /** Lock the list to people or organizations. */
  lockedRecordType?: ContactRecordType
  /** Show dashboard metric cards. Defaults to true. */
  showStats?: boolean
  /** Pre-selected affiliations when adding a contact. */
  defaultAddRoles?: ContactRoleValue[]
}

const QUICK_FILTER_CHIPS: { label: string; value: ContactRoleValue | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Members", value: "member" },
  { label: "Volunteers", value: "volunteer" },
  { label: "Donors", value: "donor" },
  { label: "Vendors", value: "vendor" },
  { label: "Employees", value: "employee" },
  { label: "Service Providers", value: "service_provider" },
]

function getInitials(name: string) {
  const fallback = name?.trim() || "?"
  return fallback
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString()
}

function formatTeamSummary(teams: ContactListRow["teams"]) {
  if (teams.length === 0) return "—"
  if (teams.length === 1) return teams[0].name
  if (teams.length === 2) return `${teams[0].name}, ${teams[1].name}`
  return `${teams[0].name} +${teams.length - 1}`
}

function RoleCheckboxGroup({
  selected,
  onChange,
  idPrefix,
}: {
  selected: ContactRoleValue[]
  onChange: (roles: ContactRoleValue[]) => void
  idPrefix: string
}) {
  function toggleRole(role: ContactRoleValue, checked: boolean) {
    if (checked) {
      onChange(Array.from(new Set([...selected, role])))
      return
    }
    onChange(selected.filter((item) => item !== role))
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROLE_OPTIONS.map((role) => (
        <label
          key={role.value}
          htmlFor={`${idPrefix}-${role.value}`}
          className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <Checkbox
            id={`${idPrefix}-${role.value}`}
            checked={selected.includes(role.value)}
            onCheckedChange={(checked) => toggleRole(role.value, checked === true)}
          />
          {role.label}
        </label>
      ))}
    </div>
  )
}

export function ContactsCrmList({
  lockedRecordType,
  showStats = true,
  defaultAddRoles = [],
}: ContactsCrmListProps = {}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const entityLabel =
    lockedRecordType === "organization"
      ? "Organizations"
      : lockedRecordType === "individual"
        ? "People"
        : "Contacts"
  const entitySingular =
    lockedRecordType === "organization"
      ? "organization"
      : lockedRecordType === "individual"
        ? "person"
        : "contact"
  const searchPlaceholder =
    lockedRecordType === "organization"
      ? "Search organizations by name, email, or phone..."
      : lockedRecordType === "individual"
        ? "Search people by name, email, or phone..."
        : "Search contacts by name, email, phone, or organization..."
  const addButtonLabel =
    lockedRecordType === "organization"
      ? "Add Organization"
      : lockedRecordType === "individual"
        ? "Add Person"
        : "Add Contact"

  const [stats, setStats] = useState<ContactListStats>({ total: 0, people: 0, organizations: 0 })
  const [contacts, setContacts] = useState<ContactListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isRecentView, setIsRecentView] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<ContactRoleValue | "all">("all")
  const [recordTypeFilter, setRecordTypeFilter] = useState<ContactRecordType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([])

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactListRow | null>(null)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactType, setContactType] = useState<ContactRecordType>(
    lockedRecordType || "individual"
  )
  const [contactRoles, setContactRoles] = useState<ContactRoleValue[]>(defaultAddRoles)
  const [contactNotes, setContactNotes] = useState("")

  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editContactType, setEditContactType] = useState<ContactRecordType>("individual")
  const [editStatus, setEditStatus] = useState("active")
  const [editRoles, setEditRoles] = useState<ContactRoleValue[]>([])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    void fetchHrTeams({ includeInactive: false }).then((teams) => {
      setTeamOptions(teams.map((team) => ({ id: team.id, name: team.name })))
    })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, recordTypeFilter, statusFilter, teamFilter])

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
        role: roleFilter,
        recordType: lockedRecordType ? "all" : recordTypeFilter,
        lockedRecordType,
        status: statusFilter,
        teamId: teamFilter,
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
  }, [debouncedSearch, lockedRecordType, page, recordTypeFilter, roleFilter, statusFilter, teamFilter])

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
    return Boolean(
      debouncedSearch ||
        roleFilter !== "all" ||
        recordTypeFiltered ||
        statusFilter !== "all" ||
        teamFilter !== "all"
    )
  }, [debouncedSearch, lockedRecordType, recordTypeFilter, roleFilter, statusFilter, teamFilter])

  const listTitle = isRecentView ? `Recent ${entityLabel}` : entityLabel
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const catalogTotal = isRecentView
    ? lockedRecordType === "individual"
      ? stats.people
      : lockedRecordType === "organization"
        ? stats.organizations
        : stats.total
    : total

  function clearFilters() {
    setSearchQuery("")
    setDebouncedSearch("")
    setRoleFilter("all")
    if (!lockedRecordType) {
      setRecordTypeFilter("all")
    }
    setStatusFilter("all")
    setTeamFilter("all")
    setPage(1)
  }

  function resetAddForm() {
    setContactName("")
    setContactEmail("")
    setContactPhone("")
    setContactType(lockedRecordType || "individual")
    setContactRoles(defaultAddRoles)
    setContactNotes("")
  }

  function openEditDialog(contact: ContactListRow) {
    setSelectedContact(contact)
    setEditName(contact.name)
    setEditEmail(contact.email)
    setEditPhone(contact.phone)
    setEditContactType(contact.recordType)
    setEditStatus(statusToDbValue(contact.status))
    setEditRoles(contact.roleValues)
    setShowEditDialog(true)
  }

  function openDeleteDialog(contact: ContactListRow) {
    setSelectedContact(contact)
    setShowDeleteDialog(true)
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
    if (contactRoles.length === 0) {
      alert("Select at least one affiliation")
      return
    }

    setSaving(true)
    try {
      await addContactWithRoles({
        fullName: cleanName,
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
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

  async function handleUpdateContact() {
    if (!selectedContact) return

    const cleanName = editName.trim()
    if (!cleanName) {
      alert("Contact name is required")
      return
    }
    if (editRoles.length === 0) {
      alert("Select at least one affiliation")
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from("contacts")
      .update({
        full_name: cleanName,
        email: editEmail.trim().toLowerCase() || null,
        phone: editPhone.replace(/[^\d]/g, "") || null,
        contact_type: lockedRecordType || editContactType,
        status: editStatus,
      })
      .eq("id", selectedContact.id)

    if (error) {
      alert(error.message || "Could not update contact")
      setSaving(false)
      return
    }

    try {
      await syncContactRoles(selectedContact.id, editRoles, {
        fullName: cleanName,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
      })
    } catch (roleError: any) {
      alert(roleError?.message || "Contact saved but affiliations could not be updated")
      setSaving(false)
      return
    }

    setShowEditDialog(false)
    setSelectedContact(null)
    await refreshAfterMutation()
    setSaving(false)
  }

  async function handleDeleteContact() {
    if (!selectedContact) return

    setSaving(true)

    const { error: notesError } = await supabase
      .from("contact_notes")
      .delete()
      .eq("contact_id", selectedContact.id)

    if (notesError) {
      alert(notesError.message || "Could not delete contact notes")
      setSaving(false)
      return
    }

    const { error: rolesError } = await supabase
      .from("contact_roles")
      .delete()
      .eq("contact_id", selectedContact.id)

    if (rolesError) {
      alert(rolesError.message || "Could not delete contact affiliations")
      setSaving(false)
      return
    }

    const { error: contactError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", selectedContact.id)

    if (contactError) {
      alert(contactError.message || "Could not delete contact")
      setSaving(false)
      return
    }

    setShowDeleteDialog(false)
    setSelectedContact(null)
    await refreshAfterMutation()
    setSaving(false)
  }

  const statCards = lockedRecordType === "individual"
    ? [
        { label: "Total People", value: stats.people, icon: User },
        { label: "Total Contacts", value: stats.total, icon: User },
        { label: "Organizations", value: stats.organizations, icon: Building2 },
      ]
    : lockedRecordType === "organization"
      ? [
          { label: "Total Organizations", value: stats.organizations, icon: Building2 },
          { label: "Total Contacts", value: stats.total, icon: User },
          { label: "People", value: stats.people, icon: User },
        ]
      : [
          { label: "Total Contacts", value: stats.total, icon: User },
          { label: "People", value: stats.people, icon: User },
          { label: "Organizations", value: stats.organizations, icon: Building2 },
        ]

  const tableColumnCount = lockedRecordType ? 7 : 8

  return (
    <div className="flex flex-col gap-6 p-6">
      {showStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
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

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTER_CHIPS.map((chip) => (
          <Button
            key={chip.value}
            type="button"
            size="sm"
            variant={roleFilter === chip.value ? "default" : "outline"}
            onClick={() => setRoleFilter(chip.value)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as ContactRoleValue | "all")}
        >
          <SelectTrigger className="h-9 w-full sm:w-[190px]">
            <SelectValue placeholder="Affiliation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Affiliations</SelectItem>
            {ROLE_OPTIONS.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!lockedRecordType && (
          <Select
            value={recordTypeFilter}
            onValueChange={(value) => setRecordTypeFilter(value as ContactRecordType | "all")}
          >
            <SelectTrigger className="h-9 w-full sm:w-[165px]">
              <SelectValue placeholder="Record type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="individual">Person</SelectItem>
              <SelectItem value="organization">Organization</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ContactStatus | "all")}
        >
          <SelectTrigger className="h-9 w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.label}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teamOptions.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}

        <Button
          size="sm"
          className="shrink-0"
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
            {catalogTotal === 0
              ? `No ${entityLabel.toLowerCase()} yet`
              : isRecentView
                ? `Showing ${rangeEnd.toLocaleString()} of ${catalogTotal.toLocaleString()} ${entityLabel.toLowerCase()}`
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
                <TableHead>Affiliations</TableHead>
                <TableHead className="hidden lg:table-cell">Teams</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                {!lockedRecordType && (
                  <TableHead className="hidden xl:table-cell">Record Type</TableHead>
                )}
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Last Activity</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
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
                          Clear Filters
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
                    onClick={() => router.push(`/contacts/${contact.id}`)}
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
                          <span className="font-medium">{contact.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {contact.email || "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.roles.length === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          contact.roles.map((role) => {
                            const RoleIcon = ROLE_ICONS[role]
                            return (
                              <Badge
                                key={role}
                                variant="secondary"
                                className={cn("gap-1", ROLE_COLORS[role])}
                              >
                                <RoleIcon className="h-3 w-3" />
                                {role}
                              </Badge>
                            )
                          })
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="hidden max-w-[220px] truncate lg:table-cell">
                      <span className="text-sm text-muted-foreground" title={formatTeamSummary(contact.teams)}>
                        {formatTeamSummary(contact.teams)}
                      </span>
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contact.phone || "—"}
                      </div>
                    </TableCell>

                    {!lockedRecordType && (
                      <TableCell className="hidden xl:table-cell">
                        <Badge variant="outline">
                          {contact.recordType === "organization" ? "Organization" : "Person"}
                        </Badge>
                      </TableCell>
                    )}

                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[contact.status]}>
                        {contact.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDate(contact.lastActivity || contact.createdAt)}
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(contact)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(contact)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${(isRecentView ? catalogTotal : total).toLocaleString()}`}
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
              Create a {entitySingular} and assign affiliations. Existing records are matched by
              email, phone, or name — never duplicated.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="crm-name">
                {contactType === "organization" ? "Organization Name" : "Full Name"}
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
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Affiliations</Label>
              <RoleCheckboxGroup
                idPrefix="crm-add"
                selected={contactRoles}
                onChange={setContactRoles}
              />
            </div>
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

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="crm-edit-name">Name</Label>
              <Input
                id="crm-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="crm-edit-email">Email</Label>
                <Input
                  id="crm-edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="crm-edit-phone">Phone</Label>
                <Input
                  id="crm-edit-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </div>
            {!lockedRecordType && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Record Type</Label>
                  <Select
                    value={editContactType}
                    onValueChange={(value) => setEditContactType(value as ContactRecordType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Person</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {lockedRecordType && (
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Affiliations</Label>
              <RoleCheckboxGroup
                idPrefix="crm-edit"
                selected={editRoles}
                onChange={setEditRoles}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpdateContact} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Delete {selectedContact?.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={saving}>
              {saving ? "Deleting..." : "Delete Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
