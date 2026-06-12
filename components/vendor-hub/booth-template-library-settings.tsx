"use client"

import { useEffect, useState, useTransition } from "react"
import { Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  deleteBoothSetupTemplate,
  fetchBoothSetupTemplates,
  upsertBoothSetupTemplate,
  type BoothSetupTemplateLineInput,
} from "@/lib/vendor-hub/booth-template-actions"
import { fetchVendorHubBoothAttributes } from "@/lib/vendor-hub/booth-attribute-actions"
import type {
  VendorHubBoothAttribute,
  VendorHubBoothSetupTemplateWithLines,
} from "@/lib/vendor-hub/booth-catalog-types"

type TemplateLineForm = BoothSetupTemplateLineInput & { key: string }

type TemplateFormState = {
  id?: string
  name: string
  description: string
  is_active: boolean
  sort_order: number
  lines: TemplateLineForm[]
}

function emptyLine(index: number): TemplateLineForm {
  return {
    key: `line-${Date.now()}-${index}`,
    line_name: "",
    size: "",
    price: 0,
    color: "#2563eb",
    quantity: 1,
    capacity: 0,
    location: "",
    description: "",
    sort_order: index,
    attribute_slugs: [],
  }
}

const emptyForm: TemplateFormState = {
  name: "",
  description: "",
  is_active: true,
  sort_order: 0,
  lines: [emptyLine(0)],
}

export function BoothTemplateLibrarySettings() {
  const router = useRouter()
  const [templates, setTemplates] = useState<VendorHubBoothSetupTemplateWithLines[]>([])
  const [attributes, setAttributes] = useState<VendorHubBoothAttribute[]>([])
  const [tablesAvailable, setTablesAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<TemplateFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [templateRows, attributeRows] = await Promise.all([
          fetchBoothSetupTemplates(),
          fetchVendorHubBoothAttributes(),
        ])
        if (!cancelled) {
          setTemplates(templateRows)
          setAttributes(attributeRows.filter((row) => row.is_active))
          setTablesAvailable(true)
        }
      } catch (loadError) {
        if (!cancelled) {
          setTemplates([])
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

  function openEdit(template: VendorHubBoothSetupTemplateWithLines) {
    setForm({
      id: template.id,
      name: template.name,
      description: template.description ?? "",
      is_active: template.is_active,
      sort_order: template.sort_order,
      lines: template.lines.map((line, index) => ({
        key: line.id,
        line_name: line.line_name,
        size: line.size ?? "",
        price: line.price ?? 0,
        color: line.color ?? "#2563eb",
        quantity: line.quantity,
        capacity: line.capacity ?? 0,
        location: line.location ?? "",
        description: line.description ?? "",
        sort_order: line.sort_order ?? index,
        attribute_slugs: line.attribute_slugs,
      })),
    })
    setError(null)
    setDialogOpen(true)
  }

  function updateLine(key: string, patch: Partial<TemplateLineForm>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }))
  }

  function toggleLineAttribute(key: string, slug: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.key !== key) return line
        const slugs = new Set(line.attribute_slugs ?? [])
        if (checked) {
          slugs.add(slug)
        } else {
          slugs.delete(slug)
        }
        return { ...line, attribute_slugs: [...slugs] }
      }),
    }))
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, emptyLine(current.lines.length)],
    }))
  }

  function removeLine(key: string) {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.key !== key),
    }))
  }

  function handleSave() {
    startTransition(async () => {
      setError(null)
      try {
        await upsertBoothSetupTemplate({
          id: form.id,
          name: form.name,
          description: form.description || null,
          is_active: form.is_active,
          sort_order: form.sort_order,
          lines: form.lines.map((line, index) => ({
            line_name: line.line_name,
            size: line.size || null,
            price: line.price ?? 0,
            color: line.color || "#2563eb",
            quantity: line.quantity,
            capacity: line.capacity ?? 0,
            location: line.location || null,
            description: line.description || null,
            sort_order: line.sort_order ?? index,
            attribute_slugs: line.attribute_slugs ?? [],
          })),
        })
        const rows = await fetchBoothSetupTemplates()
        setTemplates(rows)
        setDialogOpen(false)
        router.refresh()
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save template.")
      }
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this booth template?")) return

    startTransition(async () => {
      try {
        await deleteBoothSetupTemplate(id)
        setTemplates((current) => current.filter((row) => row.id !== id))
        router.refresh()
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete template.")
      }
    })
  }

  if (!tablesAvailable) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Booth templates are unavailable until migration{" "}
          <code className="rounded bg-muted px-1">078_vendor_hub_booth_setup_templates.sql</code>{" "}
          is applied in Supabase.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-5 w-5" />
              Booth Template Library
            </CardTitle>
            <CardDescription>
              Save reusable booth layouts for recurring bazaars. Applying a template copies booth
              types and inventory into a new event.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates yet. Create one like &quot;Standard Bazaar Setup&quot; with booth counts
              per type.
            </p>
          ) : (
            templates.map((template) => {
              const totalBooths = template.lines.reduce((sum, line) => sum + line.quantity, 0)
              return (
                <div
                  key={template.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{template.name}</p>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                    {template.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {template.lines.length} booth type{template.lines.length === 1 ? "" : "s"} ·{" "}
                      {totalBooths} total booths
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {template.lines.map((line) => (
                        <li key={line.id}>
                          {line.quantity}× {line.line_name}
                          {line.price ? ` · $${line.price}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(template)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Template" : "Add Template"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Template Name</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Standard Bazaar Setup"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={2}
                />
              </div>
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
                <Label htmlFor="template-active">Active</Label>
                <Switch
                  id="template-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-base">Booth Lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>

            {form.lines.map((line, index) => (
              <div key={line.key} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Line {index + 1}</p>
                  {form.lines.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Booth Type Name</Label>
                    <Input
                      value={line.line_name}
                      onChange={(event) => updateLine(line.key, { line_name: event.target.value })}
                      placeholder="Standard Booth"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: Math.max(1, Number(event.target.value || 1)) })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Size</Label>
                    <Input
                      value={line.size ?? ""}
                      onChange={(event) => updateLine(line.key, { size: event.target.value })}
                      placeholder="10x10 ft"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Price</Label>
                    <Input
                      type="number"
                      value={line.price ?? 0}
                      onChange={(event) =>
                        updateLine(line.key, { price: Number(event.target.value || 0) })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={line.color ?? "#2563eb"}
                      onChange={(event) => updateLine(line.key, { color: event.target.value })}
                      className="h-10 w-20 cursor-pointer p-1"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Default Location</Label>
                    <Input
                      value={line.location ?? ""}
                      onChange={(event) => updateLine(line.key, { location: event.target.value })}
                    />
                  </div>
                </div>
                {attributes.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <Label>Default Attributes</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {attributes.map((attribute) => (
                        <label key={attribute.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={(line.attribute_slugs ?? []).includes(attribute.slug)}
                            onCheckedChange={(checked) =>
                              toggleLineAttribute(line.key, attribute.slug, checked === true)
                            }
                          />
                          {attribute.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !form.name.trim() || form.lines.every((line) => !line.line_name.trim())}
            >
              {isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
