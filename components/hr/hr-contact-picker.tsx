"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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
import { searchContactsForHrPickerAction } from "@/lib/hr/hr-contact-search-actions"
import { cn } from "@/lib/utils"

export type HrContactOption = {
  contactId: string
  full_name: string | null
  email: string | null
  phone: string | null
}

type HrContactPickerProps = {
  selectedContactId: string | null
  selectedLabel: string
  onChange: (contact: HrContactOption) => void
  onClear?: () => void
  disabled?: boolean
  label?: string
}

function formatContactLabel(contact: HrContactOption) {
  const name = contact.full_name?.trim() || "Unnamed"
  const detail = contact.email || contact.phone
  return detail ? `${name} (${detail})` : name
}

export function HrContactPicker({
  selectedContactId,
  selectedLabel,
  onChange,
  onClear,
  disabled = false,
  label = "Contact",
}: HrContactPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<HrContactOption[]>([])

  const loadContacts = useCallback(async (term: string) => {
    setLoading(true)
    const result = await searchContactsForHrPickerAction(term, 30)
    setLoading(false)

    if (!result.success) {
      setContacts([])
      return
    }

    setContacts(
      result.contacts.map((contact) => ({
        contactId: contact.contactId,
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
      }))
    )
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
                    Create the person in{" "}
                    <Link
                      href="/directory/people"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      Directory
                    </Link>{" "}
                    first, then return here to add them.
                  </p>
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
      ) : (
        <p className="text-xs text-muted-foreground">
          People must exist in{" "}
          <Link href="/directory/people" className="text-primary underline-offset-4 hover:underline">
            Directory
          </Link>{" "}
          before they can be added here.
        </p>
      )}
    </div>
  )
}
