"use client"

import * as React from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { createClient } from "@/lib/supabase/client"

type DiscountCode = {
  id: string
  code: string
  description: string | null
  discount_type: "percent" | "amount"
  discount_value: number
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  used_count: number
  active: boolean
}

type DiscountFormState = {
  id: string
  code: string
  description: string
  discount_type: "percent" | "amount"
  discount_value: number
  starts_at: string
  expires_at: string
  max_uses: string
  active: boolean
}

const emptyDiscount: DiscountFormState = {
  id: "",
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  starts_at: "",
  expires_at: "",
  max_uses: "",
  active: true,
}

function safeNumber(value: string | number) {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : 0
}

function formatDate(value: string | null) {
  if (!value) return "-"

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ProgramPromoCodesEditor({
  programId,
  organizationId,
}: {
  programId: string
  organizationId: string
}) {
  const supabase = createClient()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [discountCodes, setDiscountCodes] = React.useState<DiscountCode[]>([])
  const [discountDialogOpen, setDiscountDialogOpen] = React.useState(false)
  const [editingDiscount, setEditingDiscount] = React.useState(emptyDiscount)

  const fetchDiscountCodes = React.useCallback(async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from("discount_codes")
        .select(
          "id, code, description, discount_type, discount_value, starts_at, expires_at, max_uses, used_count, active"
        )
        .eq("program_id", programId)
        .order("created_at", { ascending: false })

      if (error) {
        console.warn("discount_codes could not be loaded:", error.message)
        setDiscountCodes([])
        return
      }

      setDiscountCodes((data || []) as DiscountCode[])
    } finally {
      setLoading(false)
    }
  }, [programId, supabase])

  React.useEffect(() => {
    void fetchDiscountCodes()
  }, [fetchDiscountCodes])

  function openAddDiscountDialog() {
    setEditingDiscount(emptyDiscount)
    setDiscountDialogOpen(true)
  }

  function openEditDiscountDialog(discount: DiscountCode) {
    setEditingDiscount({
      id: discount.id,
      code: discount.code,
      description: discount.description || "",
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      starts_at: discount.starts_at?.slice(0, 10) || "",
      expires_at: discount.expires_at?.slice(0, 10) || "",
      max_uses: discount.max_uses?.toString() || "",
      active: discount.active,
    })
    setDiscountDialogOpen(true)
  }

  async function handleSaveDiscount() {
    if (!editingDiscount.code.trim()) return

    setSaving(true)

    try {
      const payload = {
        organization_id: organizationId,
        program_id: programId,
        code: editingDiscount.code.trim().toUpperCase(),
        description: editingDiscount.description.trim() || null,
        discount_type: editingDiscount.discount_type,
        discount_value: safeNumber(editingDiscount.discount_value),
        starts_at: editingDiscount.starts_at || null,
        expires_at: editingDiscount.expires_at || null,
        max_uses: editingDiscount.max_uses ? safeNumber(editingDiscount.max_uses) : null,
        active: editingDiscount.active,
        updated_at: new Date().toISOString(),
      }

      const { error } = editingDiscount.id
        ? await supabase
            .from("discount_codes")
            .update(payload)
            .eq("id", editingDiscount.id)
            .eq("program_id", programId)
        : await supabase
            .from("discount_codes")
            .insert({ ...payload, used_count: 0 })

      if (error) throw error

      setDiscountDialogOpen(false)
      setEditingDiscount(emptyDiscount)
      await fetchDiscountCodes()
    } catch (error: unknown) {
      console.error("Save discount error:", error)
      const message =
        error instanceof Error ? error.message : "Could not save promo code."
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDiscount(id: string) {
    const confirmed = window.confirm("Delete this promo code?")
    if (!confirmed) return

    const { error } = await supabase
      .from("discount_codes")
      .delete()
      .eq("id", id)
      .eq("program_id", programId)

    if (error) {
      console.error("Delete promo code error:", error)
      alert(error.message)
      return
    }

    await fetchDiscountCodes()
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Promo Codes</h2>
            <p className="text-sm text-muted-foreground">
              Create and manage registration promo codes for this program.
            </p>
          </div>

          <Button type="button" onClick={openAddDiscountDialog}>
            <Plus className="mr-2 size-4" />
            Add Promo Code
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[110px]" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading promo codes...
                  </TableCell>
                </TableRow>
              ) : discountCodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No promo codes yet.
                  </TableCell>
                </TableRow>
              ) : (
                discountCodes.map((discount) => (
                  <TableRow key={discount.id}>
                    <TableCell className="font-medium">{discount.code}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {discount.description || "-"}
                    </TableCell>
                    <TableCell>
                      {discount.discount_type === "percent"
                        ? `${discount.discount_value}%`
                        : `$${discount.discount_value}`}
                    </TableCell>
                    <TableCell>
                      {discount.used_count}
                      {discount.max_uses ? `/${discount.max_uses}` : ""}
                    </TableCell>
                    <TableCell>{formatDate(discount.expires_at)}</TableCell>
                    <TableCell>
                      <Badge variant={discount.active ? "default" : "secondary"}>
                        {discount.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEditDiscountDialog(discount)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDeleteDiscount(discount.id)}
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
        </div>
      </div>

      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDiscount.id ? "Edit Promo Code" : "Add Promo Code"}
            </DialogTitle>
            <DialogDescription>
              {editingDiscount.id
                ? "Update this promo code."
                : "Create a new promo code for this program."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="discount-code">Code</Label>
              <Input
                id="discount-code"
                value={editingDiscount.code}
                onChange={(event) =>
                  setEditingDiscount({
                    ...editingDiscount,
                    code: event.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., SUMMER10"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="discount-description">Description</Label>
              <Textarea
                id="discount-description"
                value={editingDiscount.description}
                onChange={(event) =>
                  setEditingDiscount({
                    ...editingDiscount,
                    description: event.target.value,
                  })
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Discount Type</Label>
                <Select
                  value={editingDiscount.discount_type}
                  onValueChange={(value) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      discount_type: value as "percent" | "amount",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="discount-value">Value</Label>
                <div className="flex items-center gap-2">
                  {editingDiscount.discount_type === "amount" && (
                    <span className="text-muted-foreground">$</span>
                  )}
                  <Input
                    id="discount-value"
                    type="number"
                    min="0"
                    value={editingDiscount.discount_value}
                    onChange={(event) =>
                      setEditingDiscount({
                        ...editingDiscount,
                        discount_value: safeNumber(event.target.value),
                      })
                    }
                  />
                  {editingDiscount.discount_type === "percent" && (
                    <span className="text-muted-foreground">%</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="starts-at">Start Date</Label>
                <Input
                  id="starts-at"
                  type="date"
                  value={editingDiscount.starts_at}
                  onChange={(event) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      starts_at: event.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="expires-at">Expiration Date</Label>
                <Input
                  id="expires-at"
                  type="date"
                  value={editingDiscount.expires_at}
                  onChange={(event) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      expires_at: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="max-uses">Max Uses</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="0"
                  value={editingDiscount.max_uses}
                  onChange={(event) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      max_uses: event.target.value,
                    })
                  }
                  placeholder="Unlimited"
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Active</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow this code to be used
                    </p>
                  </div>
                  <Switch
                    checked={editingDiscount.active}
                    onCheckedChange={(checked) =>
                      setEditingDiscount({ ...editingDiscount, active: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscountDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveDiscount} disabled={saving}>
              {saving ? "Saving..." : editingDiscount.id ? "Save Changes" : "Add Promo Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
