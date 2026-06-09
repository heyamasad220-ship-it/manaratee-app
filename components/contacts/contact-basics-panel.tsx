"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateContactBasics } from "@/lib/contacts/contact-actions"
import { STATUS_OPTIONS, statusToDbValue } from "@/lib/contacts/contact-constants"

type ContactBasicsPanelProps = {
  contact: {
    id: string
    full_name?: string | null
    email?: string | null
    phone?: string | null
    primary_contact_name?: string | null
    contact_type?: string | null
    status?: string | null
    created_at?: string | null
  }
  onSaved: () => Promise<void>
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

export function ContactBasicsPanel({ contact, onSaved }: ContactBasicsPanelProps) {
  const isOrganization = contact.contact_type === "organization"
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [fullName, setFullName] = useState(contact.full_name || "")
  const [email, setEmail] = useState(contact.email || "")
  const [phone, setPhone] = useState(contact.phone || "")
  const [primaryContactName, setPrimaryContactName] = useState(
    contact.primary_contact_name || ""
  )
  const [status, setStatus] = useState(statusToDbValue((contact.status as any) || "Active"))

  useEffect(() => {
    if (!isEditing) {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contact.id,
    contact.full_name,
    contact.email,
    contact.phone,
    contact.primary_contact_name,
    contact.status,
  ])

  function resetForm() {
    setFullName(contact.full_name || "")
    setEmail(contact.email || "")
    setPhone(contact.phone || "")
    setPrimaryContactName(contact.primary_contact_name || "")
    setStatus(statusToDbValue((contact.status as any) || "Active"))
    setError(null)
  }

  function handleCancel() {
    resetForm()
    setIsEditing(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await updateContactBasics({
          contactId: contact.id,
          fullName,
          email: email || null,
          phone: phone || null,
          primaryContactName: primaryContactName || null,
          status,
        })
        setIsEditing(false)
        await onSaved()
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Could not save contact."
        )
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Contact information</CardTitle>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-full-name">
                {isOrganization ? "Organization name" : "Full name"}
              </Label>
              <Input
                id="profile-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>
            {isOrganization ? (
              <div className="space-y-2">
                <Label htmlFor="profile-primary-contact">Primary contact name</Label>
                <Input
                  id="profile-primary-contact"
                  value={primaryContactName}
                  onChange={(event) => setPrimaryContactName(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2 sm:max-w-xs">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Email</dt>
              <dd>{contact.email || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Phone</dt>
              <dd>{contact.phone || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Status</dt>
              <dd className="capitalize">{contact.status || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd>{formatDate(contact.created_at)}</dd>
            </div>
            {isOrganization && contact.primary_contact_name ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-muted-foreground">Primary contact</dt>
                <dd>{contact.primary_contact_name}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
