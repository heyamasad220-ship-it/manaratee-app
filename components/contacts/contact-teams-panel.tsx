"use client"

import * as React from "react"
import Link from "next/link"
import {
  addTeamMembership,
  endTeamMembership,
  fetchHrTeamPositions,
  fetchHrTeams,
  fetchTeamMemberships,
  updateTeamMembership,
  type HrTeam,
  type HrTeamMembership,
  type HrTeamPosition,
  type TeamMembershipStatus,
} from "@/lib/hr/hr-team-actions"
import { membershipTeamDetailPath } from "@/lib/memberships/membership-module-label"
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
import { Loader2, Pencil, Plus, UsersRound } from "lucide-react"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"

type ContactTeamsPanelProps = {
  contactId: string
  contactName: string
}

const emptyForm = {
  team_id: "",
  team_position_id: "",
  status: "active" as TeamMembershipStatus,
  start_date: "",
  end_date: "",
}

export function ContactTeamsPanel({ contactId, contactName }: ContactTeamsPanelProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [memberships, setMemberships] = React.useState<HrTeamMembership[]>([])
  const [teams, setTeams] = React.useState<HrTeam[]>([])
  const [positions, setPositions] = React.useState<HrTeamPosition[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [editingMembership, setEditingMembership] = React.useState<HrTeamMembership | null>(null)

  React.useEffect(() => {
    void loadData()
  }, [contactId])

  async function loadData() {
    setLoading(true)
    try {
      const [membershipData, teamsData, positionsData] = await Promise.all([
        fetchTeamMemberships({ contactId, includeInactive: true }),
        fetchHrTeams({ includeInactive: false }),
        fetchHrTeamPositions(false),
      ])
      setMemberships(membershipData)
      setTeams(teamsData)
      setPositions(positionsData)
    } catch (error: any) {
      console.error(error)
      setMemberships([])
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditingMembership(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(membership: HrTeamMembership) {
    setEditingMembership(membership)
    setForm({
      team_id: membership.team_id,
      team_position_id: membership.team_position_id,
      status: membership.status,
      start_date: membership.start_date || "",
      end_date: membership.end_date || "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.team_id || !form.team_position_id) return
    setSaving(true)
    try {
      if (editingMembership) {
        await updateTeamMembership({
          id: editingMembership.id,
          team_position_id: form.team_position_id,
          status: form.status,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        })
      } else {
        await addTeamMembership({
          team_id: form.team_id,
          contact_id: contactId,
          team_position_id: form.team_position_id,
          status: form.status,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
        })
      }
      setDialogOpen(false)
      setEditingMembership(null)
      setForm(emptyForm)
      await loadData()
    } catch (error: any) {
      alert(error?.message || "Could not save team membership.")
    } finally {
      setSaving(false)
    }
  }

  async function handleEnd(membership: HrTeamMembership) {
    if (!window.confirm(`End ${contactName}'s membership on ${membership.team_name}?`)) return
    try {
      await endTeamMembership(membership.id)
      await loadData()
    } catch (error: any) {
      alert(error?.message || "Could not end membership.")
    }
  }

  const activeMemberships = memberships.filter((membership) => membership.status === "active")
  const historicalMemberships = memberships.filter((membership) => membership.status !== "active")

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UsersRound className="size-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Teams</h2>
          </div>
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add to Team
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading teams...
          </div>
        ) : activeMemberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not assigned to any teams yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {activeMemberships.map((membership) => (
              <div
                key={membership.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1">
                  <Link
                    href={membershipTeamDetailPath(membership.team_id)}
                    className="font-medium hover:underline"
                  >
                    {membership.team_name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{membership.position_name}</p>
                  {membership.start_date && (
                    <p className="text-xs text-muted-foreground">
                      Joined {formatContactDate(membership.start_date)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {membership.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(membership)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => handleEnd(membership)}
                  >
                    End
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {historicalMemberships.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Past Memberships</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Ended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicalMemberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell>{membership.team_name}</TableCell>
                    <TableCell>{membership.position_name}</TableCell>
                    <TableCell>{membership.end_date || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMembership ? "Edit Team Membership" : "Add to Team"}
            </DialogTitle>
            <DialogDescription>
              Team positions are specific to each team and are not contact roles.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {!editingMembership && (
              <div className="flex flex-col gap-2">
                <Label>Team</Label>
                <Select
                  value={form.team_id || "none"}
                  onValueChange={(value) =>
                    setForm({ ...form, team_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select team</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Team Position</Label>
              <Select
                value={form.team_position_id || "none"}
                onValueChange={(value) =>
                  setForm({ ...form, team_position_id: value === "none" ? "" : value })
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
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm({ ...form, status: value as TeamMembershipStatus })
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingMembership ? "Save Changes" : "Add to Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
