"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface AddSpaceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddSpaceModal({ open, onOpenChange }: AddSpaceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Space</DialogTitle>
          <DialogDescription>
            Create a new bookable space with capacity, hours, and pricing details.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 py-2">
          {/* Space Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-name">Space Name</Label>
            <Input id="space-name" placeholder="e.g. Conference Room A" />
          </div>

          {/* Capacity */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-capacity">Capacity</Label>
            <Input id="space-capacity" type="number" placeholder="e.g. 50" />
          </div>

          {/* Hours of Availability */}
          <div className="flex flex-col gap-2">
            <Label>Hours of Availability</Label>
            <div className="flex items-center gap-2">
              <Select defaultValue="8am">
                <SelectTrigger id="hours-from" className="flex-1">
                  <SelectValue placeholder="From" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 16 }, (_, i) => i + 6).map((hour) => {
                    const ampm = hour >= 12 ? "PM" : "AM"
                    const h = hour > 12 ? hour - 12 : hour
                    const val = `${hour}am`
                    return (
                      <SelectItem key={val} value={val}>
                        {h}:00 {ampm}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">to</span>
              <Select defaultValue="18am">
                <SelectTrigger id="hours-to" className="flex-1">
                  <SelectValue placeholder="To" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 16 }, (_, i) => i + 6).map((hour) => {
                    const ampm = hour >= 12 ? "PM" : "AM"
                    const h = hour > 12 ? hour - 12 : hour
                    const val = `${hour}am`
                    return (
                      <SelectItem key={val} value={val}>
                        {h}:00 {ampm}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing - Peak Days */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-semibold text-amber-700">Peak Days (F-S)</Label>
            <div className="grid grid-cols-2 gap-4 rounded-md border border-amber-200 bg-amber-50/30 p-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="peak-flat" className="text-xs text-muted-foreground font-normal">
                  Flat Fee
                </Label>
                <Input id="peak-flat" placeholder="e.g. $500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="peak-hourly" className="text-xs text-muted-foreground font-normal">
                  Hourly Fee
                </Label>
                <Input id="peak-hourly" placeholder="e.g. $75/hr" />
              </div>
            </div>
          </div>

          {/* Pricing - Non-Peak Days */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-semibold text-blue-700">Non-Peak Days (M-Th)</Label>
            <div className="grid grid-cols-2 gap-4 rounded-md border border-blue-200 bg-blue-50/30 p-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="non-peak-flat" className="text-xs text-muted-foreground font-normal">
                  Flat Fee
                </Label>
                <Input id="non-peak-flat" placeholder="e.g. $350" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="non-peak-hourly" className="text-xs text-muted-foreground font-normal">
                  Hourly Fee
                </Label>
                <Input id="non-peak-hourly" placeholder="e.g. $50/hr" />
              </div>
            </div>
          </div>

          {/* Tag */}
          <div className="flex flex-col gap-2">
            <Label>Tag</Label>
            <RadioGroup defaultValue="internal" className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="internal" id="tag-internal" />
                <Label htmlFor="tag-internal" className="font-normal">Internal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="external" id="tag-external" />
                <Label htmlFor="tag-external" className="font-normal">External</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Location / Address */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-location">Location / Address</Label>
            <Input id="space-location" placeholder="e.g. Building A, Floor 2" />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-description">Description</Label>
            <Textarea
              id="space-description"
              placeholder="Describe the space, amenities, rules, etc."
              rows={3}
            />
          </div>

          {/* Amenities */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-amenities">Amenities</Label>
            <Input id="space-amenities" placeholder="e.g. Projector, Whiteboard, Wi-Fi" />
            <p className="text-xs text-muted-foreground">Separate with commas</p>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Add Space</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
