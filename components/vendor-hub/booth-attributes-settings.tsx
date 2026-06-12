"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  deleteVendorHubBoothAttribute,
  fetchVendorHubBoothAttributes,
  upsertVendorHubBoothAttribute,
} from "@/lib/vendor-hub/booth-attribute-actions"
import type {
  BoothAttributeCategory,
  VendorHubBoothAttribute,
} from "@/lib/vendor-hub/booth-catalog-types"

type AttributeFormState = {
  id?: string
  name: string
  category: BoothAttributeCategory
  description: string
  is_active: boolean
  sort_order: number
}

const emptyForm: AttributeFormState = {
  name: "",
  category: "utility",
  description: "",
  is_active: true,
  sort_order: 0,
}

const categoryLabels: Record<BoothAttributeCategory, string> = {
  utility: "Utility",
  placement: "Placement",
  environment: "Environment",
}

export function BoothAttributesSettings() {
  const router = useRouter()
  const [attributes, setAttributes] = useState<VendorHubBoothAttribute[]>([])
  const [tablesAvailable, setTablesAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AttributeFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const rows = await fetchVendorHubBoothAttributes()
        if (!cancelled) {
          setAttributes(rows)
          setTablesAvailable(true)
        }
      } catch (loadError) {
        if (!cancelled) {
          setAttributes([])
          setTablesAvailable(false)
          console.error(loadError)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(attribute: VendorHubBoothAttribute) {
    setForm({
      id: attribute.id,
      name: attribute.name,
      category: attribute.category,
      description: attribute.description ?? "",
      is_active: attribute.is_active,
      sort_order: attribute.sort_order,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      setError(null)
      try {
        await upsertVendorHubBoothAttribute({
          id: form.id,
          name: form.name,
          category: form.category,
          description: form.description || null,
          is_active: form.is_active,
          sort_order: form.sort_order,
        })
        const rows = await fetchVendorHubBoothAttributes()
        setAttributes(rows)
        setDialogOpen(false)
        router.refresh()
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save attribute.")
      }
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this booth attribute? It will be removed from type links.")) {
      return
    }

    startTransition(async () => {
      try {
        await deleteVendorHubBoothAttribute(id)
        setAttributes((current) => current.filter((row) => row.id !== id))
        router.refresh()
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete attribute.")
      }
    })
  }

  if (!tablesAvailable) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Booth attributes are unavailable until migration{" "}
          <code className="rounded bg-muted px-1">077_vendor_hub_booth_attributes.sql</code> is
          applied in Supabase.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Booth Attributes</CardTitle>
            <CardDescription>
              Reusable features like electricity, WiFi, and premium placement. Attach defaults to
              booth types or individual booths.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Attribute
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading attributes...
            </div>
          ) : attributes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No booth attributes configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attributes.map((attribute) => (
                  <TableRow key={attribute.id}>
                    <TableCell className="font-medium">{attribute.name}</TableCell>
                    <TableCell>{categoryLabels[attribute.category]}</TableCell>
                    <TableCell>
                      <Badge variant={attribute.is_active ? "default" : "secondary"}>
                        {attribute.is_active ? "Active" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(attribute)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(attribute.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Attribute" : "Add Attribute"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Electricity"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm({ ...form, category: value as BoothAttributeCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="placement">Placement</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm({ ...form, sort_order: Number(event.target.value || 0) })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="attribute-active">Active</Label>
                <Switch
                  id="attribute-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending || !form.name.trim()}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
