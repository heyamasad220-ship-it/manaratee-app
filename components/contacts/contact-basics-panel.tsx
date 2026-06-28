"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, MapPin, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BirthDateInput } from "@/components/ui/birth-date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateContactBasics } from "@/lib/contacts/contact-actions"
import { updateContactPersonDetails } from "@/lib/contacts/contact-profile-admin-actions"
import {
  STATUS_OPTIONS,
  statusToDbValue,
  mapStatus,
  type ContactRecordType,
  normalizeContactRecordType,
  usesPrimaryContactField,
  getContactRecordTypeLabel,
} from "@/lib/contacts/contact-constants"

export type ContactBasicsHeaderMeta = {
  contactType: ContactRecordType
  setContactType: (value: ContactRecordType) => void
  status: string
  setStatus: (value: string) => void
  isEditing: boolean
}

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
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    country?: string | null
    notes?: string | null
  }
  personDetails?: {
    dateOfBirth: string | null
    gender: string | null
  } | null
  defaultEditing?: boolean
  onEditingChange?: (editing: boolean) => void
  onSaved: () => Promise<void>
  layout?: "default" | "overview-general"
  showEditButton?: boolean
  onHeaderMetaChange?: (meta: ContactBasicsHeaderMeta) => void
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

function formatAddress(contact: ContactBasicsPanelProps["contact"]) {
  const parts = [
    contact.address,
    [contact.city, contact.state, contact.zip].filter(Boolean).join(", "),
    contact.country,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join("\n") : "—"
}

export function ContactBasicsPanel({
  contact,
  personDetails = null,
  defaultEditing = false,
  onEditingChange,
  onSaved,
  layout = "default",
  showEditButton = true,
  onHeaderMetaChange,
}: ContactBasicsPanelProps) {
  const [isEditing, setIsEditing] = useState(defaultEditing)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [fullName, setFullName] = useState(contact.full_name || "")
  const [email, setEmail] = useState(contact.email || "")
  const [phone, setPhone] = useState(contact.phone || "")
  const [primaryContactName, setPrimaryContactName] = useState(
    contact.primary_contact_name || ""
  )
  const [contactType, setContactType] = useState<ContactRecordType>(
    normalizeContactRecordType(contact.contact_type)
  )
  const [status, setStatus] = useState(statusToDbValue(mapStatus(contact.status)))
  const [address, setAddress] = useState(contact.address || "")
  const [city, setCity] = useState(contact.city || "")
  const [state, setState] = useState(contact.state || "")
  const [zip, setZip] = useState(contact.zip || "")
  const [country, setCountry] = useState(contact.country || "")
  const [notes, setNotes] = useState(contact.notes || "")
  const [dateOfBirth, setDateOfBirth] = useState(personDetails?.dateOfBirth || "")
  const [gender, setGender] = useState(personDetails?.gender || "")

  const isEntity = usesPrimaryContactField(contactType)
  const isOrganization = contactType === "organization"
  const isGroup = contactType === "group"
  const isOverviewGeneral = layout === "overview-general"

  function setEditing(next: boolean) {
    setIsEditing(next)
    onEditingChange?.(next)
  }

  useEffect(() => {
    setEditing(defaultEditing)
    if (defaultEditing) {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEditing, contact.id])

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
    contact.contact_type,
    contact.status,
    contact.address,
    contact.city,
    contact.state,
    contact.zip,
    contact.country,
    contact.notes,
    personDetails?.dateOfBirth,
    personDetails?.gender,
  ])

  useEffect(() => {
    onHeaderMetaChange?.({
      contactType,
      setContactType,
      status,
      setStatus,
      isEditing,
    })
  }, [contactType, status, isEditing, onHeaderMetaChange])

  function resetForm() {
    setFullName(contact.full_name || "")
    setEmail(contact.email || "")
    setPhone(contact.phone || "")
    setPrimaryContactName(contact.primary_contact_name || "")
    setContactType(normalizeContactRecordType(contact.contact_type))
    setStatus(statusToDbValue(mapStatus(contact.status)))
    setAddress(contact.address || "")
    setCity(contact.city || "")
    setState(contact.state || "")
    setZip(contact.zip || "")
    setCountry(contact.country || "")
    setNotes(contact.notes || "")
    setDateOfBirth(personDetails?.dateOfBirth || "")
    setGender(personDetails?.gender || "")
    setError(null)
  }

  function handleCancel() {
    resetForm()
    setEditing(false)
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
          contactType,
          status,
          ...(isGroup
            ? {}
            : {
                address: address || null,
                city: city || null,
                state: state || null,
                zip: zip || null,
                country: country || null,
              }),
          notes: notes || null,
        })

        if (!isEntity) {
          await updateContactPersonDetails({
            contactId: contact.id,
            dateOfBirth: dateOfBirth || null,
            gender: gender || null,
          })
        }

        setEditing(false)
        onEditingChange?.(false)
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
      {!isOverviewGeneral ? (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Contact information</CardTitle>
          {!isEditing && showEditButton ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className={isOverviewGeneral ? "pt-4" : undefined}>
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isEditing ? (
          isOverviewGeneral ? (
            <div className="space-y-3">
              {!isEntity ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-full-name">Full name</Label>
                      <Input
                        id="profile-full-name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-dob">Date of birth</Label>
                      <BirthDateInput
                        id="profile-dob"
                        value={dateOfBirth}
                        onChange={setDateOfBirth}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-gender">Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger id="profile-gender">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-phone">Phone</Label>
                      <Input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-address">Address</Label>
                    <div className="grid gap-2 sm:grid-cols-6">
                      <Input
                        id="profile-address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder="Street"
                        className="sm:col-span-2"
                      />
                      <Input
                        id="profile-city"
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        placeholder="City"
                      />
                      <Input
                        id="profile-state"
                        value={state}
                        onChange={(event) => setState(event.target.value)}
                        placeholder="State"
                      />
                      <Input
                        id="profile-zip"
                        value={zip}
                        onChange={(event) => setZip(event.target.value)}
                        placeholder="Zip"
                      />
                      <Input
                        id="profile-country"
                        value={country}
                        onChange={(event) => setCountry(event.target.value)}
                        placeholder="Country"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-full-name">
                      {isOrganization ? "Organization name" : "Group name"}
                    </Label>
                    <Input
                      id="profile-full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-phone">Phone</Label>
                      <Input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-primary-contact">Primary contact name</Label>
                    <Input
                      id="profile-primary-contact"
                      placeholder={
                        isGroup
                          ? "Leader or coordinator for this group"
                          : "Person we reach at this organization"
                      }
                      value={primaryContactName}
                      onChange={(event) => setPrimaryContactName(event.target.value)}
                    />
                  </div>
                  {!isGroup ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-address">Address</Label>
                      <div className="grid gap-2 sm:grid-cols-6">
                        <Input
                          id="profile-address"
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                          placeholder="Street"
                          className="sm:col-span-2"
                        />
                        <Input
                          id="profile-city"
                          value={city}
                          onChange={(event) => setCity(event.target.value)}
                          placeholder="City"
                        />
                        <Input
                          id="profile-state"
                          value={state}
                          onChange={(event) => setState(event.target.value)}
                          placeholder="State"
                        />
                        <Input
                          id="profile-zip"
                          value={zip}
                          onChange={(event) => setZip(event.target.value)}
                          placeholder="Zip"
                        />
                        <Input
                          id="profile-country"
                          value={country}
                          onChange={(event) => setCountry(event.target.value)}
                          placeholder="Country"
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="profile-notes">Notes</Label>
                <Textarea
                  id="profile-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-14 resize-none"
                  placeholder="Notes about this contact..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
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
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-full-name">
                    {isOrganization
                      ? "Organization name"
                      : contactType === "group"
                        ? "Group name"
                        : "Full name"}
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
                <div className="space-y-2 sm:max-w-xs">
                  <Label htmlFor="profile-contact-type">Record type</Label>
                  <Select
                    value={contactType}
                    onValueChange={(value) => setContactType(value as ContactRecordType)}
                  >
                    <SelectTrigger id="profile-contact-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Person</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isEntity ? (
                  <div className="space-y-2">
                    <Label htmlFor="profile-primary-contact">Primary contact name</Label>
                    <Input
                      id="profile-primary-contact"
                      placeholder={
                        contactType === "group"
                          ? "Leader or coordinator for this group"
                          : "Person we reach at this organization"
                      }
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
              </div>

              {!isEntity ? (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-dob">Date of birth</Label>
                      <BirthDateInput
                        id="profile-dob"
                        value={dateOfBirth}
                        onChange={setDateOfBirth}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-gender">Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger id="profile-gender">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : null}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="profile-notes">Bio / notes</Label>
                <Textarea
                  id="profile-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-20 resize-none"
                  placeholder="Notes about this contact..."
                />
              </div>

              <Separator />

              {!isGroup ? (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="h-4 w-4" />
                    Address
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="profile-address">Street address</Label>
                    <Input
                      id="profile-address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-city">City</Label>
                      <Input
                        id="profile-city"
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-state">State</Label>
                      <Input
                        id="profile-state"
                        value={state}
                        onChange={(event) => setState(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-zip">Zip code</Label>
                      <Input
                        id="profile-zip"
                        value={zip}
                        onChange={(event) => setZip(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-country">Country</Label>
                      <Input
                        id="profile-country"
                        value={country}
                        onChange={(event) => setCountry(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

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
          )
        ) : isOverviewGeneral ? (
          <div className="space-y-3 text-sm">
            {!isEntity ? (
              <>
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Full name</dt>
                    <dd>{contact.full_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Date of birth</dt>
                    <dd>{formatDate(personDetails?.dateOfBirth)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Gender</dt>
                    <dd>{personDetails?.gender || "—"}</dd>
                  </div>
                </dl>
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Phone</dt>
                    <dd>{contact.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                    <dd>{contact.email || "—"}</dd>
                  </div>
                </dl>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Address
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{formatAddress(contact)}</dd>
                </div>
              </>
            ) : (
              <>
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {isOrganization ? "Organization name" : "Group name"}
                    </dt>
                    <dd>{contact.full_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Phone</dt>
                    <dd>{contact.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                    <dd>{contact.email || "—"}</dd>
                  </div>
                  {contact.primary_contact_name ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-muted-foreground">Primary contact</dt>
                      <dd>{contact.primary_contact_name}</dd>
                    </div>
                  ) : null}
                </dl>
                {!isGroup ? (
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Address
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{formatAddress(contact)}</dd>
                  </div>
                ) : null}
              </>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Notes</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{contact.notes || "—"}</dd>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-muted-foreground">Record type</dt>
                <dd>{getContactRecordTypeLabel(contactType)}</dd>
              </div>
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
                <dd>{mapStatus(contact.status)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Created</dt>
                <dd>{formatDate(contact.created_at)}</dd>
              </div>
              {isEntity && contact.primary_contact_name ? (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-muted-foreground">Primary contact</dt>
                  <dd>{contact.primary_contact_name}</dd>
                </div>
              ) : null}
              {!isEntity ? (
                <>
                  <div>
                    <dt className="font-medium text-muted-foreground">Date of birth</dt>
                    <dd>{formatDate(personDetails?.dateOfBirth)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Gender</dt>
                    <dd>{personDetails?.gender || "—"}</dd>
                  </div>
                </>
              ) : null}
            </dl>

            <div>
              <dt className="mb-1 font-medium text-muted-foreground">Bio / notes</dt>
              <dd className="whitespace-pre-wrap">{contact.notes || "—"}</dd>
            </div>

            {!isGroup ? (
              <div>
                <dt className="mb-1 flex items-center gap-2 font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Address
                </dt>
                <dd className="whitespace-pre-wrap">{formatAddress(contact)}</dd>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
