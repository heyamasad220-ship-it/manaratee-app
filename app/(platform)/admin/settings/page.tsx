"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Settings, Building2, CreditCard, Mail, Save, CheckCircle2, Circle } from "lucide-react"
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
import {
  getPlatformStripeConfigStatusAction,
  savePlatformStripeConfigAction,
  testPlatformStripeConnectionAction,
} from "@/lib/platform/platform-stripe-config-actions"

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
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading platform settings...</div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  )
}

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "stripe" ? "stripe" : "organization"

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
  const [stripeFormOpen, setStripeFormOpen] = useState(false)
  const [stripePublishableKey, setStripePublishableKey] = useState("")
  const [stripeSecretKey, setStripeSecretKey] = useState("")
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("")
  const [stripeWebhookUrl, setStripeWebhookUrl] = useState(
    "https://your-domain.com/api/webhooks/stripe/donations"
  )
  const [stripeEnvConfigured, setStripeEnvConfigured] = useState(false)
  const [stripeWebhookSecretConfigured, setStripeWebhookSecretConfigured] = useState(false)
  const [stripeAppUrlConfigured, setStripeAppUrlConfigured] = useState(false)
  const [stripeShowValidationForm, setStripeShowValidationForm] = useState(false)
  const [stripeTesting, setStripeTesting] = useState(false)
  const [stripeTestMessage, setStripeTestMessage] = useState<string | null>(null)
  const [stripeSaving, setStripeSaving] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)

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

  useEffect(() => {
    let cancelled = false

    async function loadStripeStatus() {
      setStripeStatusLoading(true)
      const result = await getPlatformStripeConfigStatusAction()
      if (cancelled) return

      setStripeStatusLoading(false)

      if (!result.success) {
        setStripeError(result.error)
        return
      }

      setStripeWebhookUrl(result.webhookUrl)
      setStripeEnvConfigured(result.platformStripeConfigured)
      setStripeWebhookSecretConfigured(result.webhookSecretConfigured)
      setStripeAppUrlConfigured(result.appUrlConfigured)
      setStripeShowValidationForm(!result.platformStripeConfigured)
    }

    void loadStripeStatus()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveStripeConfiguration() {
    setStripeSaving(true)
    setStripeError(null)

    const result = await savePlatformStripeConfigAction({
      publishableKey: stripePublishableKey,
      secretKey: stripeSecretKey,
      webhookSecret: stripeWebhookSecret,
    })

    setStripeSaving(false)

    if (!result.success) {
      setStripeError(result.error)
      return
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }

    router.push("/admin/dashboard")
  }

  function handleLeaveStripeConfiguration() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }

    router.push("/admin/dashboard")
  }

  async function handleTestStripeConnection() {
    setStripeTesting(true)
    setStripeError(null)
    setStripeTestMessage(null)

    const result = await testPlatformStripeConnectionAction()
    setStripeTesting(false)

    if (!result.success) {
      setStripeError(result.error)
      return
    }

    setStripeTestMessage(`Connected to Stripe account ${result.accountId}.`)
  }

  const stripeProductionReady =
    stripeEnvConfigured && stripeWebhookSecretConfigured && stripeAppUrlConfigured

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure global platform settings and defaults
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                Platform Stripe (Connect)
              </CardTitle>
              <CardDescription>
                Manaratee&apos;s platform Stripe account powers Connect for organizations. Keys are
                read from Vercel environment variables — this page does not store API keys.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-medium">Connecting MAS Dallas for donations?</p>
                <p className="mt-1 text-amber-900">
                  That is a separate step. After platform Stripe is set up here, MAS Dallas staff
                  should go to{" "}
                  <Link href="/donations/settings?tab=online-payments" className="underline">
                    Donations → Settings → Online Payments
                  </Link>{" "}
                  and connect their organization&apos;s Stripe Express account.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-[#635BFF] flex items-center justify-center">
                    <svg viewBox="0 0 60 25" className="h-6 w-10 text-white fill-current">
                      <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.02 1.04-.06 1.48zm-3.67-3.14c0-1.25-.64-2.88-2.2-2.88-1.56 0-2.3 1.63-2.42 2.88h4.62zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.1 1.03a4.32 4.32 0 0 1 3.23-1.29c2.9 0 5.54 2.75 5.54 7.38 0 5.14-2.8 7.62-5.59 7.62zm-.85-11.1c-1 0-1.63.35-2.08.83l.02 6.16c.42.44 1.03.82 2.06.82 1.56 0 2.62-1.84 2.62-3.94 0-2.05-1.04-3.86-2.62-3.86zm-13.8 11.1c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.1 1.03a4.32 4.32 0 0 1 3.23-1.29c2.9 0 5.54 2.75 5.54 7.38 0 5.14-2.8 7.62-5.59 7.62zm-.85-11.1c-1 0-1.63.35-2.08.83l.02 6.16c.42.44 1.03.82 2.06.82 1.56 0 2.62-1.84 2.62-3.94 0-2.05-1.04-3.86-2.62-3.86zM11.29 9.67L8.27 5.57H3.79l5.23 7.26-5.23 7.26h4.48l3.02-4.1 3.02 4.1h4.48l-5.23-7.26 5.23-7.26h-4.48l-3.02 4.1z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Production environment</p>
                    <p className="text-sm text-muted-foreground">
                      {stripeStatusLoading
                        ? "Checking Vercel environment variables..."
                        : stripeProductionReady
                          ? "Platform Stripe is configured on app.manaratee.com"
                          : stripeEnvConfigured
                            ? "Partially configured — check missing variables below"
                            : "STRIPE_SECRET_KEY is not set on this deployment"}
                    </p>
                  </div>
                </div>
                {stripeStatusLoading ? null : stripeProductionReady ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                    Ready
                  </Badge>
                ) : stripeEnvConfigured ? (
                  <Badge variant="outline">Partial</Badge>
                ) : (
                  <Badge variant="outline">Not configured</Badge>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Vercel environment checklist</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    {stripeEnvConfigured ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      <code className="text-xs">STRIPE_SECRET_KEY</code> — platform Connect secret
                      key
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    {stripeWebhookSecretConfigured ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      <code className="text-xs">STRIPE_WEBHOOK_SECRET</code> — from Stripe webhook
                      endpoint
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    {stripeAppUrlConfigured ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      <code className="text-xs">NEXT_PUBLIC_APP_URL</code> —{" "}
                      https://app.manaratee.com
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Set these in Vercel → Project → Settings → Environment Variables, then redeploy.
                  Do not paste keys into browser forms on this page unless validating before
                  updating Vercel.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Webhook endpoint (Stripe Dashboard)</h3>
                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm font-mono text-muted-foreground break-all">
                    {stripeWebhookUrl}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enable &quot;Listen to events on Connected accounts&quot; for organization
                  donation payouts.
                </p>
              </div>

              {stripeEnvConfigured ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleTestStripeConnection()}
                    disabled={stripeTesting || stripeStatusLoading}
                  >
                    {stripeTesting ? "Testing..." : "Test live Stripe connection"}
                  </Button>
                  {!stripeShowValidationForm ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setStripeShowValidationForm(true)
                        setStripeFormOpen(true)
                        setStripePublishableKey("")
                        setStripeSecretKey("")
                        setStripeWebhookSecret("")
                        setStripeError(null)
                      }}
                    >
                      Validate different keys (optional)
                    </Button>
                  ) : null}
                </div>
              ) : (
                <Button
                  className="bg-[#635BFF] text-white hover:bg-[#5851db]"
                  onClick={() => {
                    setStripeShowValidationForm(true)
                    setStripeFormOpen(true)
                  }}
                >
                  Validate keys before adding to Vercel
                </Button>
              )}

              {stripeTestMessage ? (
                <p className="text-sm text-emerald-700" role="status">
                  {stripeTestMessage}
                </p>
              ) : null}

              {stripeShowValidationForm ? (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium">Optional key validation</h3>
                      <p className="text-sm text-muted-foreground">
                        Paste keys from Stripe Dashboard to verify they work. This does not save them
                        to Manaratee — add validated keys to Vercel manually.
                      </p>
                    </div>
                    <form
                      autoComplete="off"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void handleSaveStripeConfiguration()
                      }}
                      className="grid gap-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="manaratee-stripe-pk">Publishable key</Label>
                        <Input
                          id="manaratee-stripe-pk"
                          name="manaratee-stripe-pk"
                          placeholder="pk_live_..."
                          disabled={stripeSaving}
                          className="font-mono text-sm"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-1p-ignore
                          data-lpignore="true"
                          value={stripePublishableKey}
                          onChange={(event) => setStripePublishableKey(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="manaratee-stripe-sk">Secret key</Label>
                        <Input
                          id="manaratee-stripe-sk"
                          name="manaratee-stripe-sk"
                          type="password"
                          placeholder="sk_live_..."
                          disabled={stripeSaving}
                          className="font-mono text-sm"
                          autoComplete="new-password"
                          data-1p-ignore
                          data-lpignore="true"
                          value={stripeSecretKey}
                          onChange={(event) => setStripeSecretKey(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="manaratee-stripe-whsec">Webhook signing secret</Label>
                        <Input
                          id="manaratee-stripe-whsec"
                          name="manaratee-stripe-whsec"
                          type="password"
                          placeholder="whsec_..."
                          disabled={stripeSaving}
                          className="font-mono text-sm"
                          autoComplete="new-password"
                          data-1p-ignore
                          data-lpignore="true"
                          value={stripeWebhookSecret}
                          onChange={(event) => setStripeWebhookSecret(event.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setStripeShowValidationForm(false)
                            setStripeFormOpen(false)
                            setStripePublishableKey("")
                            setStripeSecretKey("")
                            setStripeWebhookSecret("")
                            setStripeError(null)
                          }}
                          disabled={stripeSaving}
                        >
                          Close
                        </Button>
                        <Button
                          type="submit"
                          className="bg-emerald-600 text-white hover:bg-emerald-700 gap-2"
                          disabled={stripeSaving}
                        >
                          <Save className="h-4 w-4" />
                          {stripeSaving ? "Validating..." : "Validate keys"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </>
              ) : null}

              {stripeError ? (
                <p className="text-sm text-destructive" role="alert">
                  {stripeError}
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button variant="outline" onClick={handleLeaveStripeConfiguration}>
                  Back
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
