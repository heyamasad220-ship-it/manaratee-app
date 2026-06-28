"use client"

import { useEffect, useState } from "react"
import { addContactWithRoles } from "@/lib/contacts/contact-actions"
import type { ContactRecordType } from "@/lib/contacts/contact-constants"
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

export type QuickAddContactResult = {
  contactId: string
  full_name: string | null
  email: string | null
  phone: string | null
  contact_type: ContactRecordType
}

export type QuickAddContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  searchHint?: string
  onCreated: (contact: QuickAddContactResult) => void
}

export function parseContactSearchDefaults(search: string) {
  const trimmed = search.trim()

  if (!trimmed) {
    return { name: "", email: "", phone: "" }
  }

  if (trimmed.includes("@")) {
    return { name: "", email: trimmed, phone: "" }
  }

  const normalized = trimmed.replace(/[\s\-().+]/g, "")
  if (/^\d{7,}$/.test(normalized)) {
    return { name: "", email: "", phone: trimmed }
  }

  return { name: trimmed, email: "", phone: "" }
}

function guessContactTypeFromName(name: string): ContactRecordType {
  const trimmed = name.trim()
  if (!trimmed) return "individual"

  if (
    /\b(LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|Company|Co\.|Foundation|Trust|Association)\b/i.test(
      trimmed
    )
  ) {
    return "organization"
  }

  return "individual"
}

export function QuickAddContactDialog({
  open,
  onOpenChange,
  searchHint = "",
  onCreated,
}: QuickAddContactDialogProps) {
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactType, setContactType] = useState<ContactRecordType>("individual")
  const [primaryContactName, setPrimaryContactName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    const defaults = parseContactSearchDefaults(searchHint)
    setContactName(defaults.name)
    setContactEmail(defaults.email)
    setContactPhone(defaults.phone)
    setContactType(guessContactTypeFromName(defaults.name))
    setPrimaryContactName("")
  }, [open, searchHint])

  async function handleSave() {
    const cleanName = contactName.trim()

    if (!cleanName) {
      alert("Contact name is required.")
      return
    }

    setSaving(true)

    try {
      const result = await addContactWithRoles({
        fullName: cleanName,
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        contactType,
        primaryContactName:
          contactType === "organization" ? primaryContactName.trim() || undefined : undefined,
        roles: [],
      })

      onCreated({
        contactId: result.contactId,
        full_name: cleanName,
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        contact_type: contactType,
      })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add contact."
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const isOrganization = contactType === "organization"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Create a person or organization for this pledge. The Donor role is added after
            the first payment, not when the pledge is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-add-type">Record type</Label>
            <Select
              value={contactType}
              onValueChange={(value) => setContactType(value as ContactRecordType)}
            >
              <SelectTrigger id="quick-add-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Person</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-add-name">
              {isOrganization ? "Organization name" : "Full name"}
            </Label>
            <Input
              id="quick-add-name"
              placeholder={isOrganization ? "Enter organization name" : "Enter full name"}
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </div>

          {isOrganization ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick-add-primary-contact">Primary contact name</Label>
              <Input
                id="quick-add-primary-contact"
                placeholder="Person we reach at this organization"
                value={primaryContactName}
                onChange={(event) => setPrimaryContactName(event.target.value)}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick-add-email">Email</Label>
              <Input
                id="quick-add-email"
                type="email"
                placeholder="Optional"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="quick-add-phone">Phone</Label>
              <Input
                id="quick-add-phone"
                type="tel"
                placeholder="Optional"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
