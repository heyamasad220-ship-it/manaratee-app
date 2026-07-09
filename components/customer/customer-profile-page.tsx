"use client"

import { useEffect, useState, type ElementType } from "react"
import { format, parseISO } from "date-fns"
import {
  Pencil,
  X,
  Check,
  MapPin,
  Shield,
  Store,
  Heart,
  Baby,
  Users,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  UserPlus,
  Trash2,
  HandCoins,
  Briefcase,
  Lock,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  addCustomerFamilyMember,
  loadCustomerFamilyMembers,
  removeCustomerFamilyMember,
} from "@/lib/customer/customer-family-actions"
import { loadCustomerProfilePortalData } from "@/lib/customer/customer-portal-data-actions"
import {
  createDefaultCustomerNotificationSettings,
  type CustomerNotificationPreferenceKey,
  type CustomerNotificationSettings,
} from "@/lib/customer/customer-notification-preferences"
import { CustomerNotificationPreferencesPanel } from "@/components/customer/customer-notification-preferences-panel"
import {
  type CustomerProfileSection,
  customerProfileSectionTitle,
} from "@/lib/customer/customer-profile-nav"
import { ContactPaymentMethodsPanel } from "@/components/contacts/contact-payment-methods-panel"
import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BirthDateInput } from "@/components/ui/birth-date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type CustomerProfilePageProps = {
  section: CustomerProfileSection
}

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  bio: string
  preferredLanguage: string
  memberSince: string
}

const emptyProfile: ProfileData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  bio: "",
  preferredLanguage: "English",
  memberSince: new Date().toISOString(),
}

interface FamilyMember {
  id: string
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  relationship: string
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

type ApplicationStatus = "Pending" | "Under Review" | "Approved" | "Rejected"

type ApplicationType = {
  id: string
  name: string
  description: string
  icon: string
  isActive: boolean
  requirements: string[]
}

type UserApplication = {
  id: string
  applicationTypeId: string
  applicationTypeName: string
  status: ApplicationStatus
  submittedAt: string
}

const applicationTypes: ApplicationType[] = []

const iconMap: Record<string, ElementType> = {
  Store,
  Heart,
  Baby,
  Users,
  HandCoins,
  Briefcase,
}

const statusStyles: Record<ApplicationStatus, { variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  Pending: { variant: "secondary", className: "bg-amber-100 text-amber-700" },
  "Under Review": { variant: "secondary", className: "bg-blue-100 text-blue-700" },
  Approved: { variant: "secondary", className: "bg-emerald-100 text-emerald-700" },
  Rejected: { variant: "destructive", className: "" },
}

function splitFullName(fullName: string | null | undefined) {
  const parts = (fullName || "").trim().split(" ").filter(Boolean)
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  }
}

function safeDate(value: string) {
  if (!value) return "—"
  try {
    return format(parseISO(value), "MMMM d, yyyy")
  } catch {
    return "—"
  }
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

export function CustomerProfilePage({ section }: CustomerProfilePageProps) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contactId, setContactId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData>(emptyProfile)
  const [editData, setEditData] = useState<ProfileData>(emptyProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingEmergency, setIsEditingEmergency] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [notifications, setNotifications] = useState<CustomerNotificationSettings>(
    createDefaultCustomerNotificationSettings()
  )
  const [enabledModuleSlugs, setEnabledModuleSlugs] = useState<string[]>([])

  const [userApplications, setUserApplications] = useState<UserApplication[]>([])
  const [selectedAppType, setSelectedAppType] = useState<ApplicationType | null>(null)
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false)
  const [isSubmittingApp, setIsSubmittingApp] = useState(false)
  const [applicationAnswers, setApplicationAnswers] = useState<Record<string, string>>({})

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [isAddFamilyDialogOpen, setIsAddFamilyDialogOpen] = useState(false)
  const [newFamilyMember, setNewFamilyMember] = useState<Omit<FamilyMember, "id">>({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    relationship: "",
  })
  const [paymentMethods, setPaymentMethods] = useState<ContactPaymentMethodRow[]>([])

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)

      const result = await loadCustomerProfilePortalData()

      if (!result.ok || !result.contact) {
        console.error("Customer profile load error:", result.ok ? "Contact not found" : result.error)
        setLoading(false)
        return
      }

      const data = result.contact
      const name = splitFullName(data.full_name)
      const loadedProfile: ProfileData = {
        firstName: name.firstName,
        lastName: name.lastName,
        email: data.email || result.accountEmail || "",
        phone: data.phone || "",
        dateOfBirth: "",
        gender: "",
        addressLine1: data.address || "",
        addressLine2: "",
        city: data.city || "",
        state: data.state || "",
        zipCode: data.zip || "",
        country: data.country || "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        emergencyContactRelation: "",
        bio: data.notes || "",
        preferredLanguage: "English",
        memberSince: data.created_at || new Date().toISOString(),
      }

      setContactId(data.id)
      setPersonId(data.person_id)
      setOrganizationId(data.organization_id)
      setProfile(loadedProfile)
      setEditData(loadedProfile)
      setFamilyMembers(result.familyMembers)
      setPaymentMethods(result.paymentMethods || [])
      setUserApplications([])
      setEnabledModuleSlugs(result.enabledModuleSlugs || [])
      setNotifications(createDefaultCustomerNotificationSettings())
      setLoading(false)
    }

    loadProfile()
  }, [])

  const availableApplicationTypes = applicationTypes.filter(
    (appType) => appType.isActive && !userApplications.some((ua) => ua.applicationTypeId === appType.id)
  )

  function handleEdit() {
    setEditData({ ...profile })
    setIsEditing(true)
  }

  function handleCancel() {
    setEditData({ ...profile })
    setIsEditing(false)
  }

  async function handleSave() {
    if (!contactId) return

    setSaving(true)

    const fullName = `${editData.firstName} ${editData.lastName}`.trim()

    const { error } = await supabase
      .from("contacts")
      .update({
        full_name: fullName || editData.email,
        email: editData.email || null,
        phone: editData.phone || null,
        address: editData.addressLine1 || null,
        city: editData.city || null,
        state: editData.state || null,
        zip: editData.zipCode || null,
        country: editData.country || null,
        notes: editData.bio || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId)

    if (error) {
      console.error("Customer profile save error:", error)
      setSaving(false)
      return
    }

    setProfile({ ...editData })
    setIsEditing(false)
    setSaving(false)
  }

  function handleChange(field: keyof ProfileData, value: string) {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  function handleNotificationChange(field: CustomerNotificationPreferenceKey, value: boolean) {
    setNotifications((prev) => ({ ...prev, [field]: value }))
  }

  async function handleChangePassword() {
    if (!profile.email) {
      alert("Add an email address to your profile before changing your password.")
      return
    }

    setChangingPassword(true)
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/forgot-password`,
    })
    setChangingPassword(false)

    if (error) {
      alert(error.message)
      return
    }

    alert("Check your email for a link to reset your password.")
  }

  function handleEditEmergency() {
    setEditData({ ...profile })
    setIsEditingEmergency(true)
  }

  function handleCancelEmergency() {
    setEditData({ ...profile })
    setIsEditingEmergency(false)
  }

  function handleSaveEmergency() {
    setProfile({ ...editData })
    setIsEditingEmergency(false)
  }

  async function loadFamilyMembers(parentPersonId: string) {
    if (!organizationId) return

    const members = await loadCustomerFamilyMembers({
      organizationId,
      parentPersonId,
    })

    setFamilyMembers(members)
  }

  async function refreshParentPersonId() {
    if (!organizationId) {
      return null
    }

    const result = await loadCustomerProfilePortalData()
    if (!result.ok || !result.contact) {
      return null
    }

    const nextPersonId = (result.contact.person_id as string | null) ?? null
    if (nextPersonId) {
      setPersonId(nextPersonId)
    }

    return nextPersonId
  }

  async function handleAddFamilyMember() {
    if (!organizationId) {
      alert("Missing organization context. Please refresh and try again.")
      return
    }

    setSaving(true)

    try {
      const activeParentPersonId = personId || (await refreshParentPersonId())

      if (!activeParentPersonId) {
        throw new Error(
          "Your profile is not fully linked yet. Save your profile and try again."
        )
      }

      await addCustomerFamilyMember({
        organizationId,
        parentPersonId: activeParentPersonId,
        firstName: newFamilyMember.firstName,
        lastName: newFamilyMember.lastName,
        gender: newFamilyMember.gender || null,
        dateOfBirth: newFamilyMember.dateOfBirth || null,
        relationship: newFamilyMember.relationship,
      })

      setNewFamilyMember({
        firstName: "",
        lastName: "",
        gender: "",
        dateOfBirth: "",
        relationship: "",
      })
      setIsAddFamilyDialogOpen(false)

      const refreshedParentPersonId =
        (await refreshParentPersonId()) || activeParentPersonId
      await loadFamilyMembers(refreshedParentPersonId)
    } catch (error) {
      console.error("Family member create error:", error)
      alert(
        error instanceof Error
          ? error.message
          : "Could not create family member."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveFamilyMember(id: string) {
    if (!personId || !organizationId) return

    try {
      await removeCustomerFamilyMember({
        organizationId,
        parentPersonId: personId,
        relatedPersonId: id,
      })
      await loadFamilyMembers(personId)
    } catch (error) {
      console.error("Family member remove error:", error)
      alert(
        error instanceof Error
          ? error.message
          : "Could not remove family member."
      )
    }
  }

  function openApplyDialog(appType: ApplicationType) {
    setSelectedAppType(appType)
    setApplicationAnswers({})
    setIsApplyDialogOpen(true)
  }

  function handleApplicationAnswerChange(requirement: string, value: string) {
    setApplicationAnswers((prev) => ({ ...prev, [requirement]: value }))
  }

  function handleSubmitApplication() {
    if (!selectedAppType) return
    setIsSubmittingApp(true)

    const newApplication: UserApplication = {
      id: `ua-${Date.now()}`,
      applicationTypeId: selectedAppType.id,
      applicationTypeName: selectedAppType.name,
      status: "Pending",
      submittedAt: new Date().toISOString(),
    }

    setUserApplications((prev) => [...prev, newApplication])
    setIsSubmittingApp(false)
    setIsApplyDialogOpen(false)
    setSelectedAppType(null)
    setApplicationAnswers({})
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
          {section === "personal" && !isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </div>
        {section !== "personal" ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {customerProfileSectionTitle(section)}
          </p>
        ) : null}
      </div>

      {section === "personal" ? (
      <div className="flex flex-col gap-6">
      {contactId ? (
        <ContactPaymentMethodsPanel
          contactId={contactId}
          paymentMethods={paymentMethods}
          portal="customer"
        />
      ) : null}

      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Lock className="h-4 w-4" />
            Password
          </CardTitle>
          <CardDescription>Update your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? "Sending..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
      </div>
      ) : null}

      {section === "family" ? (
      <div className="flex flex-col gap-6">
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold"><Users className="h-4 w-4" />Family Members</CardTitle>
          <CardDescription>Manage family members under your account. Children under 18 must be added here.</CardDescription>
        </CardHeader>
        <CardContent>
          {familyMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No family members added</p>
              <p className="mt-1 text-xs text-muted-foreground">Add family members to register them for events and activities.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddFamilyDialogOpen(true)}><UserPlus className="mr-1.5 h-4 w-4" />Add Family Member</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {familyMembers.map((member) => {
                const age = calculateAge(member.dateOfBirth)
                const isMinor = age < 18
                return (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border border-border"><AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">{member.firstName[0]}{member.lastName[0]}</AvatarFallback></Avatar>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground">{member.firstName} {member.lastName}</span>{isMinor && <Badge variant="secondary" className="text-xs">Minor</Badge>}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{formatRelationship(member.relationship)}</span><span className="text-muted-foreground/50">|</span><span>{member.gender}</span><span className="text-muted-foreground/50">|</span><span>{age} years old</span></div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveFamilyMember(member.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )
              })}
              <Button
                variant="outline"
                size="sm"
                className="mt-1 w-fit"
                onClick={() => setIsAddFamilyDialogOpen(true)}
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Add Family Member
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Shield className="h-4 w-4" />
              Emergency Contact
            </CardTitle>
            <CardDescription>Someone we can contact in case of an emergency.</CardDescription>
          </div>
          {isEditingEmergency ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancelEmergency}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEmergency}>
                <Check className="mr-1.5 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleEditEmergency}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Contact Name</Label>
              {isEditingEmergency ? (
                <Input
                  value={editData.emergencyContactName}
                  onChange={(e) => handleChange("emergencyContactName", e.target.value)}
                  className="h-9"
                />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {profile.emergencyContactName || "—"}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Contact Phone</Label>
              {isEditingEmergency ? (
                <Input
                  type="tel"
                  value={editData.emergencyContactPhone}
                  onChange={(e) => handleChange("emergencyContactPhone", e.target.value)}
                  className="h-9"
                />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {profile.emergencyContactPhone || "—"}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Relationship</Label>
              {isEditingEmergency ? (
                <Select
                  value={editData.emergencyContactRelation}
                  onValueChange={(val) => handleChange("emergencyContactRelation", val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Sibling">Sibling</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Friend">Friend</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {profile.emergencyContactRelation || "—"}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
      ) : null}

      {section === "notifications" ? (
      <div className="flex flex-col gap-6">
        <CustomerNotificationPreferencesPanel
          enabledModuleSlugs={enabledModuleSlugs}
          notifications={notifications}
          onChange={handleNotificationChange}
        />
      </div>
      ) : null}

      {section === "applications" ? (
      <div className="flex flex-col gap-6">
      <Card className="border border-border shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base font-semibold"><Users className="h-4 w-4" />Applications</CardTitle><CardDescription>Apply to become a vendor, volunteer, or take on other roles in our community.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-6">
          {userApplications.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-medium text-foreground">Your Applications</h4>
              <div className="flex flex-col gap-2">
                {userApplications.map((application) => {
                  const appType = applicationTypes.find((at) => at.id === application.applicationTypeId)
                  const IconComponent = appType ? iconMap[appType.icon] : Users
                  const statusStyle = statusStyles[application.status]
                  return <div key={application.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><IconComponent className="h-5 w-5 text-primary" /></div><div className="flex flex-col gap-0.5"><span className="text-sm font-medium text-foreground">{application.applicationTypeName}</span><span className="text-xs text-muted-foreground">Submitted {format(parseISO(application.submittedAt), "MMM d, yyyy")}</span></div></div><Badge variant={statusStyle.variant} className={statusStyle.className}>{application.status === "Pending" && <Clock className="mr-1 h-3 w-3" />}{application.status === "Under Review" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{application.status === "Approved" && <CheckCircle2 className="mr-1 h-3 w-3" />}{application.status === "Rejected" && <XCircle className="mr-1 h-3 w-3" />}{application.status}</Badge></div>
                })}
              </div>
              {availableApplicationTypes.length > 0 && <Separator className="my-2" />}
            </div>
          )}

          {availableApplicationTypes.length > 0 ? (
            <div className="flex flex-col gap-3">
              {userApplications.length > 0 && <h4 className="text-sm font-medium text-foreground">Available Applications</h4>}
              <div className="grid gap-3 sm:grid-cols-2">
                {availableApplicationTypes.map((appType) => {
                  const IconComponent = iconMap[appType.icon] || Users
                  return <button key={appType.id} onClick={() => openApplyDialog(appType)} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10"><IconComponent className="h-6 w-6 text-primary" /></div><div className="flex flex-1 flex-col gap-0.5"><span className="text-sm font-medium text-foreground">{appType.name}</span><span className="line-clamp-2 text-xs text-muted-foreground">{appType.description}</span></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center"><CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" /><p className="text-sm font-medium text-foreground">No applications available yet</p><p className="text-xs text-muted-foreground">Available applications will appear here once they are connected.</p></div>
          )}
        </CardContent>
      </Card>
      </div>
      ) : null}

      <Dialog
        open={isEditing && section === "personal"}
        onOpenChange={(open) => {
          if (!open) handleCancel()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your contact details and address.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input id="edit-firstName" value={editData.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input id="edit-lastName" value={editData.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-email">Email Address</Label>
                <Input id="edit-email" type="email" value={editData.email} onChange={(e) => handleChange("email", e.target.value)} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input id="edit-phone" type="tel" value={editData.phone} onChange={(e) => handleChange("phone", e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-dob">Date of Birth</Label>
                <BirthDateInput id="edit-dob" value={editData.dateOfBirth} onChange={(value) => handleChange("dateOfBirth", value)} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-gender">Gender</Label>
                <Select value={editData.gender} onValueChange={(val) => handleChange("gender", val)}>
                  <SelectTrigger id="edit-gender" className="h-9"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4" />
                Address
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-address1">Street Address</Label>
                  <Input id="edit-address1" value={editData.addressLine1} onChange={(e) => handleChange("addressLine1", e.target.value)} className="h-9" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-address2">Apartment, Suite, etc.</Label>
                  <Input id="edit-address2" value={editData.addressLine2} onChange={(e) => handleChange("addressLine2", e.target.value)} className="h-9" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-city">City</Label>
                    <Input id="edit-city" value={editData.city} onChange={(e) => handleChange("city", e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-state">State</Label>
                    <Input id="edit-state" value={editData.state} onChange={(e) => handleChange("state", e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-zip">Zip Code</Label>
                    <Input id="edit-zip" value={editData.zipCode} onChange={(e) => handleChange("zipCode", e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-country">Country</Label>
                    <Input id="edit-country" value={editData.country} onChange={(e) => handleChange("country", e.target.value)} className="h-9" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddFamilyDialogOpen} onOpenChange={setIsAddFamilyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Family Member</DialogTitle><DialogDescription>Add a family member to your account. Children under 18 can be registered for events through your account.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label htmlFor="fm-firstName">First Name</Label><Input id="fm-firstName" value={newFamilyMember.firstName} onChange={(e) => setNewFamilyMember((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="First name" /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="fm-lastName">Last Name</Label><Input id="fm-lastName" value={newFamilyMember.lastName} onChange={(e) => setNewFamilyMember((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Last name" /></div>
            </div>
            <div className="flex flex-col gap-2"><Label htmlFor="fm-dob">Date of Birth</Label><BirthDateInput id="fm-dob" value={newFamilyMember.dateOfBirth} onChange={(dateOfBirth) => setNewFamilyMember((prev) => ({ ...prev, dateOfBirth }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label htmlFor="fm-gender">Gender</Label><Select value={newFamilyMember.gender} onValueChange={(val) => setNewFamilyMember((prev) => ({ ...prev, gender: val }))}><SelectTrigger id="fm-gender"><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
              <div className="flex flex-col gap-2"><Label htmlFor="fm-relationship">Relationship</Label><Select value={newFamilyMember.relationship} onValueChange={(val) => setNewFamilyMember((prev) => ({ ...prev, relationship: val }))}><SelectTrigger id="fm-relationship"><SelectValue placeholder="Select relationship" /></SelectTrigger><SelectContent><SelectItem value="child">Child / Grandchild</SelectItem><SelectItem value="guardian">Guardian</SelectItem><SelectItem value="spouse">Spouse</SelectItem><SelectItem value="parent">Parent</SelectItem><SelectItem value="sibling">Sibling</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddFamilyDialogOpen(false)}>Cancel</Button><Button onClick={handleAddFamilyMember} disabled={!newFamilyMember.firstName || !newFamilyMember.lastName || !newFamilyMember.dateOfBirth || !newFamilyMember.gender || !newFamilyMember.relationship}>Add Member</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2">Apply as {selectedAppType?.name}</DialogTitle><DialogDescription>{selectedAppType?.description}</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3"><h4 className="mb-2 text-sm font-medium text-foreground">Requirements</h4><ul className="flex flex-col gap-1.5">{selectedAppType?.requirements.map((req, index) => <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground"><Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{req}</li>)}</ul></div>
            <Separator />
            <div className="flex flex-col gap-4"><div className="flex flex-col gap-2"><Label htmlFor="motivation">Why are you interested in this role?</Label><Textarea id="motivation" placeholder="Tell us about your interest and relevant experience..." value={applicationAnswers.motivation || ""} onChange={(e) => handleApplicationAnswerChange("motivation", e.target.value)} className="min-h-24 resize-none" /></div><div className="flex flex-col gap-2"><Label htmlFor="experience">Relevant experience or qualifications</Label><Textarea id="experience" placeholder="Describe any relevant experience, skills, or certifications..." value={applicationAnswers.experience || ""} onChange={(e) => handleApplicationAnswerChange("experience", e.target.value)} className="min-h-24 resize-none" /></div><div className="flex flex-col gap-2"><Label htmlFor="availability">Availability</Label><Input id="availability" placeholder="e.g., Weekends, Evenings, Full-time" value={applicationAnswers.availability || ""} onChange={(e) => handleApplicationAnswerChange("availability", e.target.value)} /></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>Cancel</Button><Button onClick={handleSubmitApplication} disabled={isSubmittingApp || !applicationAnswers.motivation}>{isSubmittingApp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Application"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
