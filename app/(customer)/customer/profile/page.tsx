"use client"

import { useEffect, useState, type ElementType } from "react"
import { format, parseISO } from "date-fns"
import {
  Pencil,
  X,
  Check,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Bell,
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
  CreditCard,
  Plus,
  HandCoins,
  Briefcase,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  addCustomerFamilyMember,
  removeCustomerFamilyMember,
} from "@/lib/customer/customer-family-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BirthDateInput } from "@/components/ui/birth-date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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

interface NotificationSettings {
  emailEvents: boolean
  emailSignUps: boolean
  emailBookings: boolean
  emailNewsletter: boolean
  smsReminders: boolean
}

const defaultNotifications: NotificationSettings = {
  emailEvents: false,
  emailSignUps: false,
  emailBookings: false,
  emailNewsletter: false,
  smsReminders: false,
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

interface PaymentMethod {
  id: string
  type: "visa" | "mastercard" | "amex" | "discover"
  lastFour: string
  expiryMonth: string
  expiryYear: string
  isDefault: boolean
  cardholderName: string
}

function CardBrandIcon({ type, className }: { type: string; className?: string }) {
  const brandColors: Record<string, string> = {
    visa: "#1A1F71",
    mastercard: "#EB001B",
    amex: "#006FCF",
    discover: "#FF6000",
  }

  return (
    <div className={`flex h-8 w-12 items-center justify-center rounded border border-border bg-background ${className}`}>
      <span className="text-xs font-bold uppercase" style={{ color: brandColors[type] || "#000" }}>
        {type}
      </span>
    </div>
  )
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

function safeMonthYear(value: string) {
  if (!value) return "—"
  try {
    return format(parseISO(value), "MMMM yyyy")
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

export default function CustomerProfilePage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contactId, setContactId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData>(emptyProfile)
  const [editData, setEditData] = useState<ProfileData>(emptyProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications)

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

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false)
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    cardNumber: "",
    cardholderName: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  })

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("contacts")
        .select("id, organization_id, person_id, full_name, email, phone, address, city, state, zip, country, notes, created_at")
        .eq("auth_user_id", user.id)
        .maybeSingle()

      if (error || !data) {
        console.error("Customer profile load error:", error)
        setLoading(false)
        return
      }

      const name = splitFullName(data.full_name)
      const loadedProfile: ProfileData = {
        firstName: name.firstName,
        lastName: name.lastName,
        email: data.email || user.email || "",
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

      if (data.person_id) {
        await loadFamilyMembers(data.person_id)
      } else {
        setFamilyMembers([])
      }

      // These remain empty until real tables exist for payment methods, applications, and notification preferences.
      setPaymentMethods([])
      setUserApplications([])
      setNotifications(defaultNotifications)
      setLoading(false)
    }

    loadProfile()
  }, [supabase])

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

  function handleNotificationChange(field: keyof NotificationSettings, value: boolean) {
    setNotifications((prev) => ({ ...prev, [field]: value }))
  }

  async function loadFamilyMembers(parentPersonId: string) {
    const { data, error } = await supabase
      .from("person_relationships")
      .select(`
        id,
        relationship_type,
        related_person_id,
        people:related_person_id (
          id,
          first_name,
          last_name,
          gender,
          date_of_birth
        )
      `)
      .eq("person_id", parentPersonId)

    if (error) {
      console.error("Family members load error:", error)
      return
    }

    const members =
      data?.map((row: any) => ({
        id: row.people.id,
        firstName: row.people.first_name || "",
        lastName: row.people.last_name || "",
        gender: row.people.gender || "",
        dateOfBirth: row.people.date_of_birth || "",
        relationship: row.relationship_type || "",
      })) || []

    setFamilyMembers(members)
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

  async function refreshParentPersonId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !organizationId) {
      return null
    }

    const { data } = await supabase
      .from("contacts")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle()

    const nextPersonId = (data?.person_id as string | null) ?? null
    if (nextPersonId) {
      setPersonId(nextPersonId)
    }

    return nextPersonId
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

  function detectCardType(cardNumber: string): "visa" | "mastercard" | "amex" | "discover" {
    const firstDigit = cardNumber.charAt(0)
    const firstTwo = cardNumber.substring(0, 2)
    if (firstDigit === "4") return "visa"
    if (["51", "52", "53", "54", "55"].includes(firstTwo)) return "mastercard"
    if (["34", "37"].includes(firstTwo)) return "amex"
    if (firstDigit === "6") return "discover"
    return "visa"
  }

  function handleAddPaymentMethod() {
    const newMethod: PaymentMethod = {
      id: `pm-${Date.now()}`,
      type: detectCardType(newPaymentMethod.cardNumber),
      lastFour: newPaymentMethod.cardNumber.slice(-4),
      expiryMonth: newPaymentMethod.expiryMonth,
      expiryYear: newPaymentMethod.expiryYear,
      isDefault: paymentMethods.length === 0,
      cardholderName: newPaymentMethod.cardholderName,
    }
    setPaymentMethods((prev) => [...prev, newMethod])
    setNewPaymentMethod({ cardNumber: "", cardholderName: "", expiryMonth: "", expiryYear: "", cvv: "" })
    setIsAddPaymentDialogOpen(false)
  }

  function handleRemovePaymentMethod(id: string) {
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id))
  }

  function handleSetDefaultPaymentMethod(id: string) {
    setPaymentMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })))
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

  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || profile.email || "Customer"
  const initials = `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}` || fullName.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your personal information and preferences.</p>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Avatar className="size-20 border-2 border-border">
              <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-foreground">{loading ? "Loading..." : fullName}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {profile.email || "—"}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {profile.phone || "—"}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Active Member</Badge>
                <span className="text-xs text-muted-foreground">Member since {safeMonthYear(profile.memberSince)}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="self-start">
            <User className="mr-2 h-4 w-4" />
            Change Photo
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
            <CardDescription>Your basic profile and contact details.</CardDescription>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Check className="mr-1.5 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">First Name</Label>
              {isEditing ? <Input value={editData.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.firstName || "—"}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Last Name</Label>
              {isEditing ? <Input value={editData.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.lastName || "—"}</span>}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Email Address</Label>
              {isEditing ? <Input type="email" value={editData.email} onChange={(e) => handleChange("email", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.email || "—"}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Phone Number</Label>
              {isEditing ? <Input type="tel" value={editData.phone} onChange={(e) => handleChange("phone", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.phone || "—"}</span>}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Date of Birth</Label>
              {isEditing ? <BirthDateInput id="profile-dob" value={editData.dateOfBirth} onChange={(value) => handleChange("dateOfBirth", value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{safeDate(profile.dateOfBirth)}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Gender</Label>
              {isEditing ? (
                <Select value={editData.gender} onValueChange={(val) => handleChange("gender", val)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Non-binary">Non-binary</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="text-sm font-medium text-foreground">{profile.gender || "—"}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">Preferred Language</Label>
            {isEditing ? (
              <Select value={editData.preferredLanguage} onValueChange={(val) => handleChange("preferredLanguage", val)}>
                <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Spanish">Spanish</SelectItem>
                  <SelectItem value="French">French</SelectItem>
                  <SelectItem value="Arabic">Arabic</SelectItem>
                  <SelectItem value="Chinese">Chinese</SelectItem>
                </SelectContent>
              </Select>
            ) : <span className="text-sm font-medium text-foreground">{profile.preferredLanguage || "—"}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">Bio</Label>
            {isEditing ? <Textarea value={editData.bio} onChange={(e) => handleChange("bio", e.target.value)} className="min-h-20 resize-none" placeholder="Tell us a little about yourself..." /> : <span className="text-sm font-medium text-foreground">{profile.bio || "—"}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold"><MapPin className="h-4 w-4" />Address</CardTitle>
          <CardDescription>Your home or mailing address.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">Street Address</Label>
            {isEditing ? <Input value={editData.addressLine1} onChange={(e) => handleChange("addressLine1", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.addressLine1 || "—"}</span>}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">Apartment, Suite, etc.</Label>
            {isEditing ? <Input value={editData.addressLine2} onChange={(e) => handleChange("addressLine2", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.addressLine2 || "—"}</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2"><Label className="text-sm text-muted-foreground">City</Label>{isEditing ? <Input value={editData.city} onChange={(e) => handleChange("city", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.city || "—"}</span>}</div>
            <div className="flex flex-col gap-2"><Label className="text-sm text-muted-foreground">State</Label>{isEditing ? <Input value={editData.state} onChange={(e) => handleChange("state", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.state || "—"}</span>}</div>
            <div className="flex flex-col gap-2"><Label className="text-sm text-muted-foreground">Zip Code</Label>{isEditing ? <Input value={editData.zipCode} onChange={(e) => handleChange("zipCode", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.zipCode || "—"}</span>}</div>
            <div className="flex flex-col gap-2"><Label className="text-sm text-muted-foreground">Country</Label>{isEditing ? <Input value={editData.country} onChange={(e) => handleChange("country", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.country || "—"}</span>}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold"><Shield className="h-4 w-4" />Emergency Contact</CardTitle>
          <CardDescription>Someone we can contact in case of an emergency.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2"><Label className="text-sm text-muted-foreground">Contact Name</Label>{isEditing ? <Input value={editData.emergencyContactName} onChange={(e) => handleChange("emergencyContactName", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.emergencyContactName || "—"}</span>}</div>
            <div className="flex flex-col gap-2"><Label className="text-sm text-muted-foreground">Contact Phone</Label>{isEditing ? <Input type="tel" value={editData.emergencyContactPhone} onChange={(e) => handleChange("emergencyContactPhone", e.target.value)} className="h-9" /> : <span className="text-sm font-medium text-foreground">{profile.emergencyContactPhone || "—"}</span>}</div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Relationship</Label>
              {isEditing ? (
                <Select value={editData.emergencyContactRelation} onValueChange={(val) => handleChange("emergencyContactRelation", val)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">Spouse</SelectItem><SelectItem value="Parent">Parent</SelectItem><SelectItem value="Sibling">Sibling</SelectItem><SelectItem value="Child">Child</SelectItem><SelectItem value="Friend">Friend</SelectItem><SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="text-sm font-medium text-foreground">{profile.emergencyContactRelation || "—"}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold"><Users className="h-4 w-4" />Family Members</CardTitle>
            <CardDescription>Manage family members under your account. Children under 18 must be added here.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsAddFamilyDialogOpen(true)}><UserPlus className="mr-1.5 h-4 w-4" />Add Member</Button>
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
            </div>
          )}
        </CardContent>
      </Card>

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
              <div className="flex flex-col gap-2"><Label htmlFor="fm-gender">Gender</Label><Select value={newFamilyMember.gender} onValueChange={(val) => setNewFamilyMember((prev) => ({ ...prev, gender: val }))}><SelectTrigger id="fm-gender"><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Non-binary">Non-binary</SelectItem><SelectItem value="Prefer not to say">Prefer not to say</SelectItem></SelectContent></Select></div>
              <div className="flex flex-col gap-2"><Label htmlFor="fm-relationship">Relationship</Label><Select value={newFamilyMember.relationship} onValueChange={(val) => setNewFamilyMember((prev) => ({ ...prev, relationship: val }))}><SelectTrigger id="fm-relationship"><SelectValue placeholder="Select relationship" /></SelectTrigger><SelectContent><SelectItem value="child">Child / Grandchild</SelectItem><SelectItem value="guardian">Guardian</SelectItem><SelectItem value="spouse">Spouse</SelectItem><SelectItem value="parent">Parent</SelectItem><SelectItem value="sibling">Sibling</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddFamilyDialogOpen(false)}>Cancel</Button><Button onClick={handleAddFamilyMember} disabled={!newFamilyMember.firstName || !newFamilyMember.lastName || !newFamilyMember.dateOfBirth || !newFamilyMember.gender || !newFamilyMember.relationship}>Add Member</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base font-semibold"><CreditCard className="h-4 w-4" />Payment Methods</CardTitle><CardDescription>Manage your saved payment methods for quick checkout.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={() => setIsAddPaymentDialogOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add Card</Button>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center"><CreditCard className="mb-3 h-10 w-10 text-muted-foreground/50" /><p className="text-sm font-medium text-foreground">No payment methods saved</p><p className="mt-1 text-xs text-muted-foreground">Add a payment method for faster checkout.</p><Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddPaymentDialogOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add Payment Method</Button></div>
          ) : (
            <div className="flex flex-col gap-3">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-4"><CardBrandIcon type={method.type} /><div className="flex flex-col gap-1"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground">{method.type.charAt(0).toUpperCase() + method.type.slice(1)} ending in {method.lastFour}</span>{method.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}</div><div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{method.cardholderName}</span><span className="text-muted-foreground/50">|</span><span>Expires {method.expiryMonth}/{method.expiryYear}</span></div></div></div>
                  <div className="flex items-center gap-2">{!method.isDefault && <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleSetDefaultPaymentMethod(method.id)}>Set as default</Button>}<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemovePaymentMethod(method.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddPaymentDialogOpen} onOpenChange={setIsAddPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Payment Method</DialogTitle><DialogDescription>Add a credit or debit card to your account.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2"><Label htmlFor="pm-cardNumber">Card Number</Label><Input id="pm-cardNumber" value={newPaymentMethod.cardNumber} onChange={(e) => setNewPaymentMethod((prev) => ({ ...prev, cardNumber: e.target.value.replace(/\D/g, "").slice(0, 16) }))} placeholder="1234 5678 9012 3456" maxLength={16} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="pm-cardholderName">Cardholder Name</Label><Input id="pm-cardholderName" value={newPaymentMethod.cardholderName} onChange={(e) => setNewPaymentMethod((prev) => ({ ...prev, cardholderName: e.target.value }))} placeholder="Cardholder name" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2"><Label htmlFor="pm-expiryMonth">Month</Label><Select value={newPaymentMethod.expiryMonth} onValueChange={(val) => setNewPaymentMethod((prev) => ({ ...prev, expiryMonth: val }))}><SelectTrigger id="pm-expiryMonth"><SelectValue placeholder="MM" /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => { const month = String(i + 1).padStart(2, "0"); return <SelectItem key={month} value={month}>{month}</SelectItem> })}</SelectContent></Select></div>
              <div className="flex flex-col gap-2"><Label htmlFor="pm-expiryYear">Year</Label><Select value={newPaymentMethod.expiryYear} onValueChange={(val) => setNewPaymentMethod((prev) => ({ ...prev, expiryYear: val }))}><SelectTrigger id="pm-expiryYear"><SelectValue placeholder="YYYY" /></SelectTrigger><SelectContent>{Array.from({ length: 10 }, (_, i) => { const year = String(new Date().getFullYear() + i); return <SelectItem key={year} value={year}>{year}</SelectItem> })}</SelectContent></Select></div>
              <div className="flex flex-col gap-2"><Label htmlFor="pm-cvv">CVV</Label><Input id="pm-cvv" type="password" value={newPaymentMethod.cvv} onChange={(e) => setNewPaymentMethod((prev) => ({ ...prev, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="123" maxLength={4} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddPaymentDialogOpen(false)}>Cancel</Button><Button onClick={handleAddPaymentMethod} disabled={!newPaymentMethod.cardNumber || newPaymentMethod.cardNumber.length < 13 || !newPaymentMethod.cardholderName || !newPaymentMethod.expiryMonth || !newPaymentMethod.expiryYear || !newPaymentMethod.cvv || newPaymentMethod.cvv.length < 3}>Add Card</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Card className="border border-border shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base font-semibold"><Bell className="h-4 w-4" />Notification Preferences</CardTitle><CardDescription>Manage how you receive updates and reminders.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between"><div className="flex flex-col gap-0.5"><span className="text-sm font-medium text-foreground">Event Updates</span><span className="text-xs text-muted-foreground">Receive emails about events you are registered for.</span></div><Switch checked={notifications.emailEvents} onCheckedChange={(val) => handleNotificationChange("emailEvents", val)} /></div>
          <Separator />
          <div className="flex items-center justify-between"><div className="flex flex-col gap-0.5"><span className="text-sm font-medium text-foreground">Sign-Up Confirmations</span><span className="text-xs text-muted-foreground">Get notified when your sign-ups are confirmed.</span></div><Switch checked={notifications.emailSignUps} onCheckedChange={(val) => handleNotificationChange("emailSignUps", val)} /></div>
          <Separator />
          <div className="flex items-center justify-between"><div className="flex flex-col gap-0.5"><span className="text-sm font-medium text-foreground">Booking Notifications</span><span className="text-xs text-muted-foreground">Updates about your venue booking requests.</span></div><Switch checked={notifications.emailBookings} onCheckedChange={(val) => handleNotificationChange("emailBookings", val)} /></div>
          <Separator />
          <div className="flex items-center justify-between"><div className="flex flex-col gap-0.5"><span className="text-sm font-medium text-foreground">Newsletter</span><span className="text-xs text-muted-foreground">Receive our monthly community newsletter.</span></div><Switch checked={notifications.emailNewsletter} onCheckedChange={(val) => handleNotificationChange("emailNewsletter", val)} /></div>
          <Separator />
          <div className="flex items-center justify-between"><div className="flex flex-col gap-0.5"><span className="text-sm font-medium text-foreground">SMS Reminders</span><span className="text-xs text-muted-foreground">Get text message reminders for upcoming events.</span></div><Switch checked={notifications.smsReminders} onCheckedChange={(val) => handleNotificationChange("smsReminders", val)} /></div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader><CardTitle className="text-base font-semibold">Account</CardTitle><CardDescription>Manage your account settings and security.</CardDescription></CardHeader>
        <CardContent><Button variant="outline" size="sm">Change Password</Button></CardContent>
      </Card>
    </div>
  )
}
