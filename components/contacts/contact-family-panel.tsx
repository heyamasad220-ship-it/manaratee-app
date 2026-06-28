"use client"

import { useState, useTransition } from "react"
import { Loader2, Trash2, UserPlus, Users } from "lucide-react"

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
import {
  addContactFamilyMember,
  removeContactFamilyMember,
  type ContactFamilyMemberRow,
} from "@/lib/contacts/contact-profile-admin-actions"

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

export function ContactFamilyPanel({
  contactId,
  familyMembers,
  onChanged,
  embedded = false,
}: ContactFamilyPanelProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    relationship: "",
  })

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
          relationship: newMember.relationship,
        })
        setNewMember({
          firstName: "",
          lastName: "",
          gender: "",
          dateOfBirth: "",
          relationship: "",
        })
        setIsAddDialogOpen(false)
        await onChanged()
      } catch (addError) {
        setError(
          addError instanceof Error ? addError.message : "Could not add family member."
        )
      }
    })
  }

  function handleRemoveMember(relatedPersonId: string) {
    if (!window.confirm("Remove this family member from the contact profile?")) {
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await removeContactFamilyMember({ contactId, relatedPersonId })
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
                Linked family members for registrations and program enrollments.
              </CardDescription>
            </div>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add member
          </Button>
        </CardHeader>
        <CardContent className={embedded ? "pt-0" : undefined}>
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {familyMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No family members added</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add family members to register them for events and activities.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add family member
              </Button>
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
                          <span className="text-sm font-medium">
                            {member.firstName} {member.lastName}
                          </span>
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
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add family member</DialogTitle>
            <DialogDescription>
              Creates a linked person record and contact for program registration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
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
                  <SelectItem value="child">Child / Grandchild</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
