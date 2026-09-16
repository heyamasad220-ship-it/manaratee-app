"use client"

import { useEffect, useState } from "react"
import { Loader2, Search } from "lucide-react"

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
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          value={search}
          disabled={disabled}
          placeholder="Search people or organizations"
          className="pl-9"
          autoComplete="off"
          onChange={(event) => {
            const next = event.target.value
            setSearch(next)
            onQueryChange?.(next)
          }}
        />
      </div>
      {showList && searching ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching people and organizations...
        </p>
      ) : null}
      {showList && !searching && results.length > 0 ? (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-1">
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
        <p className="text-sm text-muted-foreground">No person or organization found.</p>
      ) : null}
      {onCreateClick && showList && !searching && results.length === 0 ? (
        <button
          type="button"
          className="h-auto justify-start px-0 text-sm font-medium text-primary hover:underline"
          onClick={onCreateClick}
        >
          {createLabel}
        </button>
      ) : null}
      {!organizationId ? (
        <p className="text-xs text-muted-foreground">Organization context is loading.</p>
      ) : null}
    </div>
  )
}
