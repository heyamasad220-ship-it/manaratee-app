"use client"

import { useCallback, useEffect, useState } from "react"
import { Calendar, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  createVolunteerHistory,
  createVolunteerSignUp,
  deleteVolunteerHistory,
  deleteVolunteerSignUp,
  ensureVolunteerForContact,
  updateVolunteerFromContact,
  updateVolunteerHistory,
  updateVolunteerSignUp,
} from "@/lib/volunteers/volunteer-actions"
import type {
  Volunteer,
  VolunteerFormState,
  VolunteerHistoryRow,
  VolunteerPerformance,
  VolunteerRow,
  VolunteerSignUpRow,
  VolunteerSignUpStatus,
  VolunteerStatus,
} from "@/lib/volunteers/volunteer-types"
import {
  buildVolunteerFromRows,
  parseListInput,
  performanceStyles,
  signUpStatusStyles,
  volunteerStatusStyles,
} from "@/lib/volunteers/volunteer-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ContactVolunteerPanelProps = {
  contactId: string
  contactName: string
  contactEmail?: string
  contactPhone?: string
}

const emptyProfileForm: VolunteerFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  status: "active",
  join_date: new Date().toISOString().slice(0, 10),
  skills: "",
  availability: "",
  notes: "",
}

const emptySignUpForm = {
  event_name: "",
  event_date: "",
  role: "",
  hours_logged: "0",
  status: "pending" as VolunteerSignUpStatus,
}

const emptyHistoryForm = {
  event_name: "",
  event_date: "",
  role: "",
  hours_worked: "0",
  performance: "good" as VolunteerPerformance,
  notes: "",
}

function contactNameToForm(contactName: string, email: string, phone: string): VolunteerFormState {
  const parts = contactName.trim().split(/\s+/).filter(Boolean)
  const first_name = parts[0] || ""
  const last_name = parts.slice(1).join(" ")

  return {
    ...emptyProfileForm,
    first_name,
    last_name,
    email,
    phone,
  }
}

function volunteerToForm(volunteer: Volunteer): VolunteerFormState {
  return {
    first_name: volunteer.firstName,
    last_name: volunteer.lastName,
    email: volunteer.email,
    phone: volunteer.phone,
    status:
      volunteer.status === "Active"
        ? "active"
        : volunteer.status === "Inactive"
          ? "inactive"
          : "pending",
    join_date: volunteer.joinDateRaw.slice(0, 10),
    skills: volunteer.skills.join(", "),
    availability: volunteer.availability.join(", "),
    notes: volunteer.notes || "",
  }
}

export function ContactVolunteerPanel({
  contactId,
  contactName,
  contactEmail = "",
  contactPhone = "",
}: ContactVolunteerPanelProps) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null)
  const [volunteerRowId, setVolunteerRowId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState<VolunteerFormState>(emptyProfileForm)

  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [editingSignUpId, setEditingSignUpId] = useState<string | null>(null)
  const [signUpForm, setSignUpForm] = useState(emptySignUpForm)

  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null)
  const [historyForm, setHistoryForm] = useState(emptyHistoryForm)

  const [allSignUps, setAllSignUps] = useState<
    (Volunteer["signUps"][number] & { eventDateRaw: string | null })[]
  >([])
  const [allHistory, setAllHistory] = useState<
    (Volunteer["history"][number] & { eventDateRaw: string | null })[]
  >([])

  const loadVolunteerData = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")

    const orgId = await getCurrentOrganizationId()
    if (!orgId) {
      setVolunteer(null)
      setLoading(false)
      return
    }

    try {
      let volunteerQuery = supabase
        .from("volunteers")
        .select("*")
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .maybeSingle()

      const { data: volunteerRow, error: volunteerError } = await volunteerQuery

      if (volunteerError) {
        throw volunteerError
      }

      const row = volunteerRow as VolunteerRow | null

      if (!row) {
        setVolunteer(null)
        setVolunteerRowId(null)
        setAllSignUps([])
        setAllHistory([])
        setLoading(false)
        return
      }

      setVolunteerRowId(row.id)

      const [signUpsResult, historyResult] = await Promise.all([
        supabase
          .from("volunteer_sign_ups")
          .select("*")
          .eq("organization_id", orgId)
          .eq("volunteer_id", row.id)
          .order("event_date", { ascending: true }),
        supabase
          .from("volunteer_history")
          .select("*")
          .eq("organization_id", orgId)
          .eq("volunteer_id", row.id)
          .order("event_date", { ascending: false }),
      ])

      if (signUpsResult.error) throw signUpsResult.error
      if (historyResult.error) throw historyResult.error

      const signUpRows = (signUpsResult.data || []) as VolunteerSignUpRow[]
      const historyRows = (historyResult.data || []) as VolunteerHistoryRow[]
      const built = buildVolunteerFromRows(row, signUpRows, historyRows)

      setVolunteer(built)
      setAllSignUps(
        signUpRows.map((signUp) => ({
          id: signUp.id,
          eventName: signUp.event_name,
          date: signUp.event_date ? signUp.event_date.slice(0, 10) : "-",
          eventDateRaw: signUp.event_date,
          role: signUp.role || "-",
          hoursLogged: Number(signUp.hours_logged) || 0,
          status:
            signUp.status === "confirmed"
              ? "Confirmed"
              : signUp.status === "completed"
                ? "Completed"
                : signUp.status === "cancelled"
                  ? "Cancelled"
                  : "Pending",
        }))
      )
      setAllHistory(
        historyRows.map((record) => ({
          id: record.id,
          eventName: record.event_name,
          date: record.event_date ? record.event_date.slice(0, 10) : "-",
          eventDateRaw: record.event_date,
          role: record.role || "-",
          hoursWorked: Number(record.hours_worked) || 0,
          performance:
            record.performance === "excellent"
              ? "Excellent"
              : record.performance === "average"
                ? "Average"
                : record.performance === "poor"
                  ? "Poor"
                  : "Good",
          notes: record.notes || undefined,
        }))
      )
    } catch (error: any) {
      console.error("Contact volunteer panel error:", error)
      setErrorMessage(error?.message || "Could not load volunteer data.")
      setVolunteer(null)
    } finally {
      setLoading(false)
    }
  }, [contactId, supabase])

  useEffect(() => {
    void loadVolunteerData()
  }, [loadVolunteerData])

  async function handleEnsureVolunteerRecord() {
    setSaving(true)
    try {
      await ensureVolunteerForContact(contactId)
      await loadVolunteerData()
    } catch (error: any) {
      alert(error?.message || "Could not create volunteer record.")
    } finally {
      setSaving(false)
    }
  }

  function openProfileDialog() {
    if (volunteer) {
      setProfileForm(volunteerToForm(volunteer))
    } else {
      setProfileForm(contactNameToForm(contactName, contactEmail, contactPhone))
    }
    setIsProfileOpen(true)
  }

  async function handleSaveProfile() {
    if (!volunteerRowId || !profileForm.first_name.trim() || !profileForm.last_name.trim()) return

    setSaving(true)
    try {
      await updateVolunteerFromContact({
        id: volunteerRowId,
        contactId,
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        status: profileForm.status,
        join_date: profileForm.join_date,
        skills: parseListInput(profileForm.skills),
        availability: parseListInput(profileForm.availability),
        notes: profileForm.notes.trim(),
      })
      setIsProfileOpen(false)
      await loadVolunteerData()
    } catch (error: any) {
      alert(error?.message || "Could not save volunteer profile.")
    } finally {
      setSaving(false)
    }
  }

  function openAddSignUp() {
    setEditingSignUpId(null)
    setSignUpForm(emptySignUpForm)
    setIsSignUpOpen(true)
  }

  function openEditSignUp(signUp: (typeof allSignUps)[number]) {
    setEditingSignUpId(signUp.id)
    setSignUpForm({
      event_name: signUp.eventName,
      event_date: signUp.eventDateRaw ? signUp.eventDateRaw.slice(0, 10) : "",
      role: signUp.role === "-" ? "" : signUp.role,
      hours_logged: String(signUp.hoursLogged),
      status:
        signUp.status === "Confirmed"
          ? "confirmed"
          : signUp.status === "Completed"
            ? "completed"
            : signUp.status === "Cancelled"
              ? "cancelled"
              : "pending",
    })
    setIsSignUpOpen(true)
  }

  async function handleSaveSignUp() {
    if (!volunteerRowId || !signUpForm.event_name.trim()) return

    setSaving(true)
    try {
      const payload = {
        volunteer_id: volunteerRowId,
        event_name: signUpForm.event_name.trim(),
        event_date: signUpForm.event_date || null,
        role: signUpForm.role.trim() || null,
        hours_logged: Number(signUpForm.hours_logged) || 0,
        status: signUpForm.status,
      }

      if (editingSignUpId) {
        await updateVolunteerSignUp({ id: editingSignUpId, ...payload })
      } else {
        await createVolunteerSignUp(payload)
      }

      setIsSignUpOpen(false)
      await loadVolunteerData()
    } catch (error: any) {
      alert(error?.message || "Could not save sign-up.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSignUp(id: string) {
    if (!window.confirm("Delete this sign-up?")) return

    setSaving(true)
    try {
      await deleteVolunteerSignUp(id)
      await loadVolunteerData()
    } catch (error: any) {
      alert(error?.message || "Could not delete sign-up.")
    } finally {
      setSaving(false)
    }
  }

  function openAddHistory() {
    setEditingHistoryId(null)
    setHistoryForm(emptyHistoryForm)
    setIsHistoryOpen(true)
  }

  function openEditHistory(record: (typeof allHistory)[number]) {
    setEditingHistoryId(record.id)
    setHistoryForm({
      event_name: record.eventName,
      event_date: record.eventDateRaw ? record.eventDateRaw.slice(0, 10) : "",
      role: record.role === "-" ? "" : record.role,
      hours_worked: String(record.hoursWorked),
      performance:
        record.performance === "Excellent"
          ? "excellent"
          : record.performance === "Average"
            ? "average"
            : record.performance === "Poor"
              ? "poor"
              : "good",
      notes: record.notes || "",
    })
    setIsHistoryOpen(true)
  }

  async function handleSaveHistory() {
    if (!volunteerRowId || !historyForm.event_name.trim()) return

    setSaving(true)
    try {
      const payload = {
        volunteer_id: volunteerRowId,
        event_name: historyForm.event_name.trim(),
        event_date: historyForm.event_date || null,
        role: historyForm.role.trim() || null,
        hours_worked: Number(historyForm.hours_worked) || 0,
        performance: historyForm.performance,
        notes: historyForm.notes.trim() || null,
      }

      if (editingHistoryId) {
        await updateVolunteerHistory({ id: editingHistoryId, ...payload })
      } else {
        await createVolunteerHistory(payload)
      }

      setIsHistoryOpen(false)
      await loadVolunteerData()
    } catch (error: any) {
      alert(error?.message || "Could not save history record.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteHistory(id: string) {
    if (!window.confirm("Delete this history record?")) return

    setSaving(true)
    try {
      await deleteVolunteerHistory(id)
      await loadVolunteerData()
    } catch (error: any) {
      alert(error?.message || "Could not delete history record.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading volunteer details...
        </CardContent>
      </Card>
    )
  }

  if (!volunteer) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Volunteer</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            This contact has the volunteer role but no volunteer profile yet. Create one to track
            sign-ups, hours, and event history.
          </p>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <Button onClick={handleEnsureVolunteerRecord} disabled={saving}>
            {saving ? "Creating..." : "Create Volunteer Profile"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const activeSignUps = allSignUps.filter(
    (signUp) => signUp.status === "Confirmed" || signUp.status === "Pending"
  )

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-lg font-semibold">Volunteer</h2>
                <p className="text-sm text-muted-foreground">Volunteer since {volunteer.joinDate}</p>
              </div>
              <Badge variant="secondary" className={volunteerStatusStyles[volunteer.status]}>
                {volunteer.status}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={openProfileDialog}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{volunteer.totalHours}</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{volunteer.eventsVolunteered}</p>
              <p className="text-xs text-muted-foreground">Events Completed</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{activeSignUps.length}</p>
              <p className="text-xs text-muted-foreground">Active Sign-Ups</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{volunteer.skills.length}</p>
              <p className="text-xs text-muted-foreground">Skills Listed</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Skills</p>
              <div className="flex flex-wrap gap-2">
                {volunteer.skills.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None listed</span>
                ) : (
                  volunteer.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Availability</p>
              <div className="flex flex-wrap gap-2">
                {volunteer.availability.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None listed</span>
                ) : (
                  volunteer.availability.map((slot) => (
                    <Badge key={slot} variant="outline">
                      {slot}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="signups">
            <TabsList>
              <TabsTrigger value="signups">Sign-Ups ({allSignUps.length})</TabsTrigger>
              <TabsTrigger value="history">History ({allHistory.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="signups" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Upcoming and past event sign-ups</p>
                <Button size="sm" onClick={openAddSignUp}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Sign-Up
                </Button>
              </div>

              {allSignUps.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No sign-ups yet.</p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[90px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allSignUps.map((signUp) => (
                        <TableRow key={signUp.id}>
                          <TableCell className="font-medium">{signUp.eventName}</TableCell>
                          <TableCell>{signUp.date}</TableCell>
                          <TableCell>{signUp.role}</TableCell>
                          <TableCell>{signUp.hoursLogged}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={signUpStatusStyles[signUp.status]}>
                              {signUp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditSignUp(signUp)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                onClick={() => handleDeleteSignUp(signUp.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Completed volunteer participation</p>
                <Button size="sm" onClick={openAddHistory}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add History
                </Button>
              </div>

              {allHistory.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No participation history yet.
                </p>
              ) : (
                <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto">
                  {allHistory.map((record) => (
                    <div key={record.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{record.eventName}</span>
                            <Badge variant="secondary" className={performanceStyles[record.performance]}>
                              {record.performance}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{record.date}</p>
                          {record.notes && (
                            <p className="mt-2 text-sm text-muted-foreground">{record.notes}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="text-right">
                            <p className="text-sm font-medium">{record.hoursWorked} hrs</p>
                            <p className="text-xs text-muted-foreground">{record.role}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditHistory(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteHistory(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Volunteer Profile</DialogTitle>
            <DialogDescription>
              Updates sync to this contact&apos;s name, email, and phone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={profileForm.first_name}
                  onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={profileForm.last_name}
                  onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={profileForm.status}
                  onValueChange={(value) =>
                    setProfileForm({ ...profileForm, status: value as VolunteerStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Join Date</Label>
                <Input
                  type="date"
                  value={profileForm.join_date}
                  onChange={(e) => setProfileForm({ ...profileForm, join_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Skills</Label>
              <Textarea
                value={profileForm.skills}
                onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                placeholder="Event Setup, Registration"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Availability</Label>
              <Textarea
                value={profileForm.availability}
                onChange={(e) => setProfileForm({ ...profileForm, availability: e.target.value })}
                placeholder="Weekends, Evenings"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={profileForm.notes}
                onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProfileOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSignUpId ? "Edit Sign-Up" : "Add Sign-Up"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label>Event Name</Label>
              <Input
                value={signUpForm.event_name}
                onChange={(e) => setSignUpForm({ ...signUpForm, event_name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Event Date</Label>
                <Input
                  type="date"
                  value={signUpForm.event_date}
                  onChange={(e) => setSignUpForm({ ...signUpForm, event_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={signUpForm.role}
                  onChange={(e) => setSignUpForm({ ...signUpForm, role: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Hours Logged</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={signUpForm.hours_logged}
                  onChange={(e) => setSignUpForm({ ...signUpForm, hours_logged: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={signUpForm.status}
                  onValueChange={(value) =>
                    setSignUpForm({ ...signUpForm, status: value as VolunteerSignUpStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignUpOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSignUp} disabled={saving || !signUpForm.event_name.trim()}>
              {saving ? "Saving..." : "Save Sign-Up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHistoryId ? "Edit History" : "Add History"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label>Event Name</Label>
              <Input
                value={historyForm.event_name}
                onChange={(e) => setHistoryForm({ ...historyForm, event_name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Event Date</Label>
                <Input
                  type="date"
                  value={historyForm.event_date}
                  onChange={(e) => setHistoryForm({ ...historyForm, event_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={historyForm.role}
                  onChange={(e) => setHistoryForm({ ...historyForm, role: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Hours Worked</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={historyForm.hours_worked}
                  onChange={(e) => setHistoryForm({ ...historyForm, hours_worked: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Performance</Label>
                <Select
                  value={historyForm.performance}
                  onValueChange={(value) =>
                    setHistoryForm({ ...historyForm, performance: value as VolunteerPerformance })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={historyForm.notes}
                onChange={(e) => setHistoryForm({ ...historyForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHistory} disabled={saving || !historyForm.event_name.trim()}>
              {saving ? "Saving..." : "Save History"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
