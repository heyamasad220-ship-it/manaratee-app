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
import { searchContactsForVendorCreateAction } from "@/lib/vendor-hub/vendor-search-actions"
import { cn } from "@/lib/utils"

export type ContactSearchOption = {
  contactId: string
  full_name: string | null
  email: string | null
  phone: string | null
}

type ContactSearchPickerProps = {
  selectedContactId: string | null
  selectedLabel: string
  onChange: (contact: ContactSearchOption) => void
  onClear?: () => void
  onCreateNew?: () => void
  disabled?: boolean
  label?: string
}

function formatContactLabel(contact: ContactSearchOption) {
  const name = contact.full_name?.trim() || "Unnamed"
  const detail = contact.email || contact.phone
  return detail ? `${name} (${detail})` : name
}

/** Contact search for creating a vendor (not limited to the Vendor Network). */
export function ContactSearchPicker({
  selectedContactId,
  selectedLabel,
  onChange,
  onClear,
  onCreateNew,
  disabled = false,
  label = "Contact",
}: ContactSearchPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<ContactSearchOption[]>([])

  const loadContacts = useCallback(async (term: string) => {
    setLoading(true)
    const result = await searchContactsForVendorCreateAction(term, 30)
    setLoading(false)

    if (!result.success) {
      setContacts([])
      return
    }

    setContacts(result.contacts)
  }, [])

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      void loadContacts(search)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [open, search, loadContacts])

  const displayLabel =
    selectedLabel ||
    (selectedContactId
      ? formatContactLabel(
          contacts.find((contact) => contact.contactId === selectedContactId) || {
            contactId: selectedContactId,
            full_name: "Selected contact",
            email: null,
            phone: null,
          }
        )
      : "Search contacts by name, email, or phone...")

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
              placeholder="Search by name, email, or phone..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching contacts...
                </div>
              ) : null}
              <CommandEmpty>
                <div className="space-y-2 px-2 py-3 text-sm">
                  <p>No contact found.</p>
                  <p className="text-muted-foreground">
                    Create a Directory record first, then finish adding the vendor.
                  </p>
                  {onCreateNew ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setOpen(false)
                        onCreateNew()
                      }}
                    >
                      Create new contact
                    </Button>
                  ) : null}
                </div>
              </CommandEmpty>
              <CommandGroup>
                {contacts.map((contact) => {
                  const itemLabel = formatContactLabel(contact)
                  return (
                    <CommandItem
                      key={contact.contactId}
                      value={contact.contactId}
                      onSelect={() => {
                        onChange(contact)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedContactId === contact.contactId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {itemLabel}
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
      ) : null}
    </div>
  )
}
