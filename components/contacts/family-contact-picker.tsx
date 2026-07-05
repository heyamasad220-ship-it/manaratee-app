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
import { searchContactsForFamilyLinkAction } from "@/lib/contacts/family-management-actions"
import { cn } from "@/lib/utils"

type FamilyContactOption = {
  contactId: string
  full_name: string | null
  email: string | null
  phone: string | null
}

type FamilyContactPickerProps = {
  selectedContactId: string | null
  selectedLabel: string
  onChange: (contactId: string, label: string) => void
  excludeContactId?: string
  disabled?: boolean
}

function formatContactLabel(contact: FamilyContactOption) {
  const name = contact.full_name?.trim() || "Unnamed"
  const detail = contact.email || contact.phone
  return detail ? `${name} (${detail})` : name
}

export function FamilyContactPicker({
  selectedContactId,
  selectedLabel,
  onChange,
  excludeContactId,
  disabled = false,
}: FamilyContactPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<FamilyContactOption[]>([])

  const loadContacts = useCallback(
    async (term: string) => {
      setLoading(true)
      const result = await searchContactsForFamilyLinkAction(term, 30)
      setLoading(false)

      if (!result.success) {
        setContacts([])
        return
      }

      setContacts(
        result.contacts
          .filter((contact) => contact.contactId !== excludeContactId)
          .map((contact) => ({
            contactId: contact.contactId,
            full_name: contact.full_name,
            email: contact.email,
            phone: contact.phone,
          }))
      )
    },
    [excludeContactId]
  )

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
      : "Search contacts...")

  return (
    <div className="space-y-2">
      <Label>Existing contact</Label>
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
              <CommandEmpty>No contacts found.</CommandEmpty>
              <CommandGroup>
                {contacts.map((contact) => {
                  const label = formatContactLabel(contact)
                  return (
                    <CommandItem
                      key={contact.contactId}
                      value={contact.contactId}
                      onSelect={() => {
                        onChange(contact.contactId, label)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedContactId === contact.contactId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
