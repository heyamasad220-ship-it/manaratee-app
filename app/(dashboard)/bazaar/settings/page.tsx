"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import {
  Store,
  Mail,
  Globe,
  FileText,
  DollarSign,
  Settings,
  Bell,
} from "lucide-react"

export default function BazaarSettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [autoApproveVendors, setAutoApproveVendors] = useState(false)
  const [publicApplications, setPublicApplications] = useState(true)
  const [requireDeposit, setRequireDeposit] = useState(true)

  return (
    <>
      <Header title="Bazaar Settings" />
      <div className="p-6">
        <div className="mx-auto max-w-3xl flex flex-col gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure basic bazaar settings and defaults
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="default-name">Default Bazaar Name</Label>
                <Input id="default-name" defaultValue="Community Bazaar" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="default-start">Default Start Time</Label>
                  <Input id="default-start" type="time" defaultValue="10:00" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="default-end">Default End Time</Label>
                  <Input id="default-end" type="time" defaultValue="20:00" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="default-location">Default Location</Label>
                <Input id="default-location" defaultValue="Main Hall & Outdoor Area" />
              </div>
            </CardContent>
          </Card>

          {/* Booth Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-5 w-5" />
                Booth Settings
              </CardTitle>
              <CardDescription>
                Configure default booth pricing and allocation rules
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="booth-base-price">Base Booth Price</Label>
                  <Input id="booth-base-price" type="number" defaultValue="150" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="booth-deposit">Deposit Amount</Label>
                  <Input id="booth-deposit" type="number" defaultValue="50" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Require Deposit</p>
                  <p className="text-sm text-muted-foreground">
                    Vendors must pay a deposit to secure their booth
                  </p>
                </div>
                <Switch checked={requireDeposit} onCheckedChange={setRequireDeposit} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="max-booths">Maximum Booths Per Vendor</Label>
                <Select defaultValue="2">
                  <SelectTrigger id="max-booths">
                    <SelectValue />
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

          {/* Vendor Application Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                Vendor Applications
              </CardTitle>
              <CardDescription>
                Configure vendor application process and requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Public Applications</p>
                  <p className="text-sm text-muted-foreground">
                    Allow vendors to apply through a public form
                  </p>
                </div>
                <Switch checked={publicApplications} onCheckedChange={setPublicApplications} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Auto-Approve Returning Vendors</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically approve vendors who participated in previous bazaars
                  </p>
                </div>
                <Switch checked={autoApproveVendors} onCheckedChange={setAutoApproveVendors} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="application-deadline">Application Deadline (Days Before Event)</Label>
                <Select defaultValue="14">
                  <SelectTrigger id="application-deadline">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="21">21 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="required-docs">Required Documents</Label>
                <Textarea
                  id="required-docs"
                  defaultValue="Business License, Certificate of Insurance, Food Handler's Permit (for food vendors)"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5" />
                Payment Settings
              </CardTitle>
              <CardDescription>
                Configure payment options and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-methods">Accepted Payment Methods</Label>
                <Select defaultValue="all">
                  <SelectTrigger id="payment-methods">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All (Credit Card, Cash, Check)</SelectItem>
                    <SelectItem value="card">Credit Card Only</SelectItem>
                    <SelectItem value="card-cash">Credit Card & Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="refund-policy">Refund Policy</Label>
                <Select defaultValue="14">
                  <SelectTrigger id="refund-policy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Full refund up to 7 days before</SelectItem>
                    <SelectItem value="14">Full refund up to 14 days before</SelectItem>
                    <SelectItem value="30">Full refund up to 30 days before</SelectItem>
                    <SelectItem value="none">No refunds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cancellation-fee">Late Cancellation Fee</Label>
                <Input id="cancellation-fee" type="number" defaultValue="50" />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure email notifications for bazaar events
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Send email updates to vendors about their applications
                  </p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-days">Reminder Email Schedule</Label>
                <Select defaultValue="7-3-1">
                  <SelectTrigger id="reminder-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7-3-1">7 days, 3 days, 1 day before</SelectItem>
                    <SelectItem value="7-1">7 days, 1 day before</SelectItem>
                    <SelectItem value="3-1">3 days, 1 day before</SelectItem>
                    <SelectItem value="1">1 day before only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Email Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-5 w-5" />
                Email Templates
              </CardTitle>
              <CardDescription>
                Customize email templates for vendor communications
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="approval-subject">Approval Email Subject</Label>
                <Input id="approval-subject" defaultValue="Your Vendor Application Has Been Approved!" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="approval-body">Approval Email Body</Label>
                <Textarea
                  id="approval-body"
                  defaultValue="Dear {{vendor_name}},

Congratulations! Your application to participate in {{bazaar_name}} has been approved. Your assigned booth is {{booth_number}}.

Please complete your payment by {{deadline}} to secure your spot.

Thank you for joining us!"
                  rows={6}
                />
              </div>
              <Button variant="outline" className="w-fit">
                Edit More Templates
              </Button>
            </CardContent>
          </Card>

          {/* Public Page Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-5 w-5" />
                Public Page
              </CardTitle>
              <CardDescription>
                Configure the public-facing bazaar information page
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="public-description">Public Description</Label>
                <Textarea
                  id="public-description"
                  defaultValue="Join us for our annual community bazaar featuring local vendors, delicious food, family activities, and entertainment for all ages!"
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-email">Public Contact Email</Label>
                <Input id="contact-email" type="email" defaultValue="bazaar@example.com" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-phone">Public Contact Phone</Label>
                <Input id="contact-phone" defaultValue="+1 (555) 123-4567" />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button variant="outline">Cancel</Button>
            <Button>Save Settings</Button>
          </div>
        </div>
      </div>
    </>
  )
}
