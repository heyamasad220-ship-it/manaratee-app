"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { saveMembershipType } from "@/lib/memberships/membership-actions"
import {
  fetchMembershipTypes,
  type MembershipType,
} from "@/lib/memberships/membership-queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type TypeFormState = {
  id?: string
  name: string
  description: string
  defaultDurationMonths: string
  isActive: boolean
  sortOrder: string
}

function emptyForm(): TypeFormState {
  return {
    name: "",
    description: "",
    defaultDurationMonths: "12",
    isActive: true,
    sortOrder: "0",
  }
}

export function MembershipTypesSettings() {
  const [types, setTypes] = useState<MembershipType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<TypeFormState>(emptyForm())

  const loadTypes = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchMembershipTypes({ includeInactive: true })
      setTypes(rows)
    } catch (error) {
      console.error("Error loading membership types:", error)
      setTypes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTypes()
  }, [loadTypes])

  function openCreate() {
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(type: MembershipType) {
    setForm({
      id: type.id,
      name: type.name,
      description: type.description || "",
      defaultDurationMonths:
        type.default_duration_months != null ? String(type.default_duration_months) : "",
      isActive: type.is_active,
      sortOrder: String(type.sort_order),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("Name is required")
      return
    }

    setSaving(true)
    try {
      await saveMembershipType({
        id: form.id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        defaultDurationMonths: form.defaultDurationMonths
          ? Number(form.defaultDurationMonths)
          : null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      })
      setDialogOpen(false)
      await loadTypes()
    } catch (error: any) {
      alert(error?.message || "Could not save membership type")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Membership types</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Plans such as Individual, Family, or Student. Default duration sets the end date
              when staff adds a membership.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add type
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading types...
              </div>
            ) : types.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No membership types yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Default term</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <p className="font-medium">{type.name}</p>
                        {type.description ? (
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {type.default_duration_months
                          ? `${type.default_duration_months} months`
                          : "No default"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.is_active ? "secondary" : "outline"}>
                          {type.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(type)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit membership type" : "Add membership type"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="type-name">Name</Label>
              <Input
                id="type-name"
                value={form.name}
                onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type-description">Description</Label>
              <Textarea
                id="type-description"
                value={form.description}
                onChange={(event) =>
                  setForm((c) => ({ ...c, description: event.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="type-duration">Default duration (months)</Label>
                <Input
                  id="type-duration"
                  type="number"
                  min={0}
                  value={form.defaultDurationMonths}
                  onChange={(event) =>
                    setForm((c) => ({ ...c, defaultDurationMonths: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type-sort">Sort order</Label>
                <Input
                  id="type-sort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((c) => ({ ...c, sortOrder: event.target.value }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((c) => ({ ...c, isActive: event.target.checked }))
                }
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
