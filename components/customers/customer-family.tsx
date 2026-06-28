"use client"

import { useState } from "react"
import {
  Pencil,
  X,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BirthDateInput } from "@/components/ui/birth-date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface FamilyMember {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  relationship: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

const MINOR_AGE = 18

function getAge(dateOfBirth: string): number {
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function isMinor(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false
  return getAge(dateOfBirth) < MINOR_AGE
}

const emptyMember: Omit<FamilyMember, "id"> = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  relationship: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
}

const initialFamily: FamilyMember[] = [
  {
    id: "1",
    firstName: "Michael",
    lastName: "Johnson",
    dateOfBirth: "1988-08-22",
    gender: "Male",
    relationship: "Spouse",
    phone: "+1 (555) 345-6789",
    email: "michael.johnson@email.com",
    addressLine1: "1234 Ocean Drive",
    addressLine2: "Apt 12B",
    city: "Miami",
    state: "FL",
    zipCode: "33139",
    country: "United States",
  },
  {
    id: "2",
    firstName: "Emma",
    lastName: "Johnson",
    dateOfBirth: "2015-02-10",
    gender: "Female",
    relationship: "Daughter",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  },
]

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {type === "date" ? (
        <BirthDateInput value={value} onChange={onChange} className="h-9" />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9"
        />
      )}
    </div>
  )
}

function GenderSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-muted-foreground">Gender</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select gender" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Male">Male</SelectItem>
          <SelectItem value="Female">Female</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

function RelationshipSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-muted-foreground">Relationship</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select relationship" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Spouse">Spouse</SelectItem>
          <SelectItem value="Partner">Partner</SelectItem>
          <SelectItem value="Son">Son</SelectItem>
          <SelectItem value="Daughter">Daughter</SelectItem>
          <SelectItem value="Parent">Parent</SelectItem>
          <SelectItem value="Sibling">Sibling</SelectItem>
          <SelectItem value="Guardian">Guardian</SelectItem>
          <SelectItem value="Other">Other</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-0">
      <span className="w-40 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: FamilyMember
  onEdit: (member: FamilyMember) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const minor = isMinor(member.dateOfBirth)
  const initials = `${member.firstName[0] || ""}${member.lastName[0] || ""}`
  const fullName = `${member.firstName} ${member.lastName}`
  const age = member.dateOfBirth ? getAge(member.dateOfBirth) : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 border border-border">
              <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {fullName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {member.relationship}
                </Badge>
                {minor && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-xs text-amber-700 hover:bg-amber-100"
                  >
                    Minor
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {age !== null ? `Age ${age}` : ""}{" "}
                {member.gender ? `\u00B7 ${member.gender}` : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onEdit(member)}
            >
              <Pencil className="size-3.5" />
              <span className="sr-only">Edit {fullName}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(member.id)}
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only">Delete {fullName}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              <span className="sr-only">
                {expanded ? "Collapse" : "Expand"} details
              </span>
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="flex flex-col gap-3 pt-0">
          <Separator />
          <InfoRow
            label="Date of Birth"
            value={
              member.dateOfBirth
                ? new Date(member.dateOfBirth).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : ""
            }
          />
          <InfoRow label="Gender" value={member.gender} />

          {!minor && (
            <>
              {(member.phone || member.email) && <Separator />}
              <InfoRow label="Phone" value={member.phone} />
              <InfoRow label="Email" value={member.email} />

              {(member.addressLine1 || member.city) && <Separator />}
              <InfoRow label="Address Line 1" value={member.addressLine1} />
              <InfoRow label="Address Line 2" value={member.addressLine2} />
              <InfoRow label="City" value={member.city} />
              <InfoRow label="State" value={member.state} />
              <InfoRow label="Zip Code" value={member.zipCode} />
              <InfoRow label="Country" value={member.country} />
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function CustomerFamily() {
  const [members, setMembers] = useState<FamilyMember[]>(initialFamily)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [formData, setFormData] = useState<Omit<FamilyMember, "id">>(emptyMember)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const memberIsMinor = isMinor(formData.dateOfBirth)

  function openAddDialog() {
    setEditingMember(null)
    setFormData({ ...emptyMember })
    setDialogOpen(true)
  }

  function openEditDialog(member: FamilyMember) {
    setEditingMember(member)
    const { id, ...rest } = member
    setFormData({ ...rest })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!formData.firstName || !formData.lastName) return

    const savedData = { ...formData }

    // Clear contact/address fields for minors
    if (isMinor(savedData.dateOfBirth)) {
      savedData.phone = ""
      savedData.email = ""
      savedData.addressLine1 = ""
      savedData.addressLine2 = ""
      savedData.city = ""
      savedData.state = ""
      savedData.zipCode = ""
      savedData.country = ""
    }

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id ? { ...savedData, id: m.id } : m
        )
      )
    } else {
      setMembers((prev) => [
        ...prev,
        { ...savedData, id: crypto.randomUUID() },
      ])
    }
    setDialogOpen(false)
  }

  function handleDelete() {
    if (deleteId) {
      setMembers((prev) => prev.filter((m) => m.id !== deleteId))
      setDeleteId(null)
    }
  }

  function updateField(field: keyof Omit<FamilyMember, "id">, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Family Members
          </h2>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""} in
            household
          </p>
        </div>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="mr-1.5 size-4" />
          Add Member
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                No family members added yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={openAddDialog}
              >
                <Plus className="mr-1.5 size-4" />
                Add First Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={openEditDialog}
              onDelete={(id) => setDeleteId(id)}
            />
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit Family Member" : "Add Family Member"}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? "Update the details for this family member."
                : "Enter the details for the new family member."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-4">
            {/* Personal Info */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-medium text-foreground">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="First Name"
                  value={formData.firstName}
                  onChange={(v) => updateField("firstName", v)}
                  placeholder="First name"
                />
                <FormField
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(v) => updateField("lastName", v)}
                  placeholder="Last name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Date of Birth"
                  value={formData.dateOfBirth}
                  onChange={(v) => updateField("dateOfBirth", v)}
                  type="date"
                />
                <GenderSelect
                  value={formData.gender}
                  onChange={(v) => updateField("gender", v)}
                />
              </div>
              <RelationshipSelect
                value={formData.relationship}
                onChange={(v) => updateField("relationship", v)}
              />
            </div>

            {memberIsMinor && formData.dateOfBirth && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700">
                  This family member is under {MINOR_AGE}. Contact and address
                  fields are not collected for minors.
                </p>
              </div>
            )}

            {/* Contact Info -- only for adults */}
            {!memberIsMinor && (
              <>
                <Separator />
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium text-foreground">
                    Contact Information
                  </h3>
                  <FormField
                    label="Phone"
                    value={formData.phone}
                    onChange={(v) => updateField("phone", v)}
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                  />
                  <FormField
                    label="Email"
                    value={formData.email}
                    onChange={(v) => updateField("email", v)}
                    type="email"
                    placeholder="email@example.com"
                  />
                </div>

                <Separator />

                {/* Address */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium text-foreground">
                    Address
                  </h3>
                  <FormField
                    label="Address Line 1"
                    value={formData.addressLine1}
                    onChange={(v) => updateField("addressLine1", v)}
                    placeholder="Street address"
                  />
                  <FormField
                    label="Address Line 2"
                    value={formData.addressLine2}
                    onChange={(v) => updateField("addressLine2", v)}
                    placeholder="Apt, suite, unit, etc."
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="City"
                      value={formData.city}
                      onChange={(v) => updateField("city", v)}
                      placeholder="City"
                    />
                    <FormField
                      label="State"
                      value={formData.state}
                      onChange={(v) => updateField("state", v)}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Zip Code"
                      value={formData.zipCode}
                      onChange={(v) => updateField("zipCode", v)}
                      placeholder="Zip code"
                    />
                    <FormField
                      label="Country"
                      value={formData.country}
                      onChange={(v) => updateField("country", v)}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="mr-1.5 size-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.firstName || !formData.lastName}
            >
              <Check className="mr-1.5 size-4" />
              {editingMember ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Family Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this family member? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
