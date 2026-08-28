"use client"

import { useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
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
  deleteTicketingEventCategory,
  upsertTicketingEventCategory,
} from "@/lib/tickets/ticketing-event-category-actions"
import type { TicketingEventCategory } from "@/lib/tickets/ticketing-event-category-types"

type CategoryFormState = {
  id?: string
  name: string
  is_active: boolean
  sort_order: number
}

const emptyForm: CategoryFormState = {
  name: "",
  is_active: true,
  sort_order: 0,
}

export function TicketingEventCategoriesDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: TicketingEventCategory[]
}) {
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CategoryFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setForm({
      ...emptyForm,
      sort_order:
        categories.reduce((max, category) => Math.max(max, category.sort_order), 0) +
        10,
    })
    setError(null)
    setFormOpen(true)
  }

  function openEdit(category: TicketingEventCategory) {
    setForm({
      id: category.id,
      name: category.name,
      is_active: category.is_active,
      sort_order: category.sort_order,
    })
    setError(null)
    setFormOpen(true)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await upsertTicketingEventCategory({
          id: form.id,
          name: form.name,
          is_active: form.is_active,
          sort_order: form.sort_order,
        })
        setFormOpen(false)
        router.refresh()
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save category"
        )
      }
    })
  }

  function handleDelete(category: TicketingEventCategory) {
    if (
      !window.confirm(
        `Delete "${category.name}"? Events in this category become Uncategorized.`
      )
    ) {
      return
    }

    startTransition(async () => {
      try {
        await deleteTicketingEventCategory(category.id)
        router.refresh()
      } catch (deleteError) {
        window.alert(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete category"
        )
      }
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Event categories</DialogTitle>
            <DialogDescription>
              Group ticketed events such as Kids Workshop, I Pray Party, or Bazaar.
              You can rename these or add your own.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add category
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No categories yet. Add one to start grouping events.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        {category.is_active ? "Active" : "Hidden"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(category)}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {category.name}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(category)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {category.name}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit category" : "Add category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticketing-category-name">Name</Label>
              <Input
                id="ticketing-category-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Kids Workshop"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="ticketing-category-active">Show in lists</Label>
              <Switch
                id="ticketing-category-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending || !form.name.trim()}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
