"use client"

import { useEffect, useMemo, useState } from "react"
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
}

export function PledgeContactPicker({
  organizationId,
  contactId,
  contactLabel,
  onChange,
  disabled = false,
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
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (contactLabel) {
      setSearch(contactLabel)
    }
  }, [contactLabel])

  useEffect(() => {
    if (!showResults || search.trim().length < 2) {
      setResults([])
      return
    }

    const timer = window.setTimeout(async () => {
      setSearching(true)
      const result = await searchContactsForDonationPickerAction(search.trim(), 30)
      setSearching(false)

      if (!result.success) {
        setResults([])
        return
      }

      setResults(result.contacts)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [search, showResults])

  const selectedLabel = useMemo(() => {
    if (contactLabel) return contactLabel
    const match = results.find((row) => row.contactId === contactId)
    return match?.full_name || match?.email || match?.phone || ""
  }, [contactId, contactLabel, results])

  return (
    <div className="space-y-2">
      <Label htmlFor="pledge-contact-picker">Assigned to</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="pledge-contact-picker"
          value={search}
          disabled={disabled}
          placeholder="Search person, organization, or group"
          className="pl-9"
          onFocus={() => setShowResults(true)}
          onChange={(event) => {
            setSearch(event.target.value)
            setShowResults(true)
          }}
          onBlur={() => {
            window.setTimeout(() => setShowResults(false), 150)
          }}
        />
      </div>
      {contactId && selectedLabel ? (
        <p className="text-xs text-muted-foreground">
          Current: <span className="font-medium text-foreground">{selectedLabel}</span>
        </p>
      ) : null}
      {showResults && searching ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </p>
      ) : null}
      {showResults && results.length > 0 ? (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-1">
          {results.map((contact) => (
            <button
              key={contact.contactId}
              type="button"
              className={cn(
                "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                contactId === contact.contactId && "bg-muted ring-1 ring-primary/30"
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const label = contact.full_name || contact.email || contact.phone || "Unnamed contact"
                onChange(contact.contactId, label)
                setSearch(label)
                setShowResults(false)
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
      ) : showResults && search.trim().length >= 2 && !searching ? (
        <p className="text-sm text-muted-foreground">No contacts found.</p>
      ) : null}
      {!organizationId ? (
        <p className="text-xs text-muted-foreground">Organization context is loading.</p>
      ) : null}
    </div>
  )
}
