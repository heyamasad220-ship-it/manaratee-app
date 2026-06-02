"use client"

import * as React from "react"
import {
  createHrPosition,
  deleteHrPosition,
  fetchHrPositions,
  updateHrPosition,
  type HrPosition,
} from "@/lib/hr/hr-config-actions"
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

export function HrPositionsManager() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [items, setItems] = React.useState<HrPosition[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)

  React.useEffect(() => {
    void loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    try {
      setItems(await fetchHrPositions())
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Could not load positions.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(item: HrPosition) {
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
        await updateHrPosition({
          id: form.id,
          name: form.name,
          description: form.description,
          is_active: form.is_active,
        })
      } else {
        await createHrPosition({
          name: form.name,
          description: form.description,
          is_active: form.is_active,
        })
      }
      setDialogOpen(false)
      setForm(emptyForm)
      await loadItems()
    } catch (error: any) {
      alert(error?.message || "Could not save position.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: HrPosition) {
    if ((item.staff_count || 0) > 0) {
      alert("This position is assigned to employees. Reassign them first.")
      return
    }
    if (!window.confirm(`Delete position "${item.name}"?`)) return
    try {
      await deleteHrPosition(item.id)
      await loadItems()
    } catch (error: any) {
      alert(error?.message || "Could not delete position.")
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Positions</h2>
            <p className="text-sm text-muted-foreground">
              Job titles assigned to employees, such as Program Coordinator or Director.
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
                  <TableHead>Employees</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[110px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading positions...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No positions yet. Add positions to assign them to employees.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.description || "-"}
                      </TableCell>
                      <TableCell>{item.staff_count || 0}</TableCell>
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
            <DialogTitle>{form.id ? "Edit Position" : "Add Position"}</DialogTitle>
            <DialogDescription>
              Positions appear when assigning employees to departments.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="position-name">Name</Label>
              <Input
                id="position-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Program Coordinator"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="position-description">Description</Label>
              <Textarea
                id="position-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="position-active">Active</Label>
              <Switch
                id="position-active"
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
