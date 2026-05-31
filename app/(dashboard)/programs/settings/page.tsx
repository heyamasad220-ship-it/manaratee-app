"use client"

import * as React from "react"
import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/client"
import {
  createDepartment,
  deleteDepartment,
  fetchDepartmentsWithProgramCounts,
  updateDepartment,
} from "@/lib/departments/department-actions"
import { cn } from "@/lib/utils"

import {
  Bell,
  CreditCard,
  FolderOpen,
  Pencil,
  Percent,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
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

type ProgramSettings = {
  default_capacity: number
  default_duration: string
  allow_waitlist: boolean
  require_payment_at_registration: boolean
  allow_partial_payments: boolean
  enforce_age_restrictions: boolean
  require_guardian_for_minors: boolean
  collect_emergency_contact: boolean
  collect_medical_information: boolean
  require_media_consent: boolean
  require_liability_waiver: boolean
  full_refund_days: string
  partial_refund_days: string
  cancellation_fee_amount: number
  cancellation_fee_percent: number
  send_registration_confirmation: boolean
  send_payment_receipt: boolean
  send_class_reminders: boolean
  send_program_updates: boolean
  send_waitlist_notifications: boolean
  first_reminder: string
  second_reminder: string
}

type Department = {
  id: string
  name: string
  description: string | null
  color: string | null
  programs_count?: number
}

type DiscountCode = {
  id: string
  code: string
  description: string | null
  discount_type: "percent" | "amount"
  discount_value: number
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  used_count: number
  active: boolean
}

const defaultSettings: ProgramSettings = {
  default_capacity: 30,
  default_duration: "12-weeks",
  allow_waitlist: true,
  require_payment_at_registration: true,
  allow_partial_payments: false,
  enforce_age_restrictions: true,
  require_guardian_for_minors: true,
  collect_emergency_contact: true,
  collect_medical_information: true,
  require_media_consent: true,
  require_liability_waiver: true,
  full_refund_days: "7",
  partial_refund_days: "3",
  cancellation_fee_amount: 25,
  cancellation_fee_percent: 10,
  send_registration_confirmation: true,
  send_payment_receipt: true,
  send_class_reminders: true,
  send_program_updates: true,
  send_waitlist_notifications: true,
  first_reminder: "24h",
  second_reminder: "1h",
}

const emptyDepartment = {
  id: "",
  name: "",
  description: "",
  color: "#3b82f6",
}

type DiscountFormState = {
  id: string
  code: string
  description: string
  discount_type: "percent" | "amount"
  discount_value: number
  starts_at: string
  expires_at: string
  max_uses: string
  active: boolean
}

const emptyDiscount: DiscountFormState = {
  id: "",
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  starts_at: "",
  expires_at: "",
  max_uses: "",
  active: true,
}

function safeNumber(value: string | number) {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : 0
}

function formatDate(value: string | null) {
  if (!value) return "-"

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function SettingSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>{label}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [tablesAvailable, setTablesAvailable] = React.useState(true)

  const [settings, setSettings] = React.useState<ProgramSettings>(defaultSettings)
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [discountCodes, setDiscountCodes] = React.useState<DiscountCode[]>([])

  const [departmentDialogOpen, setDepartmentDialogOpen] = React.useState(false)
  const [editingDepartment, setEditingDepartment] = React.useState(emptyDepartment)

  const [discountDialogOpen, setDiscountDialogOpen] = React.useState(false)
  const [editingDiscount, setEditingDiscount] = React.useState(emptyDiscount)

  React.useEffect(() => {
    void fetchSettingsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchSettingsData() {
    setLoading(true)

    try {
      const [settingsResult, departments, discountsResult] = await Promise.all([
        supabase.from("program_settings").select("settings").eq("id", "default").maybeSingle(),
        fetchDepartmentsWithProgramCounts(),
        supabase
          .from("discount_codes")
          .select(
            "id, code, description, discount_type, discount_value, starts_at, expires_at, max_uses, used_count, active"
          )
          .order("created_at", { ascending: false }),
      ])

      const missingTableErrors = [
        settingsResult.error,
        discountsResult.error,
      ].filter((error) => error?.code === "42P01" || error?.code === "42703")

      setTablesAvailable(missingTableErrors.length === 0)

      if (!settingsResult.error && settingsResult.data?.settings) {
        setSettings({ ...defaultSettings, ...(settingsResult.data.settings as Partial<ProgramSettings>) })
      } else if (settingsResult.error) {
        console.warn("program_settings could not be loaded:", settingsResult.error.message)
      }

      setDepartments(departments)

      if (!discountsResult.error) {
        setDiscountCodes((discountsResult.data || []) as DiscountCode[])
      } else {
        console.warn("discount_codes could not be loaded:", discountsResult.error.message)
        setDiscountCodes([])
      }
    } catch (error) {
      console.error("Settings page error:", error)
      setTablesAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  function updateSetting<K extends keyof ProgramSettings>(key: K, value: ProgramSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function handleSaveSettings() {
    setSaving(true)

    try {
      const { error } = await supabase
        .from("program_settings")
        .upsert({
          id: "default",
          settings,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      alert("Settings saved.")
    } catch (error: any) {
      console.error("Save settings error:", error)
      alert(error?.message || "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  function openAddDepartmentDialog() {
    setEditingDepartment(emptyDepartment)
    setDepartmentDialogOpen(true)
  }

  function openEditDepartmentDialog(department: Department) {
    setEditingDepartment({
      id: department.id,
      name: department.name,
      description: department.description || "",
      color: department.color || "#3b82f6",
    })
    setDepartmentDialogOpen(true)
  }

  async function handleSaveDepartment() {
    if (!editingDepartment.name.trim()) return

    setSaving(true)

    try {
      if (editingDepartment.id) {
        await updateDepartment({
          id: editingDepartment.id,
          name: editingDepartment.name.trim(),
          description: editingDepartment.description.trim() || undefined,
          color: editingDepartment.color || "#3b82f6",
        })
      } else {
        await createDepartment({
          name: editingDepartment.name.trim(),
          description: editingDepartment.description.trim() || undefined,
          color: editingDepartment.color || "#3b82f6",
        })
      }

      setDepartmentDialogOpen(false)
      setEditingDepartment(emptyDepartment)
      await fetchSettingsData()
    } catch (error: any) {
      console.error("Save department error:", error)
      alert(error?.message || "Could not save department.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDepartment(department: Department) {
    if ((department.programs_count || 0) > 0) {
      alert("This department is used by programs. Move those programs first, then delete the department.")
      return
    }

    const confirmed = window.confirm("Delete this department?")
    if (!confirmed) return

    try {
      await deleteDepartment(department.id)
      await fetchSettingsData()
    } catch (error: any) {
      console.error("Delete department error:", error)
      alert(error?.message || "Could not delete department.")
    }
  }

  function openAddDiscountDialog() {
    setEditingDiscount(emptyDiscount)
    setDiscountDialogOpen(true)
  }

  function openEditDiscountDialog(discount: DiscountCode) {
    setEditingDiscount({
      id: discount.id,
      code: discount.code,
      description: discount.description || "",
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      starts_at: discount.starts_at?.slice(0, 10) || "",
      expires_at: discount.expires_at?.slice(0, 10) || "",
      max_uses: discount.max_uses?.toString() || "",
      active: discount.active,
    })
    setDiscountDialogOpen(true)
  }

  async function handleSaveDiscount() {
    if (!editingDiscount.code.trim()) return

    setSaving(true)

    try {
      const payload = {
        code: editingDiscount.code.trim().toUpperCase(),
        description: editingDiscount.description.trim() || null,
        discount_type: editingDiscount.discount_type,
        discount_value: safeNumber(editingDiscount.discount_value),
        starts_at: editingDiscount.starts_at || null,
        expires_at: editingDiscount.expires_at || null,
        max_uses: editingDiscount.max_uses ? safeNumber(editingDiscount.max_uses) : null,
        active: editingDiscount.active,
      }

      const { error } = editingDiscount.id
        ? await supabase.from("discount_codes").update(payload).eq("id", editingDiscount.id)
        : await supabase.from("discount_codes").insert({ ...payload, used_count: 0 })

      if (error) throw error

      setDiscountDialogOpen(false)
      setEditingDiscount(emptyDiscount)
      await fetchSettingsData()
    } catch (error: any) {
      console.error("Save discount error:", error)
      alert(error?.message || "Could not save discount code.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDiscount(id: string) {
    const confirmed = window.confirm("Delete this discount code?")
    if (!confirmed) return

    const { error } = await supabase.from("discount_codes").delete().eq("id", id)

    if (error) {
      console.error("Delete discount code error:", error)
      alert(error.message)
      return
    }

    await fetchSettingsData()
  }

  return (
    <>
      <Header title="Settings" />

      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage program and organization settings.</p>
        </div>

        {!tablesAvailable && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4 text-sm text-amber-700">
              Some settings tables are not connected yet. The page will stay empty until the
              required Supabase tables are created.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="size-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <FolderOpen className="size-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="registration" className="gap-2">
              <ShieldCheck className="size-4" />
              Registration
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="size-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="discounts" className="gap-2">
              <Percent className="size-4" />
                Promo Codes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Program Defaults</CardTitle>
                  <CardDescription>Default settings for new programs.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="default-capacity">Default Capacity</Label>
                      <Input
                        id="default-capacity"
                        type="number"
                        min="0"
                        value={settings.default_capacity}
                        onChange={(event) =>
                          updateSetting("default_capacity", safeNumber(event.target.value))
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="default-duration">Default Duration</Label>
                      <Select
                        value={settings.default_duration}
                        onValueChange={(value) => updateSetting("default_duration", value)}
                      >
                        <SelectTrigger id="default-duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4-weeks">4 weeks</SelectItem>
                          <SelectItem value="8-weeks">8 weeks</SelectItem>
                          <SelectItem value="12-weeks">12 weeks</SelectItem>
                          <SelectItem value="semester">Semester</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <SettingSwitch
                    label="Allow Waitlist"
                    description="Enable waitlist when programs reach capacity"
                    checked={settings.allow_waitlist}
                    onCheckedChange={(checked) => updateSetting("allow_waitlist", checked)}
                  />

                  <SettingSwitch
                    label="Require Payment at Registration"
                    description="Registrations require immediate payment"
                    checked={settings.require_payment_at_registration}
                    onCheckedChange={(checked) =>
                      updateSetting("require_payment_at_registration", checked)
                    }
                  />

                  <SettingSwitch
                    label="Allow Partial Payments"
                    description="Accept partial payments and payment plans"
                    checked={settings.allow_partial_payments}
                    onCheckedChange={(checked) => updateSetting("allow_partial_payments", checked)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Age Verification</CardTitle>
                  <CardDescription>Settings for participant age requirements.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <SettingSwitch
                    label="Enforce Age Restrictions"
                    description="Verify participant age during registration"
                    checked={settings.enforce_age_restrictions}
                    onCheckedChange={(checked) => updateSetting("enforce_age_restrictions", checked)}
                  />

                  <SettingSwitch
                    label="Require Parent/Guardian for Minors"
                    description="Minors must have a parent/guardian on file"
                    checked={settings.require_guardian_for_minors}
                    onCheckedChange={(checked) =>
                      updateSetting("require_guardian_for_minors", checked)
                    }
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="departments">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Departments</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage departments for organizing programs.
                  </p>
                </div>

                <Button onClick={openAddDepartmentDialog}>
                  <Plus className="mr-2 size-4" />
                  Add Department
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Color</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Programs</TableHead>
                        <TableHead className="w-[110px]" />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            Loading departments...
                          </TableCell>
                        </TableRow>
                      ) : departments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            No departments yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        departments.map((department) => (
                          <TableRow key={department.id}>
                            <TableCell>
                              <div
                                className="size-6 rounded-full border"
                                style={{ backgroundColor: department.color || "#3b82f6" }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{department.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {department.description || "-"}
                            </TableCell>
                            <TableCell>{department.programs_count || 0}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => openEditDepartmentDialog(department)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-red-600"
                                  onClick={() => handleDeleteDepartment(department)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="registration">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Registration Form</CardTitle>
                  <CardDescription>Configure registration form fields.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <SettingSwitch
                    label="Collect Emergency Contact"
                    description="Require emergency contact information"
                    checked={settings.collect_emergency_contact}
                    onCheckedChange={(checked) => updateSetting("collect_emergency_contact", checked)}
                  />

                  <SettingSwitch
                    label="Collect Medical Information"
                    description="Ask for allergies and medical conditions"
                    checked={settings.collect_medical_information}
                    onCheckedChange={(checked) => updateSetting("collect_medical_information", checked)}
                  />

                  <SettingSwitch
                    label="Photo/Video Consent"
                    description="Include media consent form during registration"
                    checked={settings.require_media_consent}
                    onCheckedChange={(checked) => updateSetting("require_media_consent", checked)}
                  />

                  <SettingSwitch
                    label="Liability Waiver"
                    description="Require liability waiver signature"
                    checked={settings.require_liability_waiver}
                    onCheckedChange={(checked) => updateSetting("require_liability_waiver", checked)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cancellation Policy</CardTitle>
                  <CardDescription>Set refund and cancellation rules.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Full Refund Period</Label>
                      <Select
                        value={settings.full_refund_days}
                        onValueChange={(value) => updateSetting("full_refund_days", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 days before start</SelectItem>
                          <SelectItem value="7">7 days before start</SelectItem>
                          <SelectItem value="14">14 days before start</SelectItem>
                          <SelectItem value="30">30 days before start</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Partial Refund Period</Label>
                      <Select
                        value={settings.partial_refund_days}
                        onValueChange={(value) => updateSetting("partial_refund_days", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 day before start</SelectItem>
                          <SelectItem value="3">3 days before start</SelectItem>
                          <SelectItem value="7">7 days before start</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Cancellation Fee</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={settings.cancellation_fee_amount}
                        onChange={(event) =>
                          updateSetting("cancellation_fee_amount", safeNumber(event.target.value))
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">or</span>
                      <Input
                        type="number"
                        min="0"
                        value={settings.cancellation_fee_percent}
                        onChange={(event) =>
                          updateSetting("cancellation_fee_percent", safeNumber(event.target.value))
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Configure when emails are sent.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <SettingSwitch
                    label="Registration Confirmation"
                    description="Send confirmation email upon registration"
                    checked={settings.send_registration_confirmation}
                    onCheckedChange={(checked) =>
                      updateSetting("send_registration_confirmation", checked)
                    }
                  />

                  <SettingSwitch
                    label="Payment Receipt"
                    description="Send receipt after payment is processed"
                    checked={settings.send_payment_receipt}
                    onCheckedChange={(checked) => updateSetting("send_payment_receipt", checked)}
                  />

                  <SettingSwitch
                    label="Class Reminders"
                    description="Send reminder before scheduled classes"
                    checked={settings.send_class_reminders}
                    onCheckedChange={(checked) => updateSetting("send_class_reminders", checked)}
                  />

                  <SettingSwitch
                    label="Program Updates"
                    description="Notify when program details change"
                    checked={settings.send_program_updates}
                    onCheckedChange={(checked) => updateSetting("send_program_updates", checked)}
                  />

                  <SettingSwitch
                    label="Waitlist Notifications"
                    description="Notify when spot becomes available"
                    checked={settings.send_waitlist_notifications}
                    onCheckedChange={(checked) =>
                      updateSetting("send_waitlist_notifications", checked)
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reminder Timing</CardTitle>
                  <CardDescription>When to send class reminders.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>First Reminder</Label>
                    <Select
                      value={settings.first_reminder}
                      onValueChange={(value) => updateSetting("first_reminder", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 hour before</SelectItem>
                        <SelectItem value="2h">2 hours before</SelectItem>
                        <SelectItem value="24h">24 hours before</SelectItem>
                        <SelectItem value="48h">48 hours before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Second Reminder</Label>
                    <Select
                      value={settings.second_reminder}
                      onValueChange={(value) => updateSetting("second_reminder", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="1h">1 hour before</SelectItem>
                        <SelectItem value="2h">2 hours before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="discounts">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Promo Codes</h2>
                  <p className="text-sm text-muted-foreground">
                    Create and manage registration promo codes.
                  </p>
                </div>

                <Button onClick={openAddDiscountDialog}>
                  <Plus className="mr-2 size-4" />
                  Add Promo Code
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[110px]" />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            Loading discount codes...
                          </TableCell>
                        </TableRow>
                      ) : discountCodes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            No discount codes yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        discountCodes.map((discount) => (
                          <TableRow key={discount.id}>
                            <TableCell className="font-medium">{discount.code}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {discount.description || "-"}
                            </TableCell>
                            <TableCell>
                              {discount.discount_type === "percent"
                                ? `${discount.discount_value}%`
                                : `$${discount.discount_value}`}
                            </TableCell>
                            <TableCell>
                              {discount.used_count}
                              {discount.max_uses ? `/${discount.max_uses}` : ""}
                            </TableCell>
                            <TableCell>{formatDate(discount.expires_at)}</TableCell>
                            <TableCell>
                              <Badge variant={discount.active ? "default" : "secondary"}>
                                {discount.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => openEditDiscountDialog(discount)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-red-600"
                                  onClick={() => handleDeleteDiscount(discount.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment.id ? "Edit Department" : "Add Department"}</DialogTitle>
            <DialogDescription>
              {editingDepartment.id
                ? "Update this department."
                : "Create a new program department."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="department-name">Name</Label>
              <Input
                id="department-name"
                value={editingDepartment.name}
                onChange={(event) =>
                  setEditingDepartment({ ...editingDepartment, name: event.target.value })
                }
                placeholder="e.g., Youth Services"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="department-color">Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="department-color"
                  type="color"
                  className="h-10 w-20 cursor-pointer p-1"
                  value={editingDepartment.color}
                  onChange={(event) =>
                    setEditingDepartment({ ...editingDepartment, color: event.target.value })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  Choose a color for the department
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="department-description">Description</Label>
              <Textarea
                id="department-description"
                value={editingDepartment.description}
                onChange={(event) =>
                  setEditingDepartment({ ...editingDepartment, description: event.target.value })
                }
                placeholder="Brief description of this department"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDepartment} disabled={saving}>
              {saving ? "Saving..." : editingDepartment.id ? "Save Changes" : "Add Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDiscount.id ? "Edit Discount Code" : "Add Discount Code"}</DialogTitle>
            <DialogDescription>
              {editingDiscount.id ? "Update this discount code." : "Create a new discount code."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="discount-code">Code</Label>
              <Input
                id="discount-code"
                value={editingDiscount.code}
                onChange={(event) =>
                  setEditingDiscount({ ...editingDiscount, code: event.target.value.toUpperCase() })
                }
                placeholder="e.g., SUMMER10"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="discount-description">Description</Label>
              <Textarea
                id="discount-description"
                value={editingDiscount.description}
                onChange={(event) =>
                  setEditingDiscount({ ...editingDiscount, description: event.target.value })
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Discount Type</Label>
                <Select
                  value={editingDiscount.discount_type}
                  onValueChange={(value) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      discount_type: value as "percent" | "amount",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="discount-value">Value</Label>
                <div className="flex items-center gap-2">
                  {editingDiscount.discount_type === "amount" && (
                    <span className="text-muted-foreground">$</span>
                  )}
                  <Input
                    id="discount-value"
                    type="number"
                    min="0"
                    value={editingDiscount.discount_value}
                    onChange={(event) =>
                      setEditingDiscount({
                        ...editingDiscount,
                        discount_value: safeNumber(event.target.value),
                      })
                    }
                  />
                  {editingDiscount.discount_type === "percent" && (
                    <span className="text-muted-foreground">%</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="starts-at">Start Date</Label>
                <Input
                  id="starts-at"
                  type="date"
                  value={editingDiscount.starts_at}
                  onChange={(event) =>
                    setEditingDiscount({ ...editingDiscount, starts_at: event.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="expires-at">Expiration Date</Label>
                <Input
                  id="expires-at"
                  type="date"
                  value={editingDiscount.expires_at}
                  onChange={(event) =>
                    setEditingDiscount({ ...editingDiscount, expires_at: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="max-uses">Max Uses</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="0"
                  value={editingDiscount.max_uses}
                  onChange={(event) =>
                    setEditingDiscount({ ...editingDiscount, max_uses: event.target.value })
                  }
                  placeholder="Unlimited"
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Active</Label>
                    <p className="text-sm text-muted-foreground">Allow this code to be used</p>
                  </div>
                  <Switch
                    checked={editingDiscount.active}
                    onCheckedChange={(checked) =>
                      setEditingDiscount({ ...editingDiscount, active: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDiscount} disabled={saving}>
              {saving ? "Saving..." : editingDiscount.id ? "Save Changes" : "Add Discount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
