"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"

import { CreateVendorDialog } from "@/components/vendor-hub/events/create-vendor-dialog"
import { VendorPicker, type VendorPickerOption } from "@/components/vendor-hub/vendor-picker"
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
import { Textarea } from "@/components/ui/textarea"
import {
  addVendorToEventAction,
  type EventBoothOption,
} from "@/lib/vendor-hub/add-event-vendor-actions"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

const NO_BOOTH = "__none__"
const NO_TYPE = "__none__"

type AddEventVendorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  vendorTypes: VendorHubVendorType[]
  booths: EventBoothOption[]
  existingContactIds: string[]
}

export function AddEventVendorDialog({
  open,
  onOpenChange,
  eventId,
  vendorTypes,
  booths,
  existingContactIds,
}: AddEventVendorDialogProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [createVendorOpen, setCreateVendorOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contactId, setContactId] = useState<string | null>(null)
  const [vendorLabel, setVendorLabel] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [vendorTypeId, setVendorTypeId] = useState<string>(NO_TYPE)
  const [boothId, setBoothId] = useState<string>(NO_BOOTH)
  const [feeAmount, setFeeAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [productsServices, setProductsServices] = useState("")
  const [notes, setNotes] = useState("")

  const availableBooths = useMemo(
    () =>
      booths.filter((booth) => {
        const status = (booth.status || "").toLowerCase()
        return status !== "assigned" && status !== "reserved" && status !== "occupied"
      }),
    [booths]
  )

  const activeTypes = useMemo(
    () => vendorTypes.filter((type) => type.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [vendorTypes]
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setContactId(null)
    setVendorLabel("")
    setBusinessName("")
    setVendorTypeId(NO_TYPE)
    setBoothId(NO_BOOTH)
    setFeeAmount("")
    setPaymentMethod("cash")
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setProductsServices("")
    setNotes("")
  }, [open])

  function applyVendor(vendor: VendorPickerOption) {
    setContactId(vendor.contactId)
    const detail =
      vendor.contactName !== vendor.businessName
        ? vendor.contactName
        : vendor.email || vendor.phone
    setVendorLabel(detail ? `${vendor.businessName} · ${detail}` : vendor.businessName)
    setBusinessName(vendor.businessName)
    if (vendor.vendorTypeId) {
      setVendorTypeId(vendor.vendorTypeId)
      const selected = activeTypes.find((type) => type.id === vendor.vendorTypeId)
      if (selected?.default_fee != null && Number.isFinite(Number(selected.default_fee))) {
        setFeeAmount(String(selected.default_fee))
      }
    }
    setError(null)
  }

  function handleVendorTypeChange(value: string) {
    setVendorTypeId(value)
    if (value === NO_TYPE) return
    const selected = activeTypes.find((type) => type.id === value)
    if (selected?.default_fee != null && Number.isFinite(Number(selected.default_fee))) {
      setFeeAmount(String(selected.default_fee))
    }
  }

  function handleSubmit() {
    if (!contactId) {
      setError("Select a vendor, or create one first.")
      return
    }
    if (existingContactIds.includes(contactId)) {
      setError("This vendor is already listed for this event.")
      return
    }
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
      setError("Enter a valid fee amount (or leave blank for $0).")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await addVendorToEventAction({
        eventId,
        contactId,
        businessName: cleanBusiness,
        vendorTypeId: selectedType?.id ?? null,
        vendorTypeName: selectedType?.name ?? null,
        boothId: boothId === NO_BOOTH ? null : boothId,
        feeAmount: fee,
        paymentMethod: fee > 0 ? paymentMethod : null,
        paymentDate: fee > 0 ? paymentDate : null,
        productsServices: productsServices.trim() || null,
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add vendor</DialogTitle>
            <DialogDescription>
              Select a vendor from the Vendor Network. If they are not listed, create a new vendor
              first, then add booth and fee details for this event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <VendorPicker
                selectedContactId={contactId}
                selectedLabel={vendorLabel}
                onChange={applyVendor}
                onClear={() => {
                  setContactId(null)
                  setVendorLabel("")
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setCreateVendorOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new vendor
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-vendor-business">Business name</Label>
              <Input
                id="add-vendor-business"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="e.g., Dubai Oud"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vendor type</Label>
                <Select value={vendorTypeId} onValueChange={handleVendorTypeChange}>
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
                <Label>Booth (optional)</Label>
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
                <Label htmlFor="add-vendor-fee">Fee</Label>
                <Input
                  id="add-vendor-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeAmount}
                  onChange={(event) => setFeeAmount(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-vendor-payment-date">Payment date</Label>
                <Input
                  id="add-vendor-payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  disabled={!feeAmount || Number(feeAmount) <= 0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                disabled={!feeAmount || Number(feeAmount) <= 0}
              >
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
              <Label htmlFor="add-vendor-products">Products / services</Label>
              <Textarea
                id="add-vendor-products"
                value={productsServices}
                onChange={(event) => setProductsServices(event.target.value)}
                placeholder="What they sell or offer"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-vendor-notes">Notes</Label>
              <Textarea
                id="add-vendor-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes"
                rows={2}
              />
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
            <Button type="button" onClick={handleSubmit} disabled={pending}>
              {pending ? "Adding..." : "Add vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateVendorDialog
        open={createVendorOpen}
        onOpenChange={setCreateVendorOpen}
        vendorTypes={vendorTypes}
        onCreated={applyVendor}
      />
    </>
  )
}
