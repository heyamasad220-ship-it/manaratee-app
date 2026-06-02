"use client"

import * as React from "react"
import Link from "next/link"
import {
  archiveHrTeam,
  createHrTeam,
  deleteHrTeam,
  fetchHrTeams,
  reactivateHrTeam,
  updateHrTeam,
  type HrTeam,
  type HrTeamStatus,
} from "@/lib/hr/hr-team-actions"
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
import { Archive, ExternalLink, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const emptyForm = {
  id: "",
  name: "",
  description: "",
  status: "active" as HrTeamStatus,
  color: "#6366f1",
  sort_order: 0,
}

const COLOR_OPTIONS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ec4899", label: "Pink" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#06b6d4", label: "Cyan" },
]

type HrTeamsManagerProps = {
  showViewLinks?: boolean
  includeInactive?: boolean
}

export function HrTeamsManager({
  showViewLinks = false,
  includeInactive = true,
}: HrTeamsManagerProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [items, setItems] = React.useState<HrTeam[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  React.useEffect(() => {
    void loadItems()
  }, [includeInactive])

  async function loadItems() {
    setLoading(true)
    try {
      setItems(await fetchHrTeams({ includeInactive }))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Could not load teams.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(item: HrTeam) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      status: item.status,
      color: item.color || "#6366f1",
      sort_order: item.sort_order,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (form.id) {
        await updateHrTeam({
          id: form.id,
          name: form.name,
          description: form.description,
          status: form.status,
          color: form.color,
          sort_order: form.sort_order,
        })
      } else {
        await createHrTeam({
          name: form.name,
          description: form.description,
          status: form.status,
          color: form.color,
          sort_order: form.sort_order,
        })
      }
      setDialogOpen(false)
      setForm(emptyForm)
      await loadItems()
    } catch (error: any) {
      alert(error?.message || "Could not save team.")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(item: HrTeam) {
    try {
      if (item.status === "active") {
        if (!window.confirm(`Archive team "${item.name}"?`)) return
        await archiveHrTeam(item.id)
      } else {
        await reactivateHrTeam(item.id)
      }
      await loadItems()
    } catch (error: any) {
      alert(error?.message || "Could not update team status.")
    }
  }

  async function handleDelete(item: HrTeam) {
    if (!window.confirm(`Delete team "${item.name}"? This soft-deletes the team.`)) return
    try {
      await deleteHrTeam(item.id)
      await loadItems()
    } catch (error: any) {
      alert(error?.message || "Could not delete team.")
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Teams</h2>
            <p className="text-sm text-muted-foreground">
              Groups that contacts can belong to with team-specific positions.
            </p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add Team
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading teams...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No teams yet. Create a team to start assigning members.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-3 rounded-full"
                            style={{ backgroundColor: item.color || "#6366f1" }}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.description || "-"}
                      </TableCell>
                      <TableCell>{item.active_member_count || 0}</TableCell>
                      <TableCell className="capitalize">{item.status}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {showViewLinks && (
                            <Button variant="ghost" size="icon" className="size-8" asChild>
                              <Link href={`/hr/teams/${item.id}`}>
                                <ExternalLink className="size-4" />
                              </Link>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-amber-600"
                            onClick={() => handleArchive(item)}
                            title={item.status === "active" ? "Archive team" : "Reactivate team"}
                          >
                            {item.status === "active" ? (
                              <Archive className="size-4" />
                            ) : (
                              <RotateCcw className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Team" : "Add Team"}</DialogTitle>
            <DialogDescription>
              Teams group contacts with team-specific positions such as Team Leader or Member.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Outreach Team"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value as HrTeamStatus })}
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
              <div className="flex flex-col gap-2">
                <Label>Color</Label>
                <Select value={form.color} onValueChange={(value) => setForm({ ...form, color: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn("inline-block size-3 rounded-full")}
                            style={{ backgroundColor: option.value }}
                          />
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-sort">Sort Order</Label>
              <Input
                id="team-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : form.id ? "Save Changes" : "Add Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
