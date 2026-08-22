"use client"

import { useEffect, useState } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listWishlistItemsForCampaignPickerAction } from "@/lib/donations/campaign-wishlist-actions"

const NONE = "none"

export function WishlistItemPicker({
  campaignId,
  value,
  onChange,
  disabled,
}: {
  campaignId: string | null
  value: string | null
  onChange: (wishlistItemId: string | null) => void
  disabled?: boolean
}) {
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!campaignId) {
      setItems([])
      if (value) onChange(null)
      return
    }
    void (async () => {
      const result = await listWishlistItemsForCampaignPickerAction(campaignId)
      if (result.success) setItems(result.items)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  if (!campaignId) {
    return (
      <div className="grid gap-1">
        <Label>Wishlist Item</Label>
        <p className="text-sm text-muted-foreground">Select a campaign first to attribute a wishlist item.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-1">
      <Label>Wishlist Item</Label>
      <Select
        value={value || NONE}
        onValueChange={(next) => onChange(next === NONE ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Optional wishlist item" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
