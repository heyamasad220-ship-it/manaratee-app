"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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
import { DEFAULT_DONATION_RECEIPT_SETTINGS } from "@/lib/donations/receipt-settings"
import { DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE } from "@/lib/donations/receipt-types"

type DonationReceiptSettingsFormProps = {
  mode: "general" | "receipts"
}

export function DonationReceiptSettingsForm({ mode }: DonationReceiptSettingsFormProps) {
  const [settings, setSettings] = useState<DonationReceiptSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getDonationReceiptSettingsAction()
      if (result.success) {
        setSettings(result.settings)
      }
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
    alert("Settings saved")
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading receipt settings...</div>
  }

  if (!settings) {
    return (
      <div className="text-sm text-muted-foreground">
        Could not load receipt settings.
      </div>
    )
  }

  if (mode === "general") {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Information displayed on donation receipts</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-legal-name">Organization Legal Name</Label>
                <Input
                  id="org-legal-name"
                  value={settings.legal_name || ""}
                  onChange={(e) => updateField("legal_name", e.target.value || null)}
                  placeholder="Organization legal name"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tax-id">Tax ID / EIN</Label>
                <Input
                  id="tax-id"
                  value={settings.tax_id || ""}
                  onChange={(e) => updateField("tax_id", e.target.value || null)}
                  placeholder="Tax ID / EIN"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address-line1">Address Line 1</Label>
              <Input
                id="address-line1"
                value={settings.address_line1 || ""}
                onChange={(e) => updateField("address_line1", e.target.value || null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address-line2">Address Line 2</Label>
              <Input
                id="address-line2"
                value={settings.address_line2 || ""}
                onChange={(e) => updateField("address_line2", e.target.value || null)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={settings.city || ""}
                  onChange={(e) => updateField("city", e.target.value || null)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={settings.state || ""}
                  onChange={(e) => updateField("state", e.target.value || null)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="postal-code">Postal Code</Label>
                <Input
                  id="postal-code"
                  value={settings.postal_code || ""}
                  onChange={(e) => updateField("postal_code", e.target.value || null)}
                />
              </div>
            </div>
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Receipt Settings</CardTitle>
          <CardDescription>Configure donation receipt generation</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Generate Receipts</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically generate receipts for all donations
                </p>
              </div>
              <Switch
                checked={settings.auto_generate_receipts}
                onCheckedChange={(checked) => updateField("auto_generate_receipts", checked)}
              />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Receipts Automatically</Label>
                <p className="text-sm text-muted-foreground">
                  Send receipts to donors via email upon donation
                </p>
              </div>
              <Switch
                checked={settings.email_receipts_automatically}
                onCheckedChange={(checked) =>
                  updateField("email_receipts_automatically", checked)
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-prefix">Receipt Number Prefix</Label>
              <Input
                id="receipt-prefix"
                value={settings.receipt_number_prefix}
                onChange={(e) => updateField("receipt_number_prefix", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-format">Receipt Number Format</Label>
              <Input
                id="receipt-format"
                value={settings.receipt_number_format}
                onChange={(e) => updateField("receipt_number_format", e.target.value)}
                placeholder="{prefix}-{year}-{sequence}"
              />
              <p className="text-xs text-muted-foreground">
                Tokens: {"{prefix}"}, {"{year}"}, {"{sequence}"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="signer-name">Authorized Signer Name</Label>
              <Input
                id="signer-name"
                value={settings.authorized_signer_name || ""}
                onChange={(e) => updateField("authorized_signer_name", e.target.value || null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="signer-title">Authorized Signer Title</Label>
              <Input
                id="signer-title"
                value={settings.authorized_signer_title || ""}
                onChange={(e) => updateField("authorized_signer_title", e.target.value || null)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-footer">Receipt Footer / Tax Disclaimer</Label>
            <Textarea
              id="receipt-footer"
              rows={3}
              value={settings.receipt_footer_text || DEFAULT_DONATION_RECEIPT_SETTINGS.receipt_footer_text}
              onChange={(e) => updateField("receipt_footer_text", e.target.value || null)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-email-template">Receipt Email Template</Label>
            <Textarea
              id="receipt-email-template"
              rows={4}
              value={
                settings.receipt_email_template ||
                DEFAULT_DONATION_RECEIPT_SETTINGS.receipt_email_template
              }
              onChange={(e) => updateField("receipt_email_template", e.target.value || null)}
            />
            <p className="text-xs text-muted-foreground">
              Tokens: {"{{donor_name}}"}, {"{{amount}}"}, {"{{payment_date}}"}, {"{{receipt_number}}"}, {"{{organization_name}}"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Year-End Statements</CardTitle>
          <CardDescription>Configure annual donation statements</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Generate Year-End Statements</Label>
                <p className="text-sm text-muted-foreground">
                  Enable annual donation summaries for donors
                </p>
              </div>
              <Switch
                checked={settings.generate_year_end_statements}
                onCheckedChange={(checked) =>
                  updateField("generate_year_end_statements", checked)
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="statement-threshold">Minimum for Statement</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="statement-threshold"
                  type="number"
                  className="pl-7"
                  value={settings.year_end_statement_threshold}
                  onChange={(e) =>
                    updateField("year_end_statement_threshold", Number(e.target.value || 0))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="statement-email-template">Year-End Statement Email Template</Label>
            <Textarea
              id="statement-email-template"
              rows={4}
              value={
                settings.year_end_statement_email_template ||
                DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE
              }
              onChange={(e) =>
                updateField("year_end_statement_email_template", e.target.value || null)
              }
            />
            <p className="text-xs text-muted-foreground">
              Tokens: {"{{donor_name}}"}, {"{{tax_year}}"}, {"{{total_giving}}"}, {"{{organization_name}}"}, {"{{receipt_number}}"}
            </p>
          </div>
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
