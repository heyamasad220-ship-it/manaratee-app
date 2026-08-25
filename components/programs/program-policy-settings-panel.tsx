"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"
import { createClient } from "@/lib/supabase/client"

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

function safeNumber(value: string | number) {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : 0
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

function StubNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Defaults for this department — wiring to registration coming later.
    </p>
  )
}

export function ProgramPolicySettingsPanel({
  departmentId,
  section,
}: {
  departmentId: string
  section: "registration" | "notifications"
}) {
  const supabase = createClient()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [tablesAvailable, setTablesAvailable] = React.useState(true)
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [settingsRowId, setSettingsRowId] = React.useState<string | null>(null)
  const [settings, setSettings] = React.useState<ProgramSettings>(defaultSettings)

  React.useEffect(() => {
    void fetchSettingsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId])

  async function fetchSettingsData() {
    setLoading(true)

    try {
      const orgId = await getSelectedOrganizationIdClient()
      if (!orgId) {
        setTablesAvailable(false)
        return
      }

      setOrganizationId(orgId)

      const settingsResult = await supabase
        .from("department_program_settings")
        .select("id, settings")
        .eq("organization_id", orgId)
        .eq("department_id", departmentId)
        .maybeSingle()

      const missingTable =
        settingsResult.error?.code === "42P01" ||
        settingsResult.error?.code === "42703" ||
        settingsResult.error?.code === "PGRST205"

      setTablesAvailable(!missingTable)

      if (!settingsResult.error && settingsResult.data) {
        setSettingsRowId(settingsResult.data.id as string)
        if (settingsResult.data.settings) {
          setSettings({
            ...defaultSettings,
            ...(settingsResult.data.settings as Partial<ProgramSettings>),
          })
        }
      } else if (settingsResult.error && !missingTable) {
        console.warn(
          "department_program_settings could not be loaded:",
          settingsResult.error.message
        )
      }
    } catch (error) {
      console.error("Program policy settings error:", error)
      setTablesAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  function updateSetting<K extends keyof ProgramSettings>(
    key: K,
    value: ProgramSettings[K]
  ) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function handleSaveSettings() {
    if (!organizationId) return

    setSaving(true)

    try {
      const payload = {
        organization_id: organizationId,
        department_id: departmentId,
        settings,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = settingsRowId
        ? await supabase
            .from("department_program_settings")
            .update(payload)
            .eq("id", settingsRowId)
            .eq("organization_id", organizationId)
            .eq("department_id", departmentId)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("department_program_settings")
            .upsert(payload, {
              onConflict: "organization_id,department_id",
            })
            .select("id")
            .maybeSingle()

      if (error) throw error
      if (data?.id) {
        setSettingsRowId(data.id as string)
      }
      alert("Settings saved.")
    } catch (error: unknown) {
      console.error("Save program policy settings error:", error)
      const message =
        error instanceof Error ? error.message : "Could not save settings."
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  if (section === "notifications") {
    return (
      <div className="flex flex-col gap-6">
        <StubNote />
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
              onCheckedChange={(checked) =>
                updateSetting("send_payment_receipt", checked)
              }
            />
            <SettingSwitch
              label="Class Reminders"
              description="Send reminder before scheduled classes"
              checked={settings.send_class_reminders}
              onCheckedChange={(checked) =>
                updateSetting("send_class_reminders", checked)
              }
            />
            <SettingSwitch
              label="Program Updates"
              description="Notify when program details change"
              checked={settings.send_program_updates}
              onCheckedChange={(checked) =>
                updateSetting("send_program_updates", checked)
              }
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
          <Button
            onClick={() => void handleSaveSettings()}
            disabled={saving || loading || !tablesAvailable}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StubNote />
      <Card>
        <CardHeader>
          <CardTitle>Waitlist and payment</CardTitle>
          <CardDescription>
            Capacity, waitlist, and payment rules used at registration.
          </CardDescription>
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
            onCheckedChange={(checked) =>
              updateSetting("allow_partial_payments", checked)
            }
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
            onCheckedChange={(checked) =>
              updateSetting("enforce_age_restrictions", checked)
            }
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
            onCheckedChange={(checked) =>
              updateSetting("collect_emergency_contact", checked)
            }
          />
          <SettingSwitch
            label="Collect Medical Information"
            description="Ask for allergies and medical conditions"
            checked={settings.collect_medical_information}
            onCheckedChange={(checked) =>
              updateSetting("collect_medical_information", checked)
            }
          />
          <SettingSwitch
            label="Photo/Video Consent"
            description="Include media consent form during registration"
            checked={settings.require_media_consent}
            onCheckedChange={(checked) =>
              updateSetting("require_media_consent", checked)
            }
          />
          <SettingSwitch
            label="Liability Waiver"
            description="Require liability waiver signature"
            checked={settings.require_liability_waiver}
            onCheckedChange={(checked) =>
              updateSetting("require_liability_waiver", checked)
            }
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
                onValueChange={(value) =>
                  updateSetting("partial_refund_days", value)
                }
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
                  updateSetting(
                    "cancellation_fee_amount",
                    safeNumber(event.target.value)
                  )
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">or</span>
              <Input
                type="number"
                min="0"
                value={settings.cancellation_fee_percent}
                onChange={(event) =>
                  updateSetting(
                    "cancellation_fee_percent",
                    safeNumber(event.target.value)
                  )
                }
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => void handleSaveSettings()}
          disabled={saving || loading || !tablesAvailable}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
