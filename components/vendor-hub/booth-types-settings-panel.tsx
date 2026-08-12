"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  fetchBoothTypeAttributeIds,
  fetchVendorHubBoothAttributes,
  setBoothTypeAttributes,
} from "@/lib/vendor-hub/booth-attribute-actions"
import type { VendorHubBoothAttribute } from "@/lib/vendor-hub/booth-catalog-types"
import {
  copyDefaultBoothTypesToEvent,
  fetchDefaultBoothTypes,
  fetchEventBoothTypes,
  type DefaultBoothTypeRow,
} from "@/lib/vendor-hub/default-booth-type-actions"

type BoothTypeForm = {
  name: string
  size: string
  price: string
  color: string
  description: string
  is_active: string
  sort_order: string
  capacity: string
  location: string
}

const emptyForm: BoothTypeForm = {
  name: "",
  size: "",
  price: "",
  color: "#2563eb",
  description: "",
  is_active: "true",
  sort_order: "0",
  capacity: "",
  location: "",
}

export function BoothTypesSettingsPanel({
  mode,
  eventId,
  showAttributes = true,
  allowCopyFromDefaults = false,
}: {
  mode: "defaults" | "event"
  eventId?: string
  showAttributes?: boolean
  allowCopyFromDefaults?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [boothTypes, setBoothTypes] = useState<DefaultBoothTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DefaultBoothTypeRow | null>(null)
  const [form, setForm] = useState<BoothTypeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [attributes, setAttributes] = useState<VendorHubBoothAttribute[]>([])
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const loadTypes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows =
        mode === "defaults"
          ? await fetchDefaultBoothTypes()
          : await fetchEventBoothTypes(eventId!)
      setBoothTypes(rows)
    } catch (loadError) {
      setBoothTypes([])
      setError(loadError instanceof Error ? loadError.message : "Could not load booth types.")
    } finally {
      setLoading(false)
    }
  }, [eventId, mode])

  useEffect(() => {
    void loadTypes()
  }, [loadTypes])

  useEffect(() => {
    if (!showAttributes) return
    void fetchVendorHubBoothAttributes()
      .then(setAttributes)
      .catch(() => setAttributes([]))
  }, [showAttributes])

  function startAdd() {
    setEditing(null)
    setForm(emptyForm)
    setSelectedAttributeIds([])
    setDialogOpen(true)
  }

  async function startEdit(type: DefaultBoothTypeRow) {
    setEditing(type)
    setForm({
      name: type.name ?? "",
      size: type.size ?? "",
      price: type.price === null || type.price === undefined ? "" : String(type.price),
      color: type.color ?? "#2563eb",
      capacity: String(type.capacity ?? ""),
      location: type.location ?? "",
      description: type.description ?? "",
      is_active: type.is_active === false ? "false" : "true",
      sort_order: String(type.sort_order ?? 0),
    })
    if (showAttributes) {
      try {
        setSelectedAttributeIds(await fetchBoothTypeAttributeIds(type.id))
      } catch {
        setSelectedAttributeIds([])
      }
    } else {
      setSelectedAttributeIds([])
    }
    setDialogOpen(true)
  }

  async function saveBoothType() {
    if (!form.name.trim()) {
      alert("Please enter a booth type name.")
      return
    }
    if (mode === "event" && !eventId) {
      alert("Missing event.")
      return
    }

    setSaving(true)
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) {
      alert("No organization selected.")
      setSaving(false)
      return
    }

    const payload = {
      organization_id: organizationId,
      event_id: mode === "event" ? eventId! : null,
      name: form.name.trim(),
      size: form.size.trim() || null,
      price: form.price ? Number(form.price) : 0,
      color: form.color || "#2563eb",
      description: form.description.trim() || null,
      is_active: form.is_active === "true",
      sort_order: Number(form.sort_order || 0),
      capacity: form.capacity ? Number(form.capacity) : 0,
      location: form.location.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let boothTypeId = editing?.id

    if (editing) {
      const { error: updateError } = await supabase
        .from("vendor_hub_booth_types")
        .update(payload)
        .eq("id", editing.id)
      if (updateError) {
        alert(updateError.message || "Booth type could not be updated.")
        setSaving(false)
        return
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("vendor_hub_booth_types")
        .insert(payload)
        .select("id")
        .single()
      if (insertError || !data) {
        alert(
          insertError?.message?.includes("organization_id")
            ? "Run scripts/234_vendor_hub_default_booth_types.sql in Supabase first."
            : insertError?.message || "Booth type could not be added."
        )
        setSaving(false)
        return
      }
      boothTypeId = data.id as string
    }

    if (boothTypeId && showAttributes) {
      try {
        await setBoothTypeAttributes(boothTypeId, selectedAttributeIds)
      } catch {
        alert("Booth type saved, but attributes could not be updated.")
      }
    }

    await loadTypes()
    setSaving(false)
    setDialogOpen(false)
    setEditing(null)
    setForm(emptyForm)
    router.refresh()
  }

  async function deleteBoothType(id: string) {
    if (!window.confirm("Delete this booth type? This cannot be undone.")) return
    const { error: deleteError } = await supabase.from("vendor_hub_booth_types").delete().eq("id", id)
    if (deleteError) {
      alert(deleteError.message || "Booth type could not be deleted.")
      return
    }
    await loadTypes()
    router.refresh()
  }

  function handleCopyFromDefaults() {
    if (!eventId) return
    const replace =
      boothTypes.length > 0
        ? window.confirm(
            "This event already has booth types. Replace them with organization defaults?"
          )
        : false
    if (boothTypes.length > 0 && !replace) return

    startTransition(async () => {
      try {
        const result = await copyDefaultBoothTypesToEvent({
          eventId,
          replaceExisting: boothTypes.length > 0,
        })
        await loadTypes()
        router.refresh()
        alert(`Copied ${result.copied} default booth type(s) to this event.`)
      } catch (copyError) {
        alert(copyError instanceof Error ? copyError.message : "Could not copy defaults.")
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Booth Types</CardTitle>
            <CardDescription>
              {mode === "defaults"
                ? "Organization defaults used when setting up new events. Events can copy these types."
                : "Booth types for this event. Copy from organization defaults, then adjust as needed."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowCopyFromDefaults && mode === "event" ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyFromDefaults}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy from defaults
              </Button>
            ) : null}
            <Button type="button" onClick={startAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Booth Type
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading booth types...
            </div>
          ) : boothTypes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {mode === "defaults"
                ? "No default booth types yet."
                : "No booth types for this event yet. Copy from defaults or add one."}
            </div>
          ) : (
            boothTypes.map((type) => (
              <div
                key={type.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-5 w-5 rounded-full border"
                    style={{ backgroundColor: type.color ?? "#2563eb" }}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{type.name}</p>
                      <Badge variant={type.is_active === false ? "secondary" : "default"}>
                        {type.is_active === false ? "Hidden" : "Active"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {type.size || "No size"} · ${type.price ?? 0}
                    </p>
                    {type.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void startEdit(type)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void deleteBoothType(type.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Booth Type" : "Add Booth Type"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Standard booth"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Size</Label>
                <Input
                  value={form.size}
                  onChange={(event) => setForm({ ...form, size: event.target.value })}
                  placeholder="10x10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={form.is_active}
                  onValueChange={(value) => setForm({ ...form, is_active: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={2}
              />
            </div>
            {showAttributes && attributes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>Default attributes</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {attributes
                    .filter((attribute) => attribute.is_active)
                    .map((attribute) => (
                      <label
                        key={attribute.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedAttributeIds.includes(attribute.id)}
                          onCheckedChange={(checked) => {
                            setSelectedAttributeIds((current) =>
                              checked === true
                                ? [...new Set([...current, attribute.id])]
                                : current.filter((id) => id !== attribute.id)
                            )
                          }}
                        />
                        {attribute.name}
                      </label>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveBoothType()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
