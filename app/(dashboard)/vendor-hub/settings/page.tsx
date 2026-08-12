"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { TimeInput } from "@/components/ui/time-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Store,
  Mail,
  Globe,
  FileText,
  DollarSign,
  Settings,
} from "lucide-react"
import { VendorTypesSettings } from "@/components/vendor-hub/vendor-types-settings"
import { BoothAttributesSettings } from "@/components/vendor-hub/booth-attributes-settings"
import { BoothTemplateLibrarySettings } from "@/components/vendor-hub/booth-template-library-settings"
import { BoothTypesSettingsPanel } from "@/components/vendor-hub/booth-types-settings-panel"
import { VendorHubNotificationsSettingsPanel } from "@/components/vendor-hub/vendor-hub-notifications-settings-panel"

export default function VendorHubSettingsPage() {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const defaultTab =
    requestedTab === "notifications" ||
    requestedTab === "booths" ||
    requestedTab === "email" ||
    requestedTab === "vendor-types" ||
    requestedTab === "general"
      ? requestedTab
      : "general"

  const [emailNotifications, setEmailNotifications] = useState(false)
  const [publicApplications, setPublicApplications] = useState(false)
  const [requireDeposit, setRequireDeposit] = useState(false)

  return (
    <div>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="booths">Booths</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="email">Email Templates</TabsTrigger>
            <TabsTrigger value="vendor-types">Vendor Types</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                  <CardDescription>Configure basic Vendor Hub defaults.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-name">Default Vendor Event Name</Label>
                    <Input id="default-name" placeholder="Enter default event name" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="default-start">Default Start Time</Label>
                      <TimeInput id="default-start" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="default-end">Default End Time</Label>
                      <TimeInput id="default-end" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="default-location">Default Location</Label>
                    <Input id="default-location" placeholder="Enter default location" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-5 w-5" />
                    Payment Settings
                  </CardTitle>
                  <CardDescription>Configure payment options and policies.</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payment-methods">Accepted Payment Methods</Label>
                    <Select>
                      <SelectTrigger id="payment-methods">
                        <SelectValue placeholder="Select payment methods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payment Methods</SelectItem>
                        <SelectItem value="card">Credit Card Only</SelectItem>
                        <SelectItem value="card-cash">Credit Card & Cash</SelectItem>
                        <SelectItem value="cash-check">Cash & Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="refund-policy">Refund Policy</Label>
                    <Select>
                      <SelectTrigger id="refund-policy">
                        <SelectValue placeholder="Select refund policy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full refund up to 7 days before</SelectItem>
                        <SelectItem value="partial">50% refund up to 7 days before</SelectItem>
                        <SelectItem value="none">No refunds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Email Payment Receipts</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically email receipts after payment.
                      </p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-5 w-5" />
                    Public Page Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how Vendor Hub appears on public pages.
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="public-description">Public Description</Label>
                    <Textarea
                      id="public-description"
                      placeholder="Enter public-facing description"
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="contact-email">Public Contact Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="Enter public contact email"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="contact-phone">Public Contact Phone</Label>
                    <Input id="contact-phone" placeholder="Enter public contact phone" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" />
                    Vendor Applications
                  </CardTitle>
                  <CardDescription>
                    Configure vendor application process and requirements.
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Public Applications</p>
                      <p className="text-sm text-muted-foreground">
                        Allow vendors to apply through a public form.
                      </p>
                    </div>
                    <Switch
                      checked={publicApplications}
                      onCheckedChange={setPublicApplications}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="required-docs">Required Documents</Label>
                    <Textarea
                      id="required-docs"
                      placeholder="Enter required documents"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="booths" className="mt-6">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Store className="h-5 w-5" />
                    Default Booth Settings
                  </CardTitle>
                  <CardDescription>
                    Organization defaults for booth pricing, deposits, and limits. Events can
                    override these in their workspace settings.
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="booth-base-price">Base Booth Price</Label>
                      <Input id="booth-base-price" type="number" placeholder="Enter base price" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="booth-deposit">Deposit Amount</Label>
                      <Input id="booth-deposit" type="number" placeholder="Enter deposit amount" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Require Deposit</p>
                      <p className="text-sm text-muted-foreground">
                        Vendors must pay a deposit to secure their booth.
                      </p>
                    </div>
                    <Switch checked={requireDeposit} onCheckedChange={setRequireDeposit} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="max-booths">Maximum Booths Per Vendor</Label>
                    <Select>
                      <SelectTrigger id="max-booths">
                        <SelectValue placeholder="Select booth limit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 booth</SelectItem>
                        <SelectItem value="2">2 booths</SelectItem>
                        <SelectItem value="3">3 booths</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <BoothTypesSettingsPanel mode="defaults" showAttributes />
              <BoothAttributesSettings />
              <BoothTemplateLibrarySettings />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <VendorHubNotificationsSettingsPanel />
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-5 w-5" />
                  Email Templates
                </CardTitle>
                <CardDescription>Customize vendor communication templates.</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="approval-subject">Approval Email Subject</Label>
                  <Input id="approval-subject" placeholder="Enter approval email subject" />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="approval-body">Approval Email Body</Label>
                  <Textarea id="approval-body" placeholder="Enter approval email body" rows={6} />
                </div>

                <Button variant="outline" className="w-fit">
                  Edit More Templates
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendor-types" className="mt-6">
            <VendorTypesSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
