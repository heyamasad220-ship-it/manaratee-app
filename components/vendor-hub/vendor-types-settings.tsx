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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteVendorHubVendorType,
  fetchVendorHubVendorTypesForSettings,
  upsertVendorHubVendorType,
} from "@/lib/vendor-hub/vendor-type-actions"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

type VendorTypeFormState = {
  id?: string
  name: string
  description: string
  default_fee: string
  is_active: boolean
  sort_order: number
}

const emptyForm: VendorTypeFormState = {
  name: "",
  description: "",
  default_fee: "",
  is_active: true,
  sort_order: 0,
}

export function VendorTypesSettings() {
  const router = useRouter()
  const [vendorTypes, setVendorTypes] = useState<VendorHubVendorType[]>([])
  const [tablesAvailable, setTablesAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<VendorTypeFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    async function loadVendorTypes() {
      try {
        const rows = await fetchVendorHubVendorTypesForSettings()
        if (!cancelled) {
          setVendorTypes(rows)
          setTablesAvailable(true)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          setVendorTypes([])
          setTablesAvailable(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadVendorTypes()

    return () => {
      cancelled = true
    }
  }, [])

  function refreshVendorTypes() {
    startTransition(async () => {
      const rows = await fetchVendorHubVendorTypesForSettings()
      setVendorTypes(rows)
      router.refresh()
    })
  }

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(vendorType: VendorHubVendorType) {
    setForm({
      id: vendorType.id,
      name: vendorType.name,
      description: vendorType.description || "",
      default_fee:
        vendorType.default_fee != null ? String(vendorType.default_fee) : "",
      is_active: vendorType.is_active,
      sort_order: vendorType.sort_order,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        await upsertVendorHubVendorType({
          id: form.id,
          name: form.name,
          description: form.description,
          default_fee: form.default_fee ? Number.parseFloat(form.default_fee) : null,
          is_active: form.is_active,
          sort_order: form.sort_order,
        })
        setDialogOpen(false)
        refreshVendorTypes()
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save vendor type"
        )
      }
    })
  }

  function handleDelete(vendorType: VendorHubVendorType) {
    if (!window.confirm(`Delete "${vendorType.name}"?`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteVendorHubVendorType(vendorType.id)
        refreshVendorTypes()
      } catch (deleteError) {
        window.alert(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete vendor type"
        )
      }
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vendor types...
        </CardContent>
      </Card>
    )
  }

  if (!tablesAvailable) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Run migration `074_vendor_hub_vendor_types.sql` in Supabase to enable vendor
          type management.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Vendor types</CardTitle>
            <CardDescription>
              Categories like coffee, dessert, and juice used when planning event vendor
              needs.
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add type
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Default fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No vendor types yet. Add coffee, dessert, juice, and other categories.
                  </TableCell>
                </TableRow>
              ) : (
                vendorTypes.map((vendorType) => (
                  <TableRow key={vendorType.id}>
                    <TableCell>
                      <p className="font-medium">{vendorType.name}</p>
                      {vendorType.description ? (
                        <p className="text-xs text-muted-foreground">
                          {vendorType.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {vendorType.default_fee != null
                        ? `$${Number(vendorType.default_fee).toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={vendorType.is_active ? "default" : "secondary"}>
                        {vendorType.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{vendorType.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(vendorType)}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(vendorType)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit vendor type" : "Add vendor type"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="vendor-type-name">Name</Label>
              <Input
                id="vendor-type-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Coffee"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-type-description">Description</Label>
              <Textarea
                id="vendor-type-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor-type-fee">Default fee ($)</Label>
                <Input
                  id="vendor-type-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.default_fee}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, default_fee: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-type-sort">Sort order</Label>
                <Input
                  id="vendor-type-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sort_order: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive types are hidden when planning events.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
