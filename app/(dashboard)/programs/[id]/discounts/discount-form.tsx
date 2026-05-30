"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type DiscountTag = {
  id: string
  name: string
}

type ProgramDiscount = {
  id: string
  discount_tag_id: string | null
  discount_type: "percent" | "fixed_amount"
  amount: number
  is_active: boolean
}

type DiscountFormProps = {
  programId: string
  organizationId: string
  discountTags: DiscountTag[]
  discount?: ProgramDiscount
}

export function DiscountForm({
  programId,
  organizationId,
  discountTags,
  discount,
}: DiscountFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const isEditing = Boolean(discount)

  const [showForm, setShowForm] = useState(!isEditing)
  const [discountTagId, setDiscountTagId] = useState(
    discount?.discount_tag_id ?? ""
  )
  const [discountType, setDiscountType] = useState<
    "percent" | "fixed_amount"
  >(discount?.discount_type ?? "percent")
  const [amount, setAmount] = useState(String(discount?.amount ?? ""))
  const [isActive, setIsActive] = useState(discount?.is_active ?? true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSave() {
    if (!discountTagId) {
      alert("Please select a discount tag.")
      return
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.")
      return
    }

    setIsSaving(true)

    if (isEditing && discount) {
      const selectedTag = discountTags.find((tag) => tag.id === discountTagId)

const { error } = await supabase
  .from("program_discounts")
  .update({
    discount_tag_id: discountTagId,
    name: selectedTag?.name ?? "Program Discount",
    discount_type: discountType,
    amount: Number(amount),
    is_active: isActive,
    applies_to: "program",
    updated_at: new Date().toISOString(),
  })
        .eq("id", discount.id)

      setIsSaving(false)

      if (error) {
        console.error("Error updating discount:", error)
        alert(error.message)
        return
      }

      setShowForm(false)
      router.refresh()
      return
    }

    const selectedTag = discountTags.find((tag) => tag.id === discountTagId)

const { error } = await supabase.from("program_discounts").insert({
  program_id: programId,
  organization_id: organizationId,
  discount_tag_id: discountTagId,
  name: selectedTag?.name ?? "Program Discount",
  discount_type: discountType,
  amount: Number(amount),
  applies_to: "program",
  is_active: isActive,
})

    setIsSaving(false)

    if (error) {
      console.error("Error creating discount:", error)
      alert(error.message)
      return
    }

    setDiscountTagId("")
    setDiscountType("percent")
    setAmount("")
    setIsActive(true)
    router.refresh()
  }

  async function handleDelete() {
    if (!discount) return

    const confirmed = window.confirm(
      "Delete this discount? This cannot be undone."
    )

    if (!confirmed) return

    setIsDeleting(true)

    const { error } = await supabase
      .from("program_discounts")
      .delete()
      .eq("id", discount.id)

    setIsDeleting(false)

    if (error) {
      console.error("Error deleting discount:", error)
      alert(error.message)
      return
    }

    router.refresh()
  }

  if (isEditing && !showForm) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
        Edit
      </Button>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-4 font-medium">
        {isEditing ? "Edit Discount" : "Add Discount"}
      </h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Discount Tag</Label>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm"
            value={discountTagId}
            onChange={(event) => setDiscountTagId(event.target.value)}
          >
            <option value="">Select a discount tag</option>
            {discountTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Discount Type</Label>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm"
            value={discountType}
            onChange={(event) =>
              setDiscountType(
                event.target.value as "percent" | "fixed_amount"
              )
            }
          >
            <option value="percent">Percentage</option>
            <option value="fixed_amount">Fixed Amount</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Example: 20"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Active
        </label>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Save Discount"}
          </Button>

          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}