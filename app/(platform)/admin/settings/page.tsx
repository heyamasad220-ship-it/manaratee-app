"use client"

import { useState } from "react"
import { Settings, Building2, CreditCard, Mail, Save, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface DefaultSetting {
  id: string
  name: string
  description: string
  enabled: boolean
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  description: string
}

export default function SettingsPage() {
  const [defaultSettings, setDefaultSettings] = useState<DefaultSetting[]>([
    {
      id: "auto-approve-bookings",
      name: "Auto-approve Bookings",
      description: "Automatically approve booking requests without admin review",
      enabled: false,
    },
    {
      id: "allow-rentals",
      name: "Allow Venue Rentals",
      description: "Enable venue rental functionality for organizations",
      enabled: true,
    },
    {
      id: "enable-payments",
      name: "Enable Online Payments",
      description: "Allow organizations to collect payments through the platform",
      enabled: true,
    },
    {
      id: "require-email-verification",
      name: "Require Email Verification",
      description: "New users must verify their email before accessing features",
      enabled: true,
    },
    {
      id: "allow-public-registration",
      name: "Allow Public Registration",
      description: "Allow new organizations to self-register on the platform",
      enabled: false,
    },
    {
      id: "enable-trial-period",
      name: "Enable Trial Period",
      description: "Give new organizations a trial period before requiring payment",
      enabled: true,
    },
  ])

  const [trialDays, setTrialDays] = useState("14")
  const [defaultPlan, setDefaultPlan] = useState("free")
  const [stripeConnected, setStripeConnected] = useState(false)

  const [emailTemplates] = useState<EmailTemplate[]>([
    {
      id: "welcome",
      name: "Welcome Email",
      subject: "Welcome to Manaratee Platform",
      description: "Sent when a new organization signs up",
    },
    {
      id: "invoice",
      name: "Invoice Email",
      subject: "Your Invoice from Manaratee",
      description: "Sent when a new invoice is generated",
    },
    {
      id: "payment-receipt",
      name: "Payment Receipt",
      subject: "Payment Received - Thank You",
      description: "Sent when a payment is successfully processed",
    },
    {
      id: "payment-failed",
      name: "Payment Failed",
      subject: "Action Required: Payment Failed",
      description: "Sent when a payment attempt fails",
    },
    {
      id: "subscription-canceled",
      name: "Subscription Canceled",
      subject: "Your Subscription Has Been Canceled",
      description: "Sent when a subscription is canceled",
    },
    {
      id: "trial-ending",
      name: "Trial Ending Soon",
      subject: "Your Trial Ends in 3 Days",
      description: "Sent 3 days before trial period ends",
    },
  ])

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState("")

  const toggleSetting = (id: string) => {
    setDefaultSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setTemplateSubject(template.subject)
    setTemplateBody(`Dear {{organization_name}},

Thank you for using Manaratee Platform.

{{content}}

Best regards,
The Manaratee Team`)
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure global platform settings and defaults
        </p>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organization Defaults
          </TabsTrigger>
          <TabsTrigger value="stripe" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Stripe Configuration
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
        </TabsList>

        {/* Organization Defaults Tab */}
        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-emerald-600" />
                Default Organization Settings
              </CardTitle>
              <CardDescription>
                Configure default settings applied to new organizations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {defaultSettings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">{setting.name}</Label>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <Switch
                      checked={setting.enabled}
                      onCheckedChange={() => toggleSetting(setting.id)}
                    />
                  </div>
                ))}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="trial-days">Default Trial Period (days)</Label>
                  <Select value={trialDays} onValueChange={setTrialDays}>
                    <SelectTrigger id="trial-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Length of trial period for new organizations
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-plan">Default Plan</Label>
                  <Select value={defaultPlan} onValueChange={setDefaultPlan}>
                    <SelectTrigger id="default-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Plan assigned to new organizations by default
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700 gap-2">
                  <Save className="h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stripe Configuration Tab */}
        <TabsContent value="stripe" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                Stripe Configuration
              </CardTitle>
              <CardDescription>
                Connect your Stripe account to enable payment processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-[#635BFF] flex items-center justify-center">
                    <svg viewBox="0 0 60 25" className="h-6 w-10 text-white fill-current">
                      <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.02 1.04-.06 1.48zm-3.67-3.14c0-1.25-.64-2.88-2.2-2.88-1.56 0-2.3 1.63-2.42 2.88h4.62zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.1 1.03a4.32 4.32 0 0 1 3.23-1.29c2.9 0 5.54 2.75 5.54 7.38 0 5.14-2.8 7.62-5.59 7.62zm-.85-11.1c-1 0-1.63.35-2.08.83l.02 6.16c.42.44 1.03.82 2.06.82 1.56 0 2.62-1.84 2.62-3.94 0-2.05-1.04-3.86-2.62-3.86zm-13.8 11.1c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.1 1.03a4.32 4.32 0 0 1 3.23-1.29c2.9 0 5.54 2.75 5.54 7.38 0 5.14-2.8 7.62-5.59 7.62zm-.85-11.1c-1 0-1.63.35-2.08.83l.02 6.16c.42.44 1.03.82 2.06.82 1.56 0 2.62-1.84 2.62-3.94 0-2.05-1.04-3.86-2.62-3.86zM11.29 9.67L8.27 5.57H3.79l5.23 7.26-5.23 7.26h4.48l3.02-4.1 3.02 4.1h4.48l-5.23-7.26 5.23-7.26h-4.48l-3.02 4.1z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Stripe Account</p>
                    <p className="text-sm text-muted-foreground">
                      {stripeConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {stripeConnected ? (
                    <>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        Connected
                      </Badge>
                      <Button variant="outline" size="sm">
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="bg-[#635BFF] text-white hover:bg-[#5851db] gap-2"
                      onClick={() => setStripeConnected(true)}
                    >
                      Connect Stripe
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">API Keys</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripe-pk">Publishable Key</Label>
                    <Input
                      id="stripe-pk"
                      placeholder="pk_live_..."
                      disabled={!stripeConnected}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripe-sk">Secret Key</Label>
                    <Input
                      id="stripe-sk"
                      type="password"
                      placeholder="sk_live_..."
                      disabled={!stripeConnected}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your secret key is encrypted and stored securely
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripe-webhook">Webhook Secret</Label>
                    <Input
                      id="stripe-webhook"
                      type="password"
                      placeholder="whsec_..."
                      disabled={!stripeConnected}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Webhook Endpoint</h3>
                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm font-mono text-muted-foreground break-all">
                    https://your-domain.com/api/webhooks/stripe
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this URL to your Stripe webhook settings to receive payment events
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700 gap-2"
                  disabled={!stripeConnected}
                >
                  <Save className="h-4 w-4" />
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="email" className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Templates</CardTitle>
                <CardDescription>Select a template to edit</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {emailTemplates.map((template) => (
                    <button
                      key={template.id}
                      className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                        selectedTemplate?.id === template.id ? "bg-muted" : ""
                      }`}
                      onClick={() => handleEditTemplate(template)}
                    >
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {template.description}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-emerald-600" />
                  {selectedTemplate ? selectedTemplate.name : "Template Editor"}
                </CardTitle>
                <CardDescription>
                  {selectedTemplate
                    ? "Customize the email template content"
                    : "Select a template from the list to edit"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTemplate ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email-subject">Subject Line</Label>
                      <Input
                        id="email-subject"
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-body">Email Body</Label>
                      <Textarea
                        id="email-body"
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                        rows={12}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium mb-2">Available Variables:</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "{{organization_name}}",
                          "{{user_name}}",
                          "{{user_email}}",
                          "{{plan_name}}",
                          "{{amount}}",
                          "{{date}}",
                        ].map((variable) => (
                          <Badge key={variable} variant="secondary" className="font-mono text-xs">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline">Send Test Email</Button>
                      <Button className="bg-emerald-600 text-white hover:bg-emerald-700 gap-2">
                        <Save className="h-4 w-4" />
                        Save Template
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Select a template from the list to start editing
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
