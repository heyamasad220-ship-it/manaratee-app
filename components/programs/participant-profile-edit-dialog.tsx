"use client"

import { useMemo, useState, useTransition } from "react"
import { Loader2, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"

import { BirthDateInput } from "@/components/ui/birth-date-input"
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
import { calculateAgeFromDateOfBirth } from "@/lib/programs/registration-report-helpers"
import { updateParticipantDetailsAction } from "@/lib/programs/participant-profile-actions"
import type { ParticipantProfileData } from "@/lib/programs/participant-profile-queries"

function splitDisplayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

export function ParticipantProfileEditButton({
  data,
}: {
  data: ParticipantProfileData
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const initialNames = splitDisplayName(data.fullName)
  const [firstName, setFirstName] = useState(initialNames.firstName)
  const [lastName, setLastName] = useState(initialNames.lastName)
  const [dateOfBirth, setDateOfBirth] = useState(
    toDateInputValue(data.dateOfBirth)
  )
  const [gender, setGender] = useState(
    data.gender
      ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1).toLowerCase()
      : ""
  )
  const [grade, setGrade] = useState(data.grade || "")
  const [allergies, setAllergies] = useState(data.allergies || "")
  const [photoConsent, setPhotoConsent] = useState(data.photoConsent || "")
  const [emergencyContact, setEmergencyContact] = useState(
    data.emergencyContact || ""
  )

  const agePreview = useMemo(
    () => calculateAgeFromDateOfBirth(dateOfBirth || null),
    [dateOfBirth]
  )

  function resetFromData() {
    const names = splitDisplayName(data.fullName)
    setFirstName(names.firstName)
    setLastName(names.lastName)
    setDateOfBirth(toDateInputValue(data.dateOfBirth))
    setGender(
      data.gender
        ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1).toLowerCase()
        : ""
    )
    setGrade(data.grade || "")
    setAllergies(data.allergies || "")
    setPhotoConsent(data.photoConsent || "")
    setEmergencyContact(data.emergencyContact || "")
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) resetFromData()
    if (!next) setError(null)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateParticipantDetailsAction({
        personId: data.personId,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
        grade: grade || null,
        allergies: allergies || null,
        photoConsent: photoConsent || null,
        emergencyContact: emergencyContact || null,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <Pencil className="mr-1.5 h-4 w-4" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit participant</DialogTitle>
            <DialogDescription>
              Updates this person record and syncs allergies, photo consent, and
              emergency contact to their enrollments and contact family profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="participant-first-name">First name</Label>
                <Input
                  id="participant-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="participant-last-name">Last name</Label>
                <Input
                  id="participant-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="participant-dob">Date of birth</Label>
                <BirthDateInput
                  id="participant-dob"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input
                  value={agePreview != null ? String(agePreview) : "—"}
                  readOnly
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Calculated from date of birth
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="participant-gender">Gender</Label>
                <Select
                  value={gender || undefined}
                  onValueChange={setGender}
                >
                  <SelectTrigger id="participant-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="participant-grade">Grade</Label>
                <Input
                  id="participant-grade"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="participant-allergies">Allergies</Label>
              <Input
                id="participant-allergies"
                value={allergies}
                onChange={(event) => setAllergies(event.target.value)}
                placeholder="e.g. Peanuts"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="participant-photo-consent">Photo consent</Label>
              <Select
                value={photoConsent || undefined}
                onValueChange={setPhotoConsent}
              >
                <SelectTrigger id="participant-photo-consent">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="participant-emergency">Emergency contact</Label>
              <Input
                id="participant-emergency"
                value={emergencyContact}
                onChange={(event) => setEmergencyContact(event.target.value)}
                placeholder="Name and phone"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
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
