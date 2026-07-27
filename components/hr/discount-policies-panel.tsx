"use client"

import { useMemo, useState, useTransition } from "react"
import {
  Briefcase,
  Check,
  Heart,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  createDiscountTagFromInput,
  deleteDiscountTagFromForm,
  toggleDiscountTagFromForm,
  updateDiscountTagFromInput,
} from "@/lib/discount-tags/discount-tag-actions"
import type { DiscountTag } from "@/lib/discount-tags/discount-tag-types"
import { isSystemManagedDiscountTagName } from "@/lib/discount-tags/discount-tag-assignment"

type TagFormState = {
  name: string
  description: string
  percentOff: string
  autoApply: boolean
  appliesToPrograms: boolean
  appliesToVenueRentals: boolean
  appliesToTicketing: boolean
}

const EMPTY_FORM: TagFormState = {
  name: "",
  description: "",
  percentOff: "",
  autoApply: false,
  appliesToPrograms: true,
  appliesToVenueRentals: true,
  appliesToTicketing: false,
}

function getTagIcon(name: string) {
  const normalized = name.toLowerCase()

  if (normalized.includes("staff") || normalized.includes("employee")) {
    return Briefcase
  }

  if (normalized.includes("volunteer")) {
    return Heart
  }

  if (normalized.includes("member")) {
    return UserCheck
  }

  if (normalized.includes("board") || normalized.includes("admin")) {
    return Shield
  }

  return Users
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  const num = Number(value)
  if (!Number.isFinite(num)) return "—"
  return `${num}%`
}

function moduleSummary(tag: DiscountTag) {
  if (!tag.auto_apply) return "Manual assign only"
  const parts: string[] = []
  if (tag.applies_to_programs) parts.push("Programs")
  if (tag.applies_to_venue_rentals) parts.push("Venue rentals")
  if (tag.applies_to_ticketing) parts.push("Ticketing")
  return parts.length > 0 ? parts.join(", ") : "No modules"
}

function tagToForm(tag: DiscountTag): TagFormState {
  return {
    name: tag.name,
    description: tag.description || "",
    percentOff:
      tag.percent_off === null || tag.percent_off === undefined
        ? ""
        : String(tag.percent_off),
    autoApply: Boolean(tag.auto_apply),
    appliesToPrograms: tag.applies_to_programs !== false,
    appliesToVenueRentals: tag.applies_to_venue_rentals !== false,
    appliesToTicketing: Boolean(tag.applies_to_ticketing),
  }
}

export function DiscountPoliciesPanel({ tags }: { tags: DiscountTag[] }) {
  const [open, setOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<DiscountTag | null>(null)
  const [form, setForm] = useState<TagFormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dialogTitle = editingTag ? "Edit Discount Tag" : "Add Discount Tag"

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags]
  )

  function openCreate() {
    setEditingTag(null)
    setForm(EMPTY_FORM)
    setError(null)
    setOpen(true)
  }

  function openEdit(tag: DiscountTag) {
    setEditingTag(tag)
    setForm(tagToForm(tag))
    setError(null)
    setOpen(true)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        const payload = {
          name: form.name,
          description: form.description,
          percentOff: form.percentOff.trim() === "" ? null : Number(form.percentOff),
          autoApply: form.autoApply,
          appliesToPrograms: form.appliesToPrograms,
          appliesToVenueRentals: form.appliesToVenueRentals,
          appliesToTicketing: form.appliesToTicketing,
        }

        if (editingTag) {
          await updateDiscountTagFromInput(editingTag.id, payload)
        } else {
          await createDiscountTagFromInput(payload)
        }
        setOpen(false)
        setEditingTag(null)
        setForm(EMPTY_FORM)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Could not save tag."
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Discount Tags</CardTitle>
            <CardDescription>
              Create custom tags (for example Top Donor), set a discount amount, and
              choose whether to auto-apply on programs or venue rentals. Assign custom
              tags on individual or organization contact profiles.
            </CardDescription>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tag
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {sortedTags.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
              <Users className="mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No discount tags yet</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Add a tag to group customers who should receive a discount.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Tag</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Auto-apply</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedTags.map((tag) => {
                  const TagIcon = getTagIcon(tag.name)
                  const systemManaged = isSystemManagedDiscountTagName(tag.name)

                  return (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <TagIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{tag.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tag.description ||
                                (systemManaged
                                  ? "System-managed from activity"
                                  : "Custom tag")}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        {formatPercent(tag.percent_off)}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <Badge
                            variant="secondary"
                            className={
                              tag.auto_apply
                                ? "bg-sky-100 text-sky-800"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {tag.auto_apply ? "On" : "Off"}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {moduleSummary(tag)}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            tag.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {tag.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(tag)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>

                          <form action={toggleDiscountTagFromForm}>
                            <input type="hidden" name="id" value={tag.id} />
                            <input
                              type="hidden"
                              name="active"
                              value={String(!tag.active)}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={tag.active ? "Deactivate" : "Activate"}
                            >
                              {tag.active ? (
                                <X className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Check className="h-4 w-4 text-emerald-600" />
                              )}
                              <span className="sr-only">
                                {tag.active ? "Deactivate" : "Activate"}
                              </span>
                            </Button>
                          </form>

                          <form action={deleteDiscountTagFromForm}>
                            <input type="hidden" name="id" value={tag.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={systemManaged}
                              title={
                                systemManaged
                                  ? "System tags cannot be deleted"
                                  : "Delete"
                              }
                            >
                              <Trash2
                                className={
                                  systemManaged
                                    ? "h-4 w-4 text-muted-foreground/40"
                                    : "h-4 w-4 text-muted-foreground hover:text-red-600"
                                }
                              />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Custom tags are assigned on contact profiles. Turn on auto-apply to use
              the discount amount on selected modules at checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="discount-tag-name">Tag name *</Label>
              <Input
                id="discount-tag-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Top Donor"
                disabled={
                  isPending ||
                  (editingTag
                    ? isSystemManagedDiscountTagName(editingTag.name)
                    : false)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-tag-description">Description</Label>
              <Input
                id="discount-tag-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="100% off for major donors"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-tag-percent">Discount amount (%)</Label>
              <Input
                id="discount-tag-percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.percentOff}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    percentOff: event.target.value,
                  }))
                }
                placeholder="100"
                disabled={isPending}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="space-y-0.5 pr-3">
                <Label htmlFor="discount-tag-auto-apply">Auto-apply discount</Label>
                <p className="text-xs text-muted-foreground">
                  When on, contacts with this tag get the discount on checked modules.
                </p>
              </div>
              <Switch
                id="discount-tag-auto-apply"
                checked={form.autoApply}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, autoApply: checked }))
                }
                disabled={isPending}
              />
            </div>

            {form.autoApply ? (
              <div className="space-y-3 rounded-lg border px-3 py-3">
                <p className="text-sm font-medium">Apply to</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.appliesToPrograms}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        appliesToPrograms: checked === true,
                      }))
                    }
                    disabled={isPending}
                  />
                  Programs
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.appliesToVenueRentals}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        appliesToVenueRentals: checked === true,
                      }))
                    }
                    disabled={isPending}
                  />
                  Venue rentals
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.appliesToTicketing}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        appliesToTicketing: checked === true,
                      }))
                    }
                    disabled={isPending}
                  />
                  Ticketing
                </label>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : editingTag ? "Save changes" : "Add Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
