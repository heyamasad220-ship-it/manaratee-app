"use client"

import * as React from "react"
import {
  archiveHrTeamPosition,
  createHrTeamPosition,
  fetchHrTeamPositions,
  updateHrTeamPosition,
  type HrTeamPosition,
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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Plus, Trash2 } from "lucide-react"

const emptyForm = {
  id: "",
  name: "",
  description: "",
  is_active: true,
}

export function HrTeamPositionsManager() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [items, setItems] = React.useState<HrTeamPosition[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  React.useEffect(() => {
    void loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    try {
      setItems(await fetchHrTeamPositions(true))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Could not load team positions.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(item: HrTeamPosition) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (form.id) {
        await updateHrTeamPosition({
          id: form.id,
          name: form.name,
          description: form.description,
          is_active: form.is_active,
        })
      } else {
        await createHrTeamPosition({
          name: form.name,
          description: form.description,
          is_active: form.is_active,
        })
      }
      setDialogOpen(false)
      setForm(emptyForm)
      await loadItems()
    } catch (error: any) {
      alert(error?.message || "Could not save team position.")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(item: HrTeamPosition) {
    if (item.is_active) {
      if (!window.confirm(`Archive position "${item.name}"?`)) return
      try {
        await archiveHrTeamPosition(item.id)
        await loadItems()
      } catch (error: any) {
        alert(error?.message || "Could not archive team position.")
      }
      return
    }

    setSaving(true)
    try {
      await updateHrTeamPosition({
        id: item.id,
        name: item.name,
        description: item.description || "",
        is_active: true,
      })
      await loadItems()
    } catch (error: any) {
      alert(error?.message || "Could not reactivate team position.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Group Positions</h2>
            <p className="text-sm text-muted-foreground">
              Group-specific positions such as Group Leader or Assistant. These are separate from
              contact roles and employee job titles.
            </p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add Position
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Memberships</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[110px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading team positions...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No team positions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.description || "-"}
                      </TableCell>
                      <TableCell>{item.membership_count || 0}</TableCell>
                      <TableCell>{item.is_active ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-red-600"
                            onClick={() => handleArchive(item)}
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
            <DialogTitle>{form.id ? "Edit Group Position" : "Add Group Position"}</DialogTitle>
            <DialogDescription>
              Positions are assigned per team membership, not as global contact roles.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-position-name">Name</Label>
              <Input
                id="team-position-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Chairperson"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-position-description">Description</Label>
              <Textarea
                id="team-position-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="team-position-active">Active</Label>
              <Switch
                id="team-position-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : form.id ? "Save Changes" : "Add Position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
