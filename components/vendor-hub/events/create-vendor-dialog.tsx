"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Plus } from "lucide-react"

import { QuickAddContactDialog } from "@/components/contacts/quick-add-contact-dialog"
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
import { ContactSearchPicker } from "@/components/vendor-hub/contact-search-picker"
import { createVendorInNetworkAction } from "@/lib/vendor-hub/add-event-vendor-actions"
import type { VendorPickerOption } from "@/lib/vendor-hub/vendor-search-actions"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

const NO_TYPE = "__none__"

type CreateVendorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendorTypes: VendorHubVendorType[]
  onCreated: (vendor: VendorPickerOption) => void
  title?: string
}

export function CreateVendorDialog({
  open,
  onOpenChange,
  vendorTypes,
  onCreated,
  title = "Create new vendor",
}: CreateVendorDialogProps) {
  const [pending, startTransition] = useTransition()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contactId, setContactId] = useState<string | null>(null)
  const [contactLabel, setContactLabel] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [vendorTypeId, setVendorTypeId] = useState(NO_TYPE)
  const [productsServices, setProductsServices] = useState("")

  const activeTypes = useMemo(
    () => vendorTypes.filter((type) => type.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [vendorTypes]
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setContactId(null)
    setContactLabel("")
    setBusinessName("")
    setVendorTypeId(NO_TYPE)
    setProductsServices("")
  }, [open])

  function handleSubmit() {
    if (!contactId) {
      setError("Select a contact, or create one first.")
      return
    }
    const cleanBusiness = businessName.trim()
    if (!cleanBusiness) {
      setError("Business name is required.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await createVendorInNetworkAction({
        contactId,
        businessName: cleanBusiness,
        vendorTypeId: vendorTypeId === NO_TYPE ? null : vendorTypeId,
        productsServices: productsServices.trim() || null,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      onCreated(result.vendor)
      onOpenChange(false)
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Search Contacts for the person or business. If they are not found, create a contact
              first — then we add the vendor role and vendor profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <ContactSearchPicker
                label="Contact"
                selectedContactId={contactId}
                selectedLabel={contactLabel}
                onChange={(contact) => {
                  setContactId(contact.contactId)
                  const name = contact.full_name?.trim() || "Unnamed"
                  const detail = contact.email || contact.phone
                  setContactLabel(detail ? `${name} (${detail})` : name)
                  if (!businessName.trim() && contact.full_name?.trim()) {
                    setBusinessName(contact.full_name.trim())
                  }
                  setError(null)
                }}
                onClear={() => {
                  setContactId(null)
                  setContactLabel("")
                }}
                onCreateNew={() => setQuickAddOpen(true)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setQuickAddOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new contact
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-vendor-business">Business name</Label>
              <Input
                id="create-vendor-business"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="e.g., Dubai Oud"
              />
            </div>

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
              <Label htmlFor="create-vendor-products">Products / services</Label>
              <Textarea
                id="create-vendor-products"
                value={productsServices}
                onChange={(event) => setProductsServices(event.target.value)}
                placeholder="Optional"
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
              {pending ? "Saving..." : title === "Add Vendor" ? "Add Vendor" : "Create vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddContactDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCreated={(contact) => {
          setContactId(contact.contactId)
          const name = contact.full_name?.trim() || "Unnamed"
          const detail = contact.email || contact.phone
          setContactLabel(detail ? `${name} (${detail})` : name)
          if (!businessName.trim() && contact.full_name?.trim()) {
            setBusinessName(contact.full_name.trim())
          }
          setError(null)
        }}
      />
    </>
  )
}
