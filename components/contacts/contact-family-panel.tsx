"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, Pencil, Trash2, UserPlus, Users } from "lucide-react"

import { FamilyContactPicker } from "@/components/contacts/family-contact-picker"
import { FamilySettingsPanel } from "@/components/contacts/family-settings-panel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BirthDateInput } from "@/components/ui/birth-date-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  addContactFamilyMember,
  removeContactFamilyMember,
  updateContactFamilyMember,
  type ContactFamilyMemberRow,
} from "@/lib/contacts/contact-profile-admin-actions"
import {
  getFamilyForContactAction,
  linkExistingContactToFamilyAction,
} from "@/lib/contacts/family-management-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { useCurrentReturnTo } from "@/hooks/use-current-return-to"

type ContactFamilyPanelProps = {
  contactId: string
  familyMembers: ContactFamilyMemberRow[]
  onChanged: () => Promise<void>
  embedded?: boolean
}

function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return null

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function formatRelationship(value: string) {
  const labels: Record<string, string> = {
    child: "Child / Grandchild",
    guardian: "Guardian",
    spouse: "Spouse",
    parent: "Parent",
    sibling: "Sibling",
    other: "Other",
  }

  return labels[value] || value
}

const relationshipOptions = [
  { value: "child", label: "Child / Grandchild" },
  { value: "guardian", label: "Guardian" },
  { value: "spouse", label: "Spouse" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
]

export function ContactFamilyPanel({
  contactId,
  familyMembers,
  onChanged,
  embedded = false,
}: ContactFamilyPanelProps) {
  const currentReturnTo = useCurrentReturnTo()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<ContactFamilyMemberRow | null>(null)
  const [addMode, setAddMode] = useState<"create" | "link">("link")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [household, setHousehold] = useState<{
    id: string
    name: string
    primaryContactId: string | null
    primaryName: string | null
    isPrimary: boolean
  } | null>(null)
  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    relationship: "",
  })
  const [editMember, setEditMember] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    relationship: "",
    grade: "",
    allergies: "",
    emergencyContact: "",
    photoConsent: "",
  })
  const [linkMember, setLinkMember] = useState({
    contactId: "",
    contactLabel: "",
    relationship: "spouse",
  })

  useEffect(() => {
    let cancelled = false

    async function loadHousehold() {
      const result = await getFamilyForContactAction(contactId)
      if (cancelled || !result.success) return
      setHousehold(result.family)
    }

    void loadHousehold()

    return () => {
      cancelled = true
    }
  }, [contactId, familyMembers.length])

  function resetDialogState() {
    setNewMember({
      firstName: "",
      lastName: "",
      gender: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      relationship: "",
    })
    setLinkMember({
      contactId: "",
      contactLabel: "",
      relationship: "spouse",
    })
    setAddMode("link")
    setError(null)
  }

  function handleAddMember() {
    setError(null)
    startTransition(async () => {
      try {
        await addContactFamilyMember({
          contactId,
          firstName: newMember.firstName,
          lastName: newMember.lastName,
          gender: newMember.gender || null,
          dateOfBirth: newMember.dateOfBirth || null,
          email: newMember.email || null,
          phone: newMember.phone || null,
          relationship: newMember.relationship,
        })
        resetDialogState()
        setIsAddDialogOpen(false)
        await onChanged()
        const familyResult = await getFamilyForContactAction(contactId)
        if (familyResult.success) {
          setHousehold(familyResult.family)
        }
      } catch (addError) {
        setError(
          addError instanceof Error ? addError.message : "Could not add family member."
        )
      }
    })
  }

  function handleLinkExistingMember() {
    if (!linkMember.contactId) {
      setError("Select an existing contact to link.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await linkExistingContactToFamilyAction({
        anchorContactId: contactId,
        memberContactId: linkMember.contactId,
        relationship: linkMember.relationship,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      resetDialogState()
      setIsAddDialogOpen(false)
      await onChanged()
      const familyResult = await getFamilyForContactAction(contactId)
      if (familyResult.success) {
        setHousehold(familyResult.family)
      }
    })
  }

  function openEditMember(member: ContactFamilyMemberRow) {
    setError(null)
    setEditingMember(member)
    setEditMember({
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      gender: member.gender || "",
      dateOfBirth: member.dateOfBirth || "",
      email: member.email || "",
      phone: member.phone || "",
      relationship: member.relationship || "",
      grade: member.grade || "",
      allergies: member.allergies || "",
      emergencyContact: member.emergencyContact || "",
      photoConsent: member.photoConsent || "",
    })
  }

  function handleEditMember() {
    if (!editingMember) return

    setError(null)
    startTransition(async () => {
      try {
        await updateContactFamilyMember({
          contactId,
          relatedPersonId: editingMember.id,
          firstName: editMember.firstName,
          lastName: editMember.lastName,
          gender: editMember.gender || null,
          dateOfBirth: editMember.dateOfBirth || null,
          email: editMember.email || null,
          phone: editMember.phone || null,
          relationship: editMember.relationship,
          grade: editMember.grade || null,
          allergies: editMember.allergies || null,
          emergencyContact: editMember.emergencyContact || null,
          photoConsent: editMember.photoConsent || null,
        })
        setEditingMember(null)
        await onChanged()
        const familyResult = await getFamilyForContactAction(contactId)
        if (familyResult.success) {
          setHousehold(familyResult.family)
        }
      } catch (editError) {
        setError(
          editError instanceof Error ? editError.message : "Could not update family member."
        )
      }
    })
  }

  function handleRemoveMember(member: ContactFamilyMemberRow) {
    const memberName = `${member.firstName} ${member.lastName}`.trim() || "this family member"
    const message = member.contactId
      ? [
          `Remove ${memberName} from this household?`,
          "",
          "Their individual contact profile and all donations will stay on their record.",
          "They will no longer appear in this household's giving totals.",
        ].join("\n")
      : `Remove ${memberName} from this household?`

    if (!window.confirm(message)) {
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await removeContactFamilyMember({ contactId, relatedPersonId: member.id })
        await onChanged()
      } catch (removeError) {
        setError(
          removeError instanceof Error ? removeError.message : "Could not remove family member."
        )
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader
          className={
            embedded
              ? "flex flex-row items-center justify-end space-y-0 pb-2 pt-4"
              : "flex flex-row items-center justify-between space-y-0"
          }
        >
          {!embedded ? (
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Family members
              </CardTitle>
              <CardDescription>
                Household extension of this contact. Link a spouse or dependents here — they share
                one household. Donations and other activity stay on each adult contact.
              </CardDescription>
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetDialogState()
              setIsAddDialogOpen(true)
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Family Member
          </Button>
        </CardHeader>
        <CardContent className={embedded ? "pt-0" : undefined}>
          {household ? (
            <div className="mb-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Household: </span>
                  <span className="font-medium">{household.name}</span>
                  {!household.isPrimary ? (
                    <span className="ml-2 text-xs text-muted-foreground">(member)</span>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground">(primary)</span>
                  )}
                </div>
                {!household.isPrimary && household.primaryContactId ? (
                  <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                    <Link
                      href={contactProfileHref(household.primaryContactId, {
                        returnTo: currentReturnTo,
                        list: "families",
                      })}
                    >
                      Open primary
                      {household.primaryName ? `: ${household.primaryName}` : " contact"}
                    </Link>
                  </Button>
                ) : null}
              </div>
              {household.isPrimary ? (
                <FamilySettingsPanel
                  familyId={household.id}
                  canManage
                  embedded
                  onSaved={async () => {
                    const familyResult = await getFamilyForContactAction(contactId)
                    if (familyResult.success) {
                      setHousehold(familyResult.family)
                    }
                    await onChanged()
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {familyMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No family members added</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Link an existing contact who already has a profile, or create a new person for this
                household without opening a separate contact page.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {familyMembers.map((member) => {
                const age = calculateAge(member.dateOfBirth)
                const isMinor = age !== null && age < 18

                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between rounded-lg border border-border bg-muted/30${embedded ? " p-3" : " p-4"}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border border-border">
                        <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                          {member.firstName[0]}
                          {member.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {member.contactId && !isMinor ? (
                            <Link
                              href={contactProfileHref(member.contactId, {
                                returnTo: currentReturnTo,
                              })}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {member.firstName} {member.lastName}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium">
                              {member.firstName} {member.lastName}
                            </span>
                          )}
                          {isMinor ? (
                            <Badge variant="secondary" className="text-xs">
                              Minor
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatRelationship(member.relationship)}</span>
                          {member.gender ? (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{member.gender}</span>
                            </>
                          ) : null}
                          {age !== null ? (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{age} years old</span>
                            </>
                          ) : null}
                          {member.allergies ? (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>Allergies: {member.allergies}</span>
                            </>
                          ) : null}
                          {member.email ? (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{member.email}</span>
                            </>
                          ) : null}
                          {member.phone ? (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{member.phone}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => openEditMember(member)}
                        disabled={isPending}
                        aria-label={`Edit ${member.firstName} ${member.lastName}`.trim()}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(member)}
                        disabled={isPending}
                        aria-label={`Remove ${member.firstName} ${member.lastName}`.trim()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) resetDialogState()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add family member</DialogTitle>
            <DialogDescription>
              Link an existing contact who already has a profile, or create a new person for this
              household only (no separate contact page until you link one later).
            </DialogDescription>
          </DialogHeader>

          <Tabs value={addMode} onValueChange={(value) => setAddMode(value as "create" | "link")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link">Link existing contact</TabsTrigger>
              <TabsTrigger value="create">Create new person</TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="mt-4 space-y-4">
              <FamilyContactPicker
                selectedContactId={linkMember.contactId || null}
                selectedLabel={linkMember.contactLabel}
                excludeContactId={contactId}
                disabled={isPending}
                onChange={(memberContactId, label) =>
                  setLinkMember((current) => ({
                    ...current,
                    contactId: memberContactId,
                    contactLabel: label,
                  }))
                }
              />
              <div className="space-y-2">
                <Label htmlFor="link-family-relationship">Relationship</Label>
                <Select
                  value={linkMember.relationship}
                  onValueChange={(value) =>
                    setLinkMember((current) => ({ ...current, relationship: value }))
                  }
                >
                  <SelectTrigger id="link-family-relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this to join spouses who were imported as separate contacts into one household.
                Donations and other activity stay on each contact.
              </p>
            </TabsContent>

            <TabsContent value="create" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="family-first-name">First name</Label>
                  <Input
                    id="family-first-name"
                    value={newMember.firstName}
                    onChange={(event) =>
                      setNewMember((current) => ({ ...current, firstName: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="family-last-name">Last name</Label>
                  <Input
                    id="family-last-name"
                    value={newMember.lastName}
                    onChange={(event) =>
                      setNewMember((current) => ({ ...current, lastName: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="family-email">Email</Label>
                  <Input
                    id="family-email"
                    type="email"
                    placeholder="Optional"
                    value={newMember.email}
                    onChange={(event) =>
                      setNewMember((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="family-phone">Phone</Label>
                  <Input
                    id="family-phone"
                    type="tel"
                    placeholder="Optional"
                    value={newMember.phone}
                    onChange={(event) =>
                      setNewMember((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="family-dob">Date of birth</Label>
                  <BirthDateInput
                    id="family-dob"
                    value={newMember.dateOfBirth}
                    onChange={(value) =>
                      setNewMember((current) => ({ ...current, dateOfBirth: value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="family-gender">Gender</Label>
                  <Select
                    value={newMember.gender}
                    onValueChange={(value) =>
                      setNewMember((current) => ({ ...current, gender: value }))
                    }
                  >
                    <SelectTrigger id="family-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="family-relationship">Relationship</Label>
                <Select
                  value={newMember.relationship}
                  onValueChange={(value) =>
                    setNewMember((current) => ({ ...current, relationship: value }))
                  }
                >
                  <SelectTrigger id="family-relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            {addMode === "link" ? (
              <Button onClick={handleLinkExistingMember} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  "Link contact"
                )}
              </Button>
            ) : (
              <Button onClick={handleAddMember} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Create member"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMember(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit family member</DialogTitle>
            <DialogDescription>
              Update this household member’s details
              {editingMember?.contactId
                ? ". Changes also update their linked contact profile."
                : " without creating a separate contact page."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-family-first-name">First name</Label>
                <Input
                  id="edit-family-first-name"
                  value={editMember.firstName}
                  onChange={(event) =>
                    setEditMember((current) => ({ ...current, firstName: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-family-last-name">Last name</Label>
                <Input
                  id="edit-family-last-name"
                  value={editMember.lastName}
                  onChange={(event) =>
                    setEditMember((current) => ({ ...current, lastName: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-family-email">Email</Label>
                <Input
                  id="edit-family-email"
                  type="email"
                  placeholder="Optional"
                  value={editMember.email}
                  onChange={(event) =>
                    setEditMember((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-family-phone">Phone</Label>
                <Input
                  id="edit-family-phone"
                  type="tel"
                  placeholder="Optional"
                  value={editMember.phone}
                  onChange={(event) =>
                    setEditMember((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-family-dob">Date of birth</Label>
                <BirthDateInput
                  id="edit-family-dob"
                  value={editMember.dateOfBirth}
                  onChange={(value) =>
                    setEditMember((current) => ({ ...current, dateOfBirth: value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-family-gender">Gender</Label>
                <Select
                  value={editMember.gender || undefined}
                  onValueChange={(value) =>
                    setEditMember((current) => ({ ...current, gender: value }))
                  }
                >
                  <SelectTrigger id="edit-family-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-family-relationship">Relationship</Label>
              <Select
                value={editMember.relationship || undefined}
                onValueChange={(value) =>
                  setEditMember((current) => ({ ...current, relationship: value }))
                }
              >
                <SelectTrigger id="edit-family-relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {relationshipOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-family-grade">Grade</Label>
                <Input
                  id="edit-family-grade"
                  value={editMember.grade}
                  onChange={(event) =>
                    setEditMember((current) => ({
                      ...current,
                      grade: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-family-photo-consent">Photo consent</Label>
                <Select
                  value={editMember.photoConsent || undefined}
                  onValueChange={(value) =>
                    setEditMember((current) => ({
                      ...current,
                      photoConsent: value,
                    }))
                  }
                >
                  <SelectTrigger id="edit-family-photo-consent">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-family-allergies">Allergies</Label>
              <Input
                id="edit-family-allergies"
                value={editMember.allergies}
                onChange={(event) =>
                  setEditMember((current) => ({
                    ...current,
                    allergies: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-family-emergency">Emergency contact</Label>
              <Input
                id="edit-family-emergency"
                value={editMember.emergencyContact}
                onChange={(event) =>
                  setEditMember((current) => ({
                    ...current,
                    emergencyContact: event.target.value,
                  }))
                }
                placeholder="Name and phone"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingMember(null)
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEditMember} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
