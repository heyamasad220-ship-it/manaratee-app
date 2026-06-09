"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { addContactWithRoles } from "@/lib/contacts/contact-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  fetchAllTeamMembershipsForFilter,
  fetchHrTeamPositions,
  fetchHrTeams,
  type HrTeamMembership,
} from "@/lib/hr/hr-team-actions"
import {
  type ContactRecordType,
  type ContactRoleLabel,
  type ContactRoleValue,
  type ContactStatus,
  ROLE_COLORS,
  ROLE_ICONS,
  ROLE_OPTIONS,
  ROLE_VALUE_TO_LABEL,
  STATUS_COLORS,
  STATUS_OPTIONS,
  filterContactRoles,
  mapRoleValue,
  mapStatus,
  MEMBERSHIP_DERIVED_ROLE,
} from "@/lib/contacts/contact-constants"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Search,
  Plus,
  Phone,
  Building2,
  User,
  Loader2,
  MoreHorizontal,
  Trash2,
  Filter,
} from "lucide-react"

export interface ContactListItem {
  id: string
  name: string
  email: string
  phone: string
  recordType: ContactRecordType
  roles: ContactRoleLabel[]
  roleValues: ContactRoleValue[]
  status: ContactStatus
  createdAt: string
  lastActivity?: string
}

export type ContactsListViewProps = {
  /** When set, only contacts with this role are shown (HR views). */
  requiredRole?: ContactRoleValue
  /** Lock record type filter (People / Organizations pages). */
  lockedRecordType?: ContactRecordType
  /** Pre-selected roles when opening Add Contact. */
  defaultAddRoles?: ContactRoleValue[]
  /** Show summary stat cards. */
  showStats?: boolean
  /** Hide role filter controls when locked to a single role. */
  hideRoleFilter?: boolean
  /** Hide record type filter when locked. */
  hideRecordTypeFilter?: boolean
  /** Optional content beside the Add Contact button. */
  headerAction?: ReactNode
  emptyMessage?: string
  /** Show team / team position / membership status filters (HR Members). */
  showTeamFilters?: boolean
  /** Omit outer padding when embedded inside another page tab. */
  embedded?: boolean
  /** Only fetch contacts when the user searches (avoids loading the full list on open). */
  searchToLoad?: boolean
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

function formatDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString()
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

export function ContactsListView({
  requiredRole,
  lockedRecordType,
  defaultAddRoles = [],
  showStats = true,
  hideRoleFilter = false,
  hideRecordTypeFilter = false,
  headerAction,
  emptyMessage,
  showTeamFilters = false,
  embedded = false,
  searchToLoad = false,
}: ContactsListViewProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [contacts, setContacts] = useState<ContactListItem[]>([])
  const [loading, setLoading] = useState(!searchToLoad)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    people: 0,
    organizations: 0,
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilters, setRoleFilters] = useState<ContactRoleValue[]>(
    requiredRole ? [requiredRole] : []
  )
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all")
  const [recordTypeFilter, setRecordTypeFilter] = useState<ContactRecordType | "all">(
    lockedRecordType || "all"
  )
  const [teamFilter, setTeamFilter] = useState("all")
  const [teamPositionFilter, setTeamPositionFilter] = useState("all")
  const [membershipStatusFilter, setMembershipStatusFilter] = useState<"all" | "active" | "inactive">("all")

  const [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([])
  const [teamPositionOptions, setTeamPositionOptions] = useState<{ id: string; name: string }[]>([])
  const [teamMemberships, setTeamMemberships] = useState<HrTeamMembership[]>([])

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactType, setContactType] = useState<ContactRecordType>(
    lockedRecordType || "individual"
  )
  const [contactRoles, setContactRoles] = useState<ContactRoleValue[]>(defaultAddRoles)
  const [contactNotes, setContactNotes] = useState("")

  const hideMembershipRole = Boolean(requiredRole)

  const mapContactRows = useCallback(
    (rows: any[]): ContactListItem[] => {
      return rows.map((c: any) => {
        const roleValues = filterContactRoles(
          Array.from(
            new Set((c.contact_roles || []).map((r: any) => r.role as string).filter(Boolean))
          )
        )
        const visibleRoleValues = hideMembershipRole
          ? roleValues.filter((role) => role !== MEMBERSHIP_DERIVED_ROLE)
          : roleValues
        const roles = visibleRoleValues
          .map((value) => mapRoleValue(value))
          .filter(Boolean) as ContactRoleLabel[]
        const recordType: ContactRecordType =
          c.contact_type === "organization" ? "organization" : "individual"

        return {
          id: c.id,
          name: c.full_name || c.email || c.phone || "Unnamed Contact",
          email: c.email || "",
          phone: c.phone || "",
          recordType,
          roleValues,
          roles,
          status: mapStatus(c.status),
          createdAt: c.created_at,
          lastActivity: c.created_at,
        }
      })
    },
    [hideMembershipRole]
  )

  const loadSummaryStats = useCallback(async () => {
    if (!showStats || !searchToLoad) return

    const orgId = await getCurrentOrganizationId()
    if (!orgId) {
      setSummaryStats({ total: 0, people: 0, organizations: 0 })
      return
    }

    const [totalRes, peopleRes, organizationsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("contact_type", "individual"),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("contact_type", "organization"),
    ])

    setSummaryStats({
      total: totalRes.count ?? 0,
      people: peopleRes.count ?? 0,
      organizations: organizationsRes.count ?? 0,
    })
  }, [searchToLoad, showStats, supabase])

  const loadContacts = useCallback(
    async (search?: string) => {
      const contactFields =
        "id, full_name, email, phone, contact_type, status, created_at, contact_roles(role)"

      const trimmedSearch = search?.trim() || ""

      if (searchToLoad && !trimmedSearch) {
        setContacts([])
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage("")

      const orgId = await getCurrentOrganizationId()
      if (!orgId) {
        setContacts([])
        setLoading(false)
        return
      }

      if (searchToLoad) {
        const escapedSearch = trimmedSearch.replace(/[%_\\,]/g, "\\$&")
        const pattern = `%${escapedSearch}%`

        const { data, error } = await supabase
          .from("contacts")
          .select(contactFields)
          .eq("organization_id", orgId)
          .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
          .order("full_name", { ascending: true })
          .limit(100)

        if (error) {
          console.error("Error searching contacts:", error)
          setContacts([])
          setErrorMessage(error.message || "Could not search contacts.")
          setLoading(false)
          return
        }

        setContacts(mapContactRows(data || []))
        setLoading(false)
        return
      }

      let allRows: any[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from("contacts")
          .select(contactFields)
          .eq("organization_id", orgId)
          .order("full_name", { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          console.error("Error loading contacts:", error)
          setContacts([])
          setErrorMessage(error.message || "Could not load contacts.")
          setLoading(false)
          return
        }

        allRows = [...allRows, ...(data || [])]
        if (!data || data.length < pageSize) break
        from += pageSize
      }

      setContacts(mapContactRows(allRows))
      setLoading(false)
    },
    [mapContactRows, searchToLoad, supabase]
  )

  useEffect(() => {
    if (searchToLoad) {
      void loadSummaryStats()
      return
    }

    void loadContacts()
  }, [loadContacts, loadSummaryStats, searchToLoad])

  useEffect(() => {
    if (!searchToLoad) return

    const trimmedSearch = searchQuery.trim()
    if (!trimmedSearch) {
      setContacts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = window.setTimeout(() => {
      void loadContacts(trimmedSearch)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [loadContacts, searchQuery, searchToLoad])

  useEffect(() => {
    if (!showTeamFilters) return

    async function loadTeamFilterData() {
      try {
        const [teams, positions, memberships] = await Promise.all([
          fetchHrTeams({ includeInactive: false }),
          fetchHrTeamPositions(false),
          fetchAllTeamMembershipsForFilter(),
        ])
        setTeamOptions(teams.map((team) => ({ id: team.id, name: team.name })))
        setTeamPositionOptions(positions.map((position) => ({ id: position.id, name: position.name })))
        setTeamMemberships(memberships)
      } catch (error) {
        console.error("Team filter data error:", error)
        setTeamOptions([])
        setTeamPositionOptions([])
        setTeamMemberships([])
      }
    }

    void loadTeamFilterData()
  }, [showTeamFilters])

  const membershipsByContact = useMemo(() => {
    const map = new Map<string, HrTeamMembership[]>()
    for (const membership of teamMemberships) {
      const existing = map.get(membership.contact_id) || []
      existing.push(membership)
      map.set(membership.contact_id, existing)
    }
    return map
  }, [teamMemberships])

  const filteredContacts = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesSearch =
        !search ||
        contact.name.toLowerCase().includes(search) ||
        contact.email.toLowerCase().includes(search) ||
        contact.phone.includes(search)

      const activeRoleFilters = requiredRole ? [requiredRole] : roleFilters
      const matchesRole =
        activeRoleFilters.length === 0 ||
        activeRoleFilters.every((role) => contact.roleValues.includes(role))

      const matchesStatus = statusFilter === "all" || contact.status === statusFilter
      const effectiveRecordType = lockedRecordType || recordTypeFilter
      const matchesRecordType =
        effectiveRecordType === "all" || contact.recordType === effectiveRecordType

      let matchesTeamFilters = true
      if (showTeamFilters) {
        const contactMemberships = membershipsByContact.get(contact.id) || []
        const relevantMemberships = contactMemberships.filter((membership) => {
          const matchesTeam = teamFilter === "all" || membership.team_id === teamFilter
          const matchesPosition =
            teamPositionFilter === "all" || membership.team_position_id === teamPositionFilter
          const matchesMembershipStatus =
            membershipStatusFilter === "all" || membership.status === membershipStatusFilter
          return matchesTeam && matchesPosition && matchesMembershipStatus
        })

        const hasTeamConstraints =
          teamFilter !== "all" || teamPositionFilter !== "all" || membershipStatusFilter !== "all"

        matchesTeamFilters = hasTeamConstraints ? relevantMemberships.length > 0 : true
      }

      return matchesSearch && matchesRole && matchesStatus && matchesRecordType && matchesTeamFilters
    })
  }, [
    contacts,
    searchQuery,
    roleFilters,
    requiredRole,
    statusFilter,
    recordTypeFilter,
    lockedRecordType,
    showTeamFilters,
    teamFilter,
    teamPositionFilter,
    membershipStatusFilter,
    membershipsByContact,
  ])

  const stats = useMemo(() => {
    if (searchToLoad) return summaryStats

    return {
      total: contacts.length,
      people: contacts.filter((c) => c.recordType === "individual").length,
      organizations: contacts.filter((c) => c.recordType === "organization").length,
    }
  }, [contacts, searchToLoad, summaryStats])

  function resetAddForm() {
    setContactName("")
    setContactEmail("")
    setContactPhone("")
    setContactType(lockedRecordType || "individual")
    setContactRoles(defaultAddRoles)
    setContactNotes("")
  }

  function openDeleteDialog(contact: ContactListItem) {
    setSelectedContact(contact)
    setShowDeleteDialog(true)
  }

  async function handleAddContact() {
    const cleanName = contactName.trim()
    if (!cleanName) {
      alert("Contact name is required")
      return
    }
    if (contactRoles.length === 0) {
      alert("Select at least one role")
      return
    }

    setSaving(true)
    try {
      const result = await addContactWithRoles({
        fullName: cleanName,
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        contactType: contactType,
        notes: contactNotes.trim() || undefined,
        roles: contactRoles,
      })

      resetAddForm()
      setShowAddDialog(false)

      if (searchToLoad) {
        if (searchQuery.trim()) {
          await loadContacts(searchQuery.trim())
        }
        if (showStats) {
          await loadSummaryStats()
        }
      } else {
        await loadContacts()
      }

      if (result.created) {
        alert("Contact added")
      } else {
        alert("Contact already exists. The selected roles were added if missing.")
      }
    } catch (error: any) {
      alert(error?.message || "Could not add contact")
    } finally {
      setSaving(false)
    }
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
      alert(rolesError.message || "Could not delete contact roles")
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

    if (searchToLoad) {
      if (searchQuery.trim()) {
        await loadContacts(searchQuery.trim())
      }
      if (showStats) {
        await loadSummaryStats()
      }
    } else {
      await loadContacts()
    }

    setSaving(false)
  }

  const roleFilterLabel =
    roleFilters.length === 0
      ? "All affiliations"
      : roleFilters.map((role) => ROLE_VALUE_TO_LABEL[role]).join(", ")

  const statCards = [
    { label: "Total", value: stats.total, icon: User },
    { label: "People", value: stats.people, icon: User },
    { label: "Organizations", value: stats.organizations, icon: Building2 },
  ]

  return (
    <div className={embedded ? "flex flex-col gap-6" : "flex flex-col gap-6 p-6"}>
      {showStats && (
        <StatCardsRow>
          {statCards.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              layout="compact"
            />
          ))}
        </StatCardsRow>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:max-w-md lg:max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              searchToLoad
                ? "Search contacts by name, email, or phone..."
                : "Search by name, email, or phone..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!hideRoleFilter && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 sm:w-[200px]">
                  <Filter className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{roleFilterLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Filter by affiliations</p>
                  <RoleCheckboxGroup
                    idPrefix="filter"
                    selected={roleFilters}
                    onChange={setRoleFilters}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setRoleFilters([])}
                  >
                    Clear affiliation filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {!hideRecordTypeFilter && !lockedRecordType && (
            <Select
              value={recordTypeFilter}
              onValueChange={(v) => setRecordTypeFilter(v as ContactRecordType | "all")}
            >
              <SelectTrigger className="h-9 shrink-0 sm:w-[165px]">
                <SelectValue placeholder="Record type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="individual">People</SelectItem>
                <SelectItem value="organization">Organizations</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ContactStatus | "all")}
          >
            <SelectTrigger className="h-9 shrink-0 sm:w-[150px]">
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

          {headerAction}
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => {
              resetAddForm()
              setShowAddDialog(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Contact
          </Button>

          {showTeamFilters && (
            <>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-9 shrink-0 sm:w-[180px]">
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

              <Select value={teamPositionFilter} onValueChange={setTeamPositionFilter}>
                <SelectTrigger className="h-9 shrink-0 sm:w-[180px]">
                  <SelectValue placeholder="Team Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {teamPositionOptions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={membershipStatusFilter}
                onValueChange={(value) =>
                  setMembershipStatusFilter(value as "all" | "active" | "inactive")
                }
              >
                <SelectTrigger className="h-9 shrink-0 sm:w-[180px]">
                  <SelectValue placeholder="Membership Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Memberships</SelectItem>
                  <SelectItem value="active">Active Membership</SelectItem>
                  <SelectItem value="inactive">Inactive Membership</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
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
                <TableHead>Roles</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Record Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Last Activity</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading contacts...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {searchToLoad && !searchQuery.trim()
                      ? "Start typing to search for contacts."
                      : emptyMessage ||
                        (searchQuery.trim()
                          ? "No contacts found."
                          : "No contacts match the current filters.")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
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
                            {contact.email || "-"}
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

                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contact.phone || "-"}
                      </div>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline">
                        {contact.recordType === "organization" ? "Organization" : "Person"}
                      </Badge>
                    </TableCell>

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
                          <DropdownMenuItem asChild>
                            <Link href={contactProfileHref(contact.id)}>
                              <User className="mr-2 h-4 w-4" />
                              View profile
                            </Link>
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Create a person or organization and assign one or more roles. Existing contacts are
              matched by email, phone, or name — never duplicated.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">
                {contactType === "organization" ? "Organization Name" : "Full Name"}
              </Label>
              <Input
                id="name"
                placeholder={
                  contactType === "organization" ? "Enter organization name" : "Enter full name"
                }
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
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
              <Label>Roles</Label>
              <RoleCheckboxGroup
                idPrefix="add"
                selected={contactRoles}
                onChange={setContactRoles}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes..."
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddForm()
                setShowAddDialog(false)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              This permanently deletes this contact, their roles, and their contact notes. HR
              extension records may remain until cleaned up separately.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold">{selectedContact?.name || "this contact"}</span>?
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setSelectedContact(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
