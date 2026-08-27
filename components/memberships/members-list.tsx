"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Plus,
  Search,
  User,
} from "lucide-react"
import { addMemberWithMembership, createMembership } from "@/lib/memberships/membership-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { HrContactPicker } from "@/components/hr/hr-contact-picker"
import {
  fetchMembershipsList,
  fetchMembershipTypes,
  type MembershipListRow,
  type MembershipType,
} from "@/lib/memberships/membership-queries"
import {
  MEMBERSHIP_STATUSES,
  MEMBERSHIP_STATUS_COLORS,
  formatMembershipStatus,
  type MembershipStatus,
} from "@/lib/memberships/membership-constants"
import { fetchHrTeams } from "@/lib/hr/hr-team-actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { ListPagination } from "@/components/ui/list-pagination"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/ui/list-pagination"

function getInitials(name: string) {
  return (name?.trim() || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatTeams(teams: MembershipListRow["teams"]) {
  if (teams.length === 0) return "—"
  if (teams.length === 1) return teams[0].name
  return `${teams[0].name} +${teams.length - 1}`
}

export function MembersList() {
  const router = useRouter()
  const [rows, setRows] = useState<MembershipListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | "all">("active")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [createNewPerson, setCreateNewPerson] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState("")
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    membershipTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    notes: "",
  })

  function resetAddForm() {
    setCreateNewPerson(false)
    setSelectedContactId(null)
    setSelectedContactLabel("")
    setForm({
      fullName: "",
      email: "",
      phone: "",
      membershipTypeId: "",
      startDate: new Date().toISOString().slice(0, 10),
      notes: "",
    })
  }

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchMembershipsList({
        search,
        status: statusFilter,
        membershipTypeId: typeFilter,
        teamId: teamFilter,
        page,
        pageSize,
      })
      setRows(result.rows)
      setTotal(result.total)
    } catch (error) {
      console.error("Error loading members:", error)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter, teamFilter, page, pageSize])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, typeFilter, teamFilter])

  useEffect(() => {
    void (async () => {
      const [types, teamRows] = await Promise.all([
        fetchMembershipTypes(),
        fetchHrTeams(),
      ])
      setMembershipTypes(types)
      setTeams(teamRows.map((team) => ({ id: team.id, name: team.name })))
    })()
  }, [])

  const activeCount = useMemo(
    () => rows.filter((row) => row.status === "active").length,
    [rows]
  )

  async function handleAddMember() {
    if (!selectedContactId && !form.fullName.trim()) {
      alert("Search Directory for an existing person, or create a new person.")
      return
    }

    setSaving(true)
    try {
      let contactId = selectedContactId
      if (contactId) {
        await createMembership({
          contactId,
          membershipTypeId: form.membershipTypeId || null,
          status: "active",
          startDate: form.startDate,
          notes: form.notes.trim() || undefined,
        })
      } else {
        const result = await addMemberWithMembership({
          fullName: form.fullName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          membershipTypeId: form.membershipTypeId || null,
          startDate: form.startDate,
          notes: form.notes.trim() || undefined,
        })
        contactId = result.contactId
      }
      setAddOpen(false)
      resetAddForm()
      await loadRows()
      if (contactId) router.push(contactProfileHref(contactId))
    } catch (error: any) {
      alert(error?.message || "Could not add member")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            People with an active MAS membership — distinct from program participants.
            Group assignment is optional and shown when present.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add member
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Showing</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active in results</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">With team assignment</p>
            <p className="text-2xl font-bold">
              {rows.filter((row) => row.teams.length > 0).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search members by name, email, or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as MembershipStatus | "all")}
            >
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {MEMBERSHIP_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatMembershipStatus(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Membership type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {membershipTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Group (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading members...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No memberships match these filters. Add a member to create a membership record.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead>Renews / ends</TableHead>
                  <TableHead>Group (optional)</TableHead>
                  <TableHead className="text-right">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.membershipId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(row.contactName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{row.contactName}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.email || formatPhoneDisplay(row.phone) || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{row.membershipTypeName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={MEMBERSHIP_STATUS_COLORS[row.status]}
                      >
                        {formatMembershipStatus(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatContactDate(row.startDate)}</TableCell>
                    <TableCell>
                      {formatContactDate(row.renewalDate || row.endDate)}
                    </TableCell>
                    <TableCell>{formatTeams(row.teams)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/contacts/${row.contactId}`}>
                          <User className="mr-2 h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        disabled={loading}
        entryLabel="members"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next)
          setPage(1)
        }}
      />

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Search Directory first. Membership is a role on the existing person — it does not
              create a second record, and it does not enroll them in a program.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {!createNewPerson ? (
              <HrContactPicker
                label="Search Directory"
                selectedContactId={selectedContactId}
                selectedLabel={selectedContactLabel}
                onChange={(contact) => {
                  setSelectedContactId(contact.contactId)
                  const name = contact.full_name?.trim() || "Unnamed"
                  const detail = contact.email || contact.phone
                  setSelectedContactLabel(detail ? `${name} (${detail})` : name)
                }}
                onClear={() => {
                  setSelectedContactId(null)
                  setSelectedContactLabel("")
                }}
              />
            ) : null}
            <button
              type="button"
              className="text-left text-sm font-medium text-primary hover:underline"
              onClick={() => {
                setCreateNewPerson((current) => !current)
                setSelectedContactId(null)
                setSelectedContactLabel("")
              }}
            >
              {createNewPerson ? "Search an existing person instead" : "Person is not in Directory yet"}
            </button>
            {createNewPerson ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="member-name">Full name</Label>
                  <Input
                    id="member-name"
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fullName: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="member-phone">Phone</Label>
                    <Input
                      id="member-phone"
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Membership type</Label>
                <Select
                  value={form.membershipTypeId || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      membershipTypeId: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Individual (default)</SelectItem>
                    {membershipTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-start">Start date</Label>
                <Input
                  id="member-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-notes">Notes</Label>
              <Textarea
                id="member-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={saving}>
              {saving ? "Saving..." : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
