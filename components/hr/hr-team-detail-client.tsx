"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  addTeamMembership,
  endTeamMembership,
  fetchHrTeamById,
  fetchHrTeamPositions,
  removeTeamMembership,
  updateTeamMembership,
  type HrTeamDetail,
  type HrTeamMembership,
  type HrTeamPosition,
  type TeamMembershipStatus,
} from "@/lib/hr/hr-team-actions"
import { MEMBERSHIP_TEAMS_PATH } from "@/lib/memberships/membership-module-label"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  ROLE_VALUE_TO_LABEL,
  filterContactRoles,
  type ContactRoleValue,
} from "@/lib/contacts/contact-constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ArrowLeft, Loader2, Pencil, Plus, UserMinus } from "lucide-react"

type ContactOption = {
  id: string
  full_name: string
  email: string | null
}

const emptyMemberForm = {
  contact_id: "",
  team_position_id: "",
  status: "active" as TeamMembershipStatus,
  start_date: "",
  end_date: "",
}

export function HrTeamDetailClient({ teamId }: { teamId: string }) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [team, setTeam] = React.useState<HrTeamDetail | null>(null)
  const [positions, setPositions] = React.useState<HrTeamPosition[]>([])
  const [contacts, setContacts] = React.useState<ContactOption[]>([])

  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [memberForm, setMemberForm] = React.useState(emptyMemberForm)
  const [editingMembership, setEditingMembership] = React.useState<HrTeamMembership | null>(null)
  const [showHistorical, setShowHistorical] = React.useState(false)

  React.useEffect(() => {
    void loadTeam()
  }, [teamId])

  async function loadTeam() {
    setLoading(true)
    try {
      const [teamData, positionsData] = await Promise.all([
        fetchHrTeamById(teamId),
        fetchHrTeamPositions(false),
      ])
      setTeam(teamData)
      setPositions(positionsData)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Could not load team.")
      setTeam(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadContacts() {
    const orgId = await getCurrentOrganizationId()
    if (!orgId) return

    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, email")
      .eq("organization_id", orgId)
      .order("full_name")
      .limit(1000)

    setContacts((data || []) as ContactOption[])
  }

  async function openAddMember() {
    setMemberForm(emptyMemberForm)
    await loadContacts()
    setAddDialogOpen(true)
  }

  function openEditMember(membership: HrTeamMembership) {
    setEditingMembership(membership)
    setMemberForm({
      contact_id: membership.contact_id,
      team_position_id: membership.team_position_id,
      status: membership.status,
      start_date: membership.start_date || "",
      end_date: membership.end_date || "",
    })
    setEditDialogOpen(true)
  }

  async function handleAddMember() {
    if (!memberForm.contact_id || !memberForm.team_position_id) return
    setSaving(true)
    try {
      await addTeamMembership({
        team_id: teamId,
        contact_id: memberForm.contact_id,
        team_position_id: memberForm.team_position_id,
        status: memberForm.status,
        start_date: memberForm.start_date || undefined,
        end_date: memberForm.end_date || undefined,
      })
      setAddDialogOpen(false)
      await loadTeam()
    } catch (error: any) {
      alert(error?.message || "Could not add team member.")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateMember() {
    if (!editingMembership || !memberForm.team_position_id) return
    setSaving(true)
    try {
      await updateTeamMembership({
        id: editingMembership.id,
        team_position_id: memberForm.team_position_id,
        status: memberForm.status,
        start_date: memberForm.start_date || null,
        end_date: memberForm.end_date || null,
      })
      setEditDialogOpen(false)
      setEditingMembership(null)
      await loadTeam()
    } catch (error: any) {
      alert(error?.message || "Could not update team member.")
    } finally {
      setSaving(false)
    }
  }

  async function handleEndMember(membership: HrTeamMembership) {
    if (!window.confirm(`End membership for ${membership.contact_name}?`)) return
    try {
      await endTeamMembership(membership.id)
      await loadTeam()
    } catch (error: any) {
      alert(error?.message || "Could not end membership.")
    }
  }

  async function handleRemoveMember(membership: HrTeamMembership) {
    if (!window.confirm(`Remove ${membership.contact_name} from this team?`)) return
    try {
      await removeTeamMembership(membership.id)
      await loadTeam()
    } catch (error: any) {
      alert(error?.message || "Could not remove team member.")
    }
  }

  function formatRoles(roles?: string[]) {
    if (!roles?.length) return "-"
    return filterContactRoles(roles)
      .map((role) => ROLE_VALUE_TO_LABEL[role as ContactRoleValue] || role)
      .join(", ")
  }

  const displayedMembers = React.useMemo(() => {
    if (!team) return []
    if (showHistorical) return team.members
    return team.members.filter((member) => member.status === "active")
  }, [team, showHistorical])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading team...
      </div>
    )
  }

  if (!team) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Group not found.
            <Button variant="outline" className="mt-4" onClick={() => router.push(MEMBERSHIP_TEAMS_PATH)}>
              <ArrowLeft className="mr-2 size-4" />
              Back to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push(MEMBERSHIP_TEAMS_PATH)}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Groups
          </Button>
          <div className="flex items-center gap-3">
            <span
              className="inline-block size-4 rounded-full"
              style={{ backgroundColor: team.color || "#6366f1" }}
            />
            <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
            <Badge variant={team.status === "active" ? "default" : "secondary"}>{team.status}</Badge>
          </div>
          {team.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{team.description}</p>
          )}
        </div>
        <Button onClick={openAddMember}>
          <Plus className="mr-2 size-4" />
          Add Member
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 [&>*]:w-fit">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Members</p>
            <p className="text-2xl font-bold">{team.stats.totalMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Leaders</p>
            <p className="text-2xl font-bold">{team.stats.leaders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Assistants</p>
            <p className="text-2xl font-bold">{team.stats.assistants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Coordinators</p>
            <p className="text-2xl font-bold">{team.stats.coordinators}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistorical((value) => !value)}
          >
            {showHistorical ? "Active only" : "Show historical"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Team Position</TableHead>
                <TableHead>Contact Roles</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No members assigned to this team yet.
                  </TableCell>
                </TableRow>
              ) : (
                displayedMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Link href={`/contacts/${member.contact_id}`} className="font-medium hover:underline">
                        {member.contact_name}
                      </Link>
                    </TableCell>
                    <TableCell>{member.position_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRoles(member.contact_roles)}
                    </TableCell>
                    <TableCell>{member.contact_email || "-"}</TableCell>
                    <TableCell>{member.contact_phone || "-"}</TableCell>
                    <TableCell className="capitalize">{member.status}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEditMember(member)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {member.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-amber-600"
                            onClick={() => handleEndMember(member)}
                            title="End membership"
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-red-600"
                            onClick={() => handleRemoveMember(member)}
                            title="Remove membership"
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Assign an existing contact to {team.name} with a team-specific position.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Contact</Label>
              <Select
                value={memberForm.contact_id || "none"}
                onValueChange={(value) =>
                  setMemberForm({ ...memberForm, contact_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select contact</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.full_name}
                      {contact.email ? ` (${contact.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Team Position</Label>
              <Select
                value={memberForm.team_position_id || "none"}
                onValueChange={(value) =>
                  setMemberForm({
                    ...memberForm,
                    team_position_id: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select position</SelectItem>
                  {positions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={memberForm.start_date}
                  onChange={(e) => setMemberForm({ ...memberForm, start_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={memberForm.status}
                  onValueChange={(value) =>
                    setMemberForm({ ...memberForm, status: value as TeamMembershipStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={saving}>
              {saving ? "Saving..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update position, status, or dates for {editingMembership?.contact_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Team Position</Label>
              <Select
                value={memberForm.team_position_id || "none"}
                onValueChange={(value) =>
                  setMemberForm({
                    ...memberForm,
                    team_position_id: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select position</SelectItem>
                  {positions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={memberForm.start_date}
                  onChange={(e) => setMemberForm({ ...memberForm, start_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={memberForm.end_date}
                  onChange={(e) => setMemberForm({ ...memberForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select
                value={memberForm.status}
                onValueChange={(value) =>
                  setMemberForm({ ...memberForm, status: value as TeamMembershipStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMember} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
