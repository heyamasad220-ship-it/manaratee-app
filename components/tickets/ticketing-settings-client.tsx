"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ClipboardList,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Smartphone,
  Tag,
} from "lucide-react"

import { CheckoutFormFieldsEditor } from "@/components/tickets/checkout-form-fields-editor"
import { DiscountCodesPanel } from "@/components/tickets/discount-codes-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DEFAULT_ORG_CHECKOUT_FIELDS,
  EVENTS_WITH_CUSTOM_CHECKOUT,
  ORGANIZATION_DISCOUNT_CODES,
} from "@/lib/tickets/ticketing-checkout-ui-types"

const checkInUsers = [
  {
    id: "u1",
    name: "Ahmed Hassan",
    email: "ahmed@example.com",
    role: "Admin",
    lastActive: "Feb 25, 2026",
    status: "Active",
  },
  {
    id: "u2",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    role: "Staff",
    lastActive: "Feb 24, 2026",
    status: "Active",
  },
  {
    id: "u3",
    name: "Michael Chen",
    email: "michael@example.com",
    role: "Staff",
    lastActive: "Feb 20, 2026",
    status: "Active",
  },
  {
    id: "u4",
    name: "Fatima Al-Rashid",
    email: "fatima@example.com",
    role: "Volunteer",
    lastActive: "Feb 15, 2026",
    status: "Inactive",
  },
]

export function TicketingSettingsClient() {
  const [activeTab, setActiveTab] = useState("checkout-form")
  const [formFields, setFormFields] = useState(DEFAULT_ORG_CHECKOUT_FIELDS)
  const [showAddUser, setShowAddUser] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Ticketing settings</h2>
        <p className="text-sm text-muted-foreground">
          Organization defaults for checkout, promo codes, and check-in access. Customize
          checkout and event promos inside each event&apos;s Ticketing tab.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="checkout-form" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Default checkout
          </TabsTrigger>
          <TabsTrigger value="discount-codes" className="gap-2">
            <Tag className="h-4 w-4" />
            Organization promos
          </TabsTrigger>
          <TabsTrigger value="check-in-users" className="gap-2">
            <Smartphone className="h-4 w-4" />
            Check-in app users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkout-form" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Organization default checkout</CardTitle>
                  <CardDescription>
                    Used by all ticketed events unless an event customizes its own checkout
                    form.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  Default for all events
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CheckoutFormFieldsEditor fields={formFields} onChange={setFormFields} />
              <div className="mt-4 flex justify-end">
                <Button>Save default checkout</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Events with custom checkout</CardTitle>
              <CardDescription>
                Per-event checkout and attendee questions are managed in each event workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {EVENTS_WITH_CUSTOM_CHECKOUT.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events are using a custom checkout form yet.
                </p>
              ) : (
                EVENTS_WITH_CUSTOM_CHECKOUT.map((event) => (
                  <div
                    key={event.eventId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{event.eventName}</p>
                      <p className="text-sm text-muted-foreground">Custom checkout enabled</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/event-management/${event.eventId}?tab=ticketing`}>
                        Open event ticketing
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discount-codes" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <DiscountCodesPanel
                title="Organization promo codes"
                description="These codes can be used at checkout for any ticketed event."
                codes={ORGANIZATION_DISCOUNT_CODES}
                scope="organization"
              />
              <p className="mt-4 text-sm text-muted-foreground">
                Event-only promo codes are managed in each event&apos;s Ticketing tab.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="check-in-users" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Check-in app users</CardTitle>
                <CardDescription>
                  Users who can scan and check in attendees at your events.
                </CardDescription>
              </div>
              <Button onClick={() => setShowAddUser(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add user
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkInUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.lastActive}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            user.status === "Active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add check-in app user</DialogTitle>
            <DialogDescription>
              Send an invitation to access the mobile check-in app.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input id="user-name" placeholder="John Doe" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" placeholder="john@example.com" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-role">Role</Label>
              <Select defaultValue="staff">
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddUser(false)}>Send invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
