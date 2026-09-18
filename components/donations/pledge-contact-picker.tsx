"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getContactRecordTypeLabel, normalizeContactRecordType } from "@/lib/contacts/contact-constants"
import { searchContactsForDonationPickerAction } from "@/lib/donations/donation-list-actions"
import { cn } from "@/lib/utils"

type PledgeContactPickerProps = {
  organizationId: string | null
  contactId: string
  contactLabel?: string
  onChange: (contactId: string, label: string) => void
  disabled?: boolean
  label?: string
  inputId?: string
  onQueryChange?: (query: string) => void
  onCreateClick?: () => void
  createLabel?: string
  compact?: boolean
  placeholder?: string
  allowClear?: boolean
}

export function PledgeContactPicker({
  organizationId,
  contactId,
  contactLabel,
  onChange,
  disabled = false,
  label = "Assigned to",
  inputId = "pledge-contact-picker",
  onQueryChange,
  onCreateClick,
  createLabel = "Person or organization not found? Create one",
  compact = false,
  placeholder = "Search people or organizations",
  allowClear = false,
}: PledgeContactPickerProps) {
  const [search, setSearch] = useState(contactLabel || "")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<
    Array<{
      contactId: string
      full_name: string | null
      email: string | null
      phone: string | null
      contact_type?: string | null
      primary_contact_name?: string | null
    }>
  >([])

  const queryIsSelectedLabel =
    Boolean(contactId) && search.trim() === (contactLabel || "").trim()
  const showList = search.trim().length >= 2 && !queryIsSelectedLabel

  useEffect(() => {
    if (contactLabel) {
      setSearch(contactLabel)
      onQueryChange?.(contactLabel)
    }
  }, [contactLabel, onQueryChange])

  useEffect(() => {
    if (!showList) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    const timer = window.setTimeout(async () => {
      const result = await searchContactsForDonationPickerAction(search.trim(), 30)
      setSearching(false)

      if (!result.success) {
        setResults([])
        return
      }

      setResults(result.contacts)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [search, showList])

  function selectContact(nextContactId: string, nextLabel: string) {
    onChange(nextContactId, nextLabel)
    setSearch(nextLabel)
    setResults([])
  }

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-2")}>
      {compact ? null : <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        <Search
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
        />
        <Input
          id={inputId}
          value={search}
          disabled={disabled}
          placeholder={placeholder}
          className={cn("pl-9", compact && "h-8")}
          autoComplete="off"
          onChange={(event) => {
            const next = event.target.value
            setSearch(next)
            onQueryChange?.(next)
            if (allowClear && !next.trim() && contactId) {
              onChange("", "")
            }
          }}
        />
        {showList && searching ? (
          <p className="absolute z-30 mt-1 flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching...
          </p>
        ) : null}
        {showList && !searching && results.length > 0 ? (
          <div className="absolute z-30 mt-1 max-h-44 w-full space-y-1 overflow-y-auto rounded-lg border bg-background p-1 shadow-md">
            {results.map((contact) => (
              <button
                key={contact.contactId}
                type="button"
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                  contactId === contact.contactId && "bg-muted ring-1 ring-primary/30"
                )}
                onClick={() => {
                  const nextLabel =
                    contact.full_name || contact.email || contact.phone || "Unnamed contact"
                  selectContact(contact.contactId, nextLabel)
                }}
              >
                <p className="font-medium">{contact.full_name || "Unnamed contact"}</p>
                <p className="text-xs text-muted-foreground">
                  {getContactRecordTypeLabel(normalizeContactRecordType(contact.contact_type))}
                  {contact.primary_contact_name ? ` · ${contact.primary_contact_name}` : ""}
                  {contact.email ? ` · ${contact.email}` : ""}
                  {contact.phone ? ` · ${contact.phone}` : ""}
                </p>
              </button>
            ))}
          </div>
        ) : showList && !searching ? (
          <div className="absolute z-30 mt-1 w-full space-y-1 rounded-lg border bg-background p-2 text-sm text-muted-foreground shadow-md">
            <p>No person or organization found.</p>
            {onCreateClick ? (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={onCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                {createLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {!compact && onCreateClick && showList && !searching ? (
        <Button type="button" variant="outline" size="sm" onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>
      ) : null}
      {!organizationId ? (
        <p className="text-xs text-muted-foreground">Organization context is loading.</p>
      ) : null}
    </div>
  )
}
