"use client"

import { useEffect, useState } from "react"
import { addContactWithRoles } from "@/lib/contacts/contact-actions"
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

export type QuickAddContactResult = {
  contactId: string
  full_name: string | null
  email: string | null
  phone: string | null
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

export function QuickAddContactDialog({
  open,
  onOpenChange,
  searchHint = "",
  onCreated,
}: QuickAddContactDialogProps) {
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    const defaults = parseContactSearchDefaults(searchHint)
    setContactName(defaults.name)
    setContactEmail(defaults.email)
    setContactPhone(defaults.phone)
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
        contactType: "individual",
        roles: [],
      })

      onCreated({
        contactId: result.contactId,
        full_name: cleanName,
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
      })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add contact."
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Create a contact to use for this pledge. Affiliations such as donor sync automatically
            when the pledge is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-add-name">Full Name</Label>
            <Input
              id="quick-add-name"
              placeholder="Enter full name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </div>

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
