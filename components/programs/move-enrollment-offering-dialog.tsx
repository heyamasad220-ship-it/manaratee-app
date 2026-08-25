"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MoveOfferingTarget } from "@/lib/programs/move-enrollment-offering-shared"

export function MoveEnrollmentOfferingDialog({
  open,
  studentName,
  programName,
  destinations,
  selectedOfferingId,
  onSelectedOfferingIdChange,
  busy,
  loading = false,
  error,
  extraDescription,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  studentName: string
  programName: string
  destinations: MoveOfferingTarget[]
  selectedOfferingId: string
  onSelectedOfferingIdChange: (offeringId: string) => void
  busy: boolean
  loading?: boolean
  error: string | null
  extraDescription?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {studentName}</DialogTitle>
          <DialogDescription>
            {`Keep this enrollment — payments and history stay with the student.${
              extraDescription ? ` ${extraDescription}` : ""
            } Choose another offering in ${programName}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="move-to-offering">Move to</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading offerings…
            </div>
          ) : destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other offerings in this year.
            </p>
          ) : (
            <Select
              value={selectedOfferingId}
              onValueChange={onSelectedOfferingIdChange}
              disabled={busy}
            >
              <SelectTrigger id="move-to-offering">
                <SelectValue placeholder="Select an offering" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((offering) => (
                  <SelectItem key={offering.id} value={offering.id}>
                    {offering.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy || loading || !selectedOfferingId}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving…
              </>
            ) : (
              "Move student"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
