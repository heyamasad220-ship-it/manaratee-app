"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  searchVendorsForPickerAction,
  type VendorPickerOption,
} from "@/lib/vendor-hub/vendor-search-actions"
import { cn } from "@/lib/utils"

export type { VendorPickerOption }

type VendorPickerProps = {
  selectedContactId: string | null
  selectedLabel: string
  onChange: (vendor: VendorPickerOption) => void
  onClear?: () => void
  disabled?: boolean
  label?: string
}

function formatVendorLabel(vendor: VendorPickerOption) {
  const business = vendor.businessName.trim() || vendor.contactName
  const detail = vendor.contactName !== business ? vendor.contactName : vendor.email || vendor.phone
  return detail ? `${business} · ${detail}` : business
}

export function VendorPicker({
  selectedContactId,
  selectedLabel,
  onChange,
  onClear,
  disabled = false,
  label = "Vendor",
}: VendorPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [vendors, setVendors] = useState<VendorPickerOption[]>([])

  const loadVendors = useCallback(async (term: string) => {
    setLoading(true)
    const result = await searchVendorsForPickerAction(term, 30)
    setLoading(false)

    if (!result.success) {
      setVendors([])
      return
    }

    setVendors(result.vendors)
  }, [])

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      void loadVendors(search)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [open, search, loadVendors])

  const displayLabel =
    selectedLabel ||
    (selectedContactId
      ? formatVendorLabel(
          vendors.find((vendor) => vendor.contactId === selectedContactId) || {
            contactId: selectedContactId,
            businessName: "Selected vendor",
            contactName: "Selected vendor",
            email: null,
            phone: null,
            vendorTypeId: null,
          }
        )
      : "Search vendors by business, name, email, or phone...")

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search vendors..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching vendors...
                </div>
              ) : null}
              <CommandEmpty>
                <div className="space-y-1 px-2 py-3 text-sm">
                  <p>No vendor found.</p>
                  <p className="text-muted-foreground">
                    Use Create new vendor to add them to the Vendor Network first.
                  </p>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {vendors.map((vendor) => {
                  const itemLabel = formatVendorLabel(vendor)
                  return (
                    <CommandItem
                      key={vendor.contactId}
                      value={vendor.contactId}
                      onSelect={() => {
                        onChange(vendor)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedContactId === vendor.contactId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{vendor.businessName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {vendor.contactName}
                          {vendor.email ? ` · ${vendor.email}` : ""}
                        </p>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedContactId && onClear ? (
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={onClear}
        >
          Clear selection
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only vendors already in the Vendor Network appear here.
        </p>
      )}
    </div>
  )
}
