"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getDonationReceiptSettingsAction,
  saveDonationReceiptSettingsAction,
} from "@/lib/donations/receipt-actions"
import type { DonationReceiptSettings } from "@/lib/donations/receipt-types"
import {
  DEFAULT_PLEDGE_PAYMENT_INSTRUCTIONS,
  DEFAULT_PLEDGE_REMINDER_FOOTER,
  DEFAULT_PLEDGE_REMINDER_MESSAGE,
  DEFAULT_PLEDGE_REMINDER_SUBJECT,
} from "@/lib/donations/pledge-reminder-types"

export function PledgeReminderSettingsForm() {
  const [settings, setSettings] = useState<DonationReceiptSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getDonationReceiptSettingsAction()
      if (result.success) setSettings(result.settings)
      setLoading(false)
    }
    load()
  }, [])

  function updateField<K extends keyof DonationReceiptSettings>(
    key: K,
    value: DonationReceiptSettings[K]
  ) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    const { organization_id: _orgId, ...payload } = settings
    const result = await saveDonationReceiptSettingsAction(payload)
    setSaving(false)
    if (!result.success) {
      alert(result.error || "Could not save settings")
      return
    }
    alert("Pledge reminder settings saved")
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading pledge reminder settings...</div>
  }

  if (!settings) {
    return <div className="text-sm text-muted-foreground">Could not load settings.</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Pledge Reminders</CardTitle>
          <CardDescription>
            Configure how staff track and send pledge collection reminders
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Pledge Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Allow staff to preview and record pledge reminders
                </p>
              </div>
              <Switch
                checked={settings.enable_pledge_reminders}
                onCheckedChange={(checked) => updateField("enable_pledge_reminders", checked)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-schedule">Default Schedule</Label>
              <Select
                value={settings.pledge_reminder_schedule}
                onValueChange={(value: DonationReceiptSettings["pledge_reminder_schedule"]) =>
                  updateField("pledge_reminder_schedule", value)
                }
              >
                <SelectTrigger id="reminder-schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">One-time manual reminder</SelectItem>
                  <SelectItem value="monthly">Monthly reminder</SelectItem>
                  <SelectItem value="days_before_due">Days before pledge date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.pledge_reminder_schedule === "days_before_due" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="days-before-due">Days Before Pledge Date</Label>
                <Input
                  id="days-before-due"
                  type="number"
                  min={1}
                  value={settings.pledge_reminder_days_before_due ?? 7}
                  onChange={(e) =>
                    updateField("pledge_reminder_days_before_due", Number(e.target.value || 7))
                  }
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reminder-subject">Reminder Email Subject</Label>
            <Input
              id="reminder-subject"
              value={settings.pledge_reminder_subject || DEFAULT_PLEDGE_REMINDER_SUBJECT}
              onChange={(e) => updateField("pledge_reminder_subject", e.target.value || null)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reminder-message">Default Reminder Message</Label>
            <Textarea
              id="reminder-message"
              rows={8}
              value={settings.pledge_reminder_message || DEFAULT_PLEDGE_REMINDER_MESSAGE}
              onChange={(e) => updateField("pledge_reminder_message", e.target.value || null)}
            />
            <p className="text-xs text-muted-foreground">
              Tokens: {"{{donor_name}}"}, {"{{organization_name}}"}, {"{{campaign_name}}"},
              {" {{pledge_amount}}"}, {"{{amount_paid}}"}, {"{{balance_remaining}}"},
              {" {{payment_instructions}}"}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-instructions">Payment Instructions</Label>
            <Textarea
              id="payment-instructions"
              rows={3}
              value={settings.pledge_payment_instructions || DEFAULT_PLEDGE_PAYMENT_INSTRUCTIONS}
              onChange={(e) => updateField("pledge_payment_instructions", e.target.value || null)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reminder-footer">Reminder Footer Text</Label>
            <Textarea
              id="reminder-footer"
              rows={2}
              value={settings.pledge_reminder_footer_text || DEFAULT_PLEDGE_REMINDER_FOOTER}
              onChange={(e) => updateField("pledge_reminder_footer_text", e.target.value || null)}
            />
          </div>

          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Outbound email is not connected yet. Sending a reminder records the message in
            Manaratee and labels it as recorded — not externally delivered.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
