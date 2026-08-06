"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  removeVendorFromEventAction,
  updateEventVendorRegistrationAction,
  type EventBoothOption,
} from "@/lib/vendor-hub/add-event-vendor-actions"
import type { EventParticipatingVendorRow } from "@/lib/vendor-hub/event-participating-vendors-queries"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

const NO_BOOTH = "__none__"
const NO_TYPE = "__none__"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

type EditEventVendorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  vendor: EventParticipatingVendorRow | null
  vendorTypes: VendorHubVendorType[]
  booths: EventBoothOption[]
}

export function EditEventVendorDialog({
  open,
  onOpenChange,
  eventId,
  vendor,
  vendorTypes,
  booths,
}: EditEventVendorDialogProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [refundFee, setRefundFee] = useState(true)

  const [businessName, setBusinessName] = useState("")
  const [vendorTypeId, setVendorTypeId] = useState(NO_TYPE)
  const [boothId, setBoothId] = useState(NO_BOOTH)
  const [feeAmount, setFeeAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")

  const activeTypes = useMemo(
    () => vendorTypes.filter((type) => type.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [vendorTypes]
  )

  const availableBooths = useMemo(() => {
    if (!vendor) return booths
    return booths.filter((booth) => {
      if (booth.id === vendor.boothId) return true
      const status = (booth.status || "").toLowerCase()
      return status !== "assigned" && status !== "reserved" && status !== "occupied"
    })
  }, [booths, vendor])

  useEffect(() => {
    if (!open || !vendor) return
    setError(null)
    setConfirmRemove(false)
    setRefundFee(vendor.amountPaid > 0)
    setBusinessName(vendor.businessName)
    setVendorTypeId(vendor.vendorTypeId || NO_TYPE)
    if (!vendor.vendorTypeId && vendor.boothType) {
      const match = activeTypes.find(
        (type) => type.name.toLowerCase() === vendor.boothType!.toLowerCase()
      )
      if (match) setVendorTypeId(match.id)
    }
    setBoothId(vendor.boothId || NO_BOOTH)
    setFeeAmount(vendor.amountPaid > 0 ? String(vendor.amountPaid) : "")
    setPaymentMethod("cash")
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setNotes(vendor.notes || "")
  }, [open, vendor, activeTypes])

  function handleSave() {
    if (!vendor) return
    const cleanBusiness = businessName.trim()
    if (!cleanBusiness) {
      setError("Business name is required.")
      return
    }

    const selectedType =
      vendorTypeId !== NO_TYPE ? activeTypes.find((type) => type.id === vendorTypeId) : null
    const fee =
      feeAmount.trim() === "" ? 0 : Number.parseFloat(feeAmount.replace(/[^0-9.-]/g, ""))

    if (Number.isNaN(fee) || fee < 0) {
      setError("Enter a valid fee amount.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await updateEventVendorRegistrationAction({
        eventId,
        contactId: vendor.contactId,
        businessName: cleanBusiness,
        vendorTypeId: selectedType?.id ?? null,
        vendorTypeName: selectedType?.name ?? vendor.boothType ?? null,
        boothId: boothId === NO_BOOTH ? null : boothId,
        feeAmount: fee,
        paymentMethod,
        paymentDate,
        notes: notes.trim() || null,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      onOpenChange(false)
      router.refresh()
    })
  }

  function handleRemove() {
    if (!vendor) return
    setError(null)
    startTransition(async () => {
      const result = await removeVendorFromEventAction({
        eventId,
        contactId: vendor.contactId,
        refundFee: refundFee && vendor.amountPaid > 0,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      onOpenChange(false)
      router.refresh()
    })
  }

  if (!vendor) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit event registration</DialogTitle>
          <DialogDescription>
            Update booth, fee, and other details for this vendor at this event only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium">{vendor.businessName}</p>
            <p className="text-muted-foreground">
              {vendor.contactName}
              {vendor.email ? ` · ${vendor.email}` : ""}
            </p>
            <Link
              href={vendor.profileHref}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              Open vendor profile
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-vendor-business">Business name</Label>
            <Input
              id="edit-vendor-business"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vendor type</Label>
              <Select value={vendorTypeId} onValueChange={setVendorTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TYPE}>None</SelectItem>
                  {activeTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Booth</Label>
              <Select value={boothId} onValueChange={setBoothId}>
                <SelectTrigger>
                  <SelectValue placeholder="No booth" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BOOTH}>No booth</SelectItem>
                  {availableBooths.map((booth) => (
                    <SelectItem key={booth.id} value={booth.id}>
                      {booth.number}
                      {booth.location ? ` · ${booth.location}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-vendor-fee">Fee / amount paid</Label>
              <Input
                id="edit-vendor-fee"
                type="number"
                min="0"
                step="0.01"
                value={feeAmount}
                onChange={(event) => setFeeAmount(event.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Current net collected: {formatCurrency(vendor.amountPaid)}. Saving a different
                amount records a payment or refund for the difference.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vendor-payment-date">Payment date</Label>
              <Input
                id="edit-vendor-payment-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="zelle">Zelle</SelectItem>
                <SelectItem value="venmo">Venmo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-vendor-notes">Notes</Label>
            <Textarea
              id="edit-vendor-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-destructive">Remove from event</p>
              <p className="text-xs text-muted-foreground">
                Removes this vendor from this event only. Their Vendor Network profile is kept.
              </p>
            </div>
            {vendor.amountPaid > 0 ? (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={refundFee}
                  onCheckedChange={(checked) => setRefundFee(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  Refund fee ({formatCurrency(vendor.amountPaid)})
                </span>
              </label>
            ) : null}
            {confirmRemove ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={pending}
                >
                  {pending ? "Removing..." : "Confirm remove"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmRemove(false)}
                  disabled={pending}
                >
                  Keep vendor
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmRemove(true)}
                disabled={pending}
              >
                Remove vendor from event
              </Button>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending || confirmRemove}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
