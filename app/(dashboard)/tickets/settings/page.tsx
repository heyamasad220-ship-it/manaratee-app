"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  ClipboardList, Smartphone, Tag, Plus, MoreHorizontal, 
  GripVertical, Trash2, Eye, EyeOff, Mail, Phone, User, MapPin,
  CalendarDays, Settings2, ChevronRight, Copy, Pencil, AlertCircle,
  ListChecks, ToggleLeft, AlignLeft, Hash
} from "lucide-react"
import { type DiscountCode } from "@/lib/mock-data"

// Extended discount code type with event scope
interface ExtendedDiscountCode extends DiscountCode {
  scope: "general" | "event-specific"
  eventId?: string
  eventName?: string
}

// General discount codes (apply to all events)
const generalDiscountCodes: ExtendedDiscountCode[] = [
  {
    id: "dc1",
    code: "WELCOME10",
    label: "New Customer Welcome",
    type: "Percentage",
    discount: 10,
    usageCount: 45,
    usageLimit: null,
    status: "Active",
    activeFrom: "Jan 1, 2026",
    activeTo: "Dec 31, 2026",
    scope: "general",
  },
  {
    id: "dc2",
    code: "MEMBER20",
    label: "Member Discount",
    type: "Percentage",
    discount: 20,
    usageCount: 128,
    usageLimit: 500,
    status: "Active",
    activeFrom: "Jan 1, 2026",
    activeTo: "Dec 31, 2026",
    scope: "general",
  },
  {
    id: "dc3",
    code: "FAMILY15",
    label: "Family Discount",
    type: "Percentage",
    discount: 15,
    usageCount: 67,
    usageLimit: 200,
    status: "Active",
    activeFrom: "Jan 1, 2026",
    activeTo: "Jun 30, 2026",
    scope: "general",
  },
]

// Event-specific discount codes
const eventSpecificDiscountCodes: ExtendedDiscountCode[] = [
  {
    id: "edc1",
    code: "EIDBAZAAR25",
    label: "Eid Bazaar Early Bird",
    type: "Percentage",
    discount: 25,
    usageCount: 34,
    usageLimit: 100,
    status: "Active",
    activeFrom: "Feb 1, 2026",
    activeTo: "Mar 25, 2026",
    scope: "event-specific",
    eventId: "evt-001",
    eventName: "Eid Bazaar 2026",
  },
  {
    id: "edc2",
    code: "GALA50OFF",
    label: "Gala VIP Discount",
    type: "Fixed",
    discount: 50,
    usageCount: 12,
    usageLimit: 25,
    status: "Active",
    activeFrom: "Mar 1, 2026",
    activeTo: "Apr 10, 2026",
    scope: "event-specific",
    eventId: "evt-002",
    eventName: "Spring Fundraiser Gala",
  },
  {
    id: "edc3",
    code: "CAMPKIDS10",
    label: "Summer Camp Sibling Discount",
    type: "Percentage",
    discount: 10,
    usageCount: 8,
    usageLimit: 50,
    status: "Active",
    activeFrom: "Apr 1, 2026",
    activeTo: "Jun 10, 2026",
    scope: "event-specific",
    eventId: "evt-003",
    eventName: "Youth Summer Camp",
  },
  {
    id: "edc4",
    code: "IFTAR2026",
    label: "Community Iftar Special",
    type: "Percentage",
    discount: 100,
    usageCount: 15,
    usageLimit: 20,
    status: "Active",
    activeFrom: "Feb 15, 2026",
    activeTo: "Mar 5, 2026",
    scope: "event-specific",
    eventId: "evt-004",
    eventName: "Community Iftar",
  },
]

// Types
interface FormField {
  id: string
  name: string
  type: "text" | "email" | "phone" | "address" | "textarea" | "select" | "checkbox" | "number"
  required: boolean
  enabled: boolean
  options?: string[]
  placeholder?: string
}

interface AttendeeQuestion {
  id: string
  question: string
  type: "text" | "textarea" | "select" | "checkbox" | "number"
  required: boolean
  options?: string[]
  perAttendee: boolean
}

interface EventFormConfig {
  id: string
  eventId: string
  eventName: string
  eventDate: string
  useCustomForm: boolean
  fields: FormField[]
  attendeeQuestions: AttendeeQuestion[]
}

// Mock checkout form fields (General Form)
const defaultFormFields: FormField[] = [
  { id: "f1", name: "First Name", type: "text", required: true, enabled: true },
  { id: "f2", name: "Last Name", type: "text", required: true, enabled: true },
  { id: "f3", name: "Email", type: "email", required: true, enabled: true },
  { id: "f4", name: "Phone", type: "phone", required: false, enabled: true },
  { id: "f5", name: "Address", type: "address", required: false, enabled: false },
  { id: "f6", name: "Company", type: "text", required: false, enabled: false },
  { id: "f7", name: "Special Requests", type: "textarea", required: false, enabled: true },
]

// Mock events with custom form configurations
const mockEventConfigs: EventFormConfig[] = [
  {
    id: "ec1",
    eventId: "evt-001",
    eventName: "Eid Bazaar 2026",
    eventDate: "Mar 30, 2026",
    useCustomForm: true,
    fields: [
      { id: "f1", name: "First Name", type: "text", required: true, enabled: true },
      { id: "f2", name: "Last Name", type: "text", required: true, enabled: true },
      { id: "f3", name: "Email", type: "email", required: true, enabled: true },
      { id: "f4", name: "Phone", type: "phone", required: true, enabled: true },
    ],
    attendeeQuestions: [
      { id: "aq1", question: "T-Shirt Size", type: "select", required: true, options: ["S", "M", "L", "XL", "XXL"], perAttendee: true },
      { id: "aq2", question: "Dietary Restrictions", type: "select", required: false, options: ["None", "Vegetarian", "Vegan", "Halal", "Gluten-Free", "Other"], perAttendee: true },
      { id: "aq3", question: "How did you hear about this event?", type: "select", required: false, options: ["Social Media", "Email", "Friend/Family", "Website", "Flyer", "Other"], perAttendee: false },
    ],
  },
  {
    id: "ec2",
    eventId: "evt-002",
    eventName: "Spring Fundraiser Gala",
    eventDate: "Apr 12, 2026",
    useCustomForm: true,
    fields: defaultFormFields,
    attendeeQuestions: [
      { id: "aq4", question: "Meal Preference", type: "select", required: true, options: ["Chicken", "Fish", "Vegetarian", "Vegan"], perAttendee: true },
      { id: "aq5", question: "Table Seating Request", type: "textarea", required: false, perAttendee: false },
      { id: "aq6", question: "Would you like to be recognized as a sponsor?", type: "checkbox", required: false, perAttendee: false },
    ],
  },
  {
    id: "ec3",
    eventId: "evt-003",
    eventName: "Youth Summer Camp",
    eventDate: "Jun 15-20, 2026",
    useCustomForm: false,
    fields: defaultFormFields,
    attendeeQuestions: [],
  },
  {
    id: "ec4",
    eventId: "evt-004",
    eventName: "Community Iftar",
    eventDate: "Mar 10, 2026",
    useCustomForm: false,
    fields: defaultFormFields,
    attendeeQuestions: [],
  },
]

// Mock check-in app users
const checkInUsers = [
  { id: "u1", name: "Ahmed Hassan", email: "ahmed@example.com", role: "Admin", lastActive: "Feb 25, 2026", status: "Active" },
  { id: "u2", name: "Sarah Johnson", email: "sarah@example.com", role: "Staff", lastActive: "Feb 24, 2026", status: "Active" },
  { id: "u3", name: "Michael Chen", email: "michael@example.com", role: "Staff", lastActive: "Feb 20, 2026", status: "Active" },
  { id: "u4", name: "Fatima Al-Rashid", email: "fatima@example.com", role: "Volunteer", lastActive: "Feb 15, 2026", status: "Inactive" },
]

function StatusBadge({ status }: { status: DiscountCode["status"] }) {
  const colors: Record<DiscountCode["status"], string> = {
    Active: "bg-emerald-100 text-emerald-800",
    Expired: "bg-gray-100 text-gray-800",
    Inactive: "bg-red-100 text-red-800",
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {status}
    </span>
  )
}

const fieldIcons: Record<string, typeof User> = {
  text: User,
  email: Mail,
  phone: Phone,
  address: MapPin,
  textarea: AlignLeft,
  select: ListChecks,
  checkbox: ToggleLeft,
  number: Hash,
}

export default function TicketsSettingsPage() {
  const [activeTab, setActiveTab] = useState("checkout-form")
  const [formView, setFormView] = useState<"general" | "events">("general")
  const [formFields, setFormFields] = useState(defaultFormFields)
  const [eventConfigs, setEventConfigs] = useState(mockEventConfigs)
  const [selectedEventConfig, setSelectedEventConfig] = useState<EventFormConfig | null>(null)
  const [showEventFormEditor, setShowEventFormEditor] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [showAddField, setShowAddField] = useState(false)
  const [showCreateDiscount, setShowCreateDiscount] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [monthFilter, setMonthFilter] = useState("all")
  const [eventFilter, setEventFilter] = useState("all")
  const [discountView, setDiscountView] = useState<"general" | "event-specific">("general")
  const [discountScope, setDiscountScope] = useState<"general" | "event-specific">("general")
  
  // New question form state
  const [newQuestion, setNewQuestion] = useState<Partial<AttendeeQuestion>>({
    question: "",
    type: "text",
    required: false,
    perAttendee: true,
    options: [],
  })
  const [newOptionText, setNewOptionText] = useState("")

  function toggleFieldEnabled(fieldId: string) {
    setFormFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, enabled: !f.enabled } : f))
    )
  }

  function toggleFieldRequired(fieldId: string) {
    setFormFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, required: !f.required } : f))
    )
  }

  function openEventFormEditor(config: EventFormConfig) {
    setSelectedEventConfig({ ...config })
    setShowEventFormEditor(true)
  }

  function toggleEventCustomForm(eventId: string) {
    setEventConfigs((prev) =>
      prev.map((e) =>
        e.eventId === eventId ? { ...e, useCustomForm: !e.useCustomForm } : e
      )
    )
  }

  function toggleEventFieldEnabled(fieldId: string) {
    if (!selectedEventConfig) return
    setSelectedEventConfig({
      ...selectedEventConfig,
      fields: selectedEventConfig.fields.map((f) =>
        f.id === fieldId ? { ...f, enabled: !f.enabled } : f
      ),
    })
  }

  function toggleEventFieldRequired(fieldId: string) {
    if (!selectedEventConfig) return
    setSelectedEventConfig({
      ...selectedEventConfig,
      fields: selectedEventConfig.fields.map((f) =>
        f.id === fieldId ? { ...f, required: !f.required } : f
      ),
    })
  }

  function deleteAttendeeQuestion(questionId: string) {
    if (!selectedEventConfig) return
    setSelectedEventConfig({
      ...selectedEventConfig,
      attendeeQuestions: selectedEventConfig.attendeeQuestions.filter(
        (q) => q.id !== questionId
      ),
    })
  }

  function addAttendeeQuestion() {
    if (!selectedEventConfig || !newQuestion.question) return
    const question: AttendeeQuestion = {
      id: `aq-${Date.now()}`,
      question: newQuestion.question || "",
      type: newQuestion.type || "text",
      required: newQuestion.required || false,
      perAttendee: newQuestion.perAttendee || false,
      options: newQuestion.options,
    }
    setSelectedEventConfig({
      ...selectedEventConfig,
      attendeeQuestions: [...selectedEventConfig.attendeeQuestions, question],
    })
    setNewQuestion({
      question: "",
      type: "text",
      required: false,
      perAttendee: true,
      options: [],
    })
    setShowAddQuestion(false)
  }

  function addOptionToQuestion() {
    if (!newOptionText.trim()) return
    setNewQuestion({
      ...newQuestion,
      options: [...(newQuestion.options || []), newOptionText.trim()],
    })
    setNewOptionText("")
  }

  function removeOptionFromQuestion(index: number) {
    setNewQuestion({
      ...newQuestion,
      options: (newQuestion.options || []).filter((_, i) => i !== index),
    })
  }

  function saveEventFormConfig() {
    if (!selectedEventConfig) return
    setEventConfigs((prev) =>
      prev.map((e) =>
        e.eventId === selectedEventConfig.eventId ? selectedEventConfig : e
      )
    )
    setShowEventFormEditor(false)
    setSelectedEventConfig(null)
  }

  return (
    <>
      <Header title="Settings" />
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">
          Configure checkout forms, check-in app access, and discount codes
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="checkout-form" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Checkout Form
            </TabsTrigger>
            <TabsTrigger value="check-in-users" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Check-In App Users
            </TabsTrigger>
            <TabsTrigger value="discount-codes" className="gap-2">
              <Tag className="h-4 w-4" />
              Discount Codes
            </TabsTrigger>
          </TabsList>

          {/* Checkout Form Tab */}
          <TabsContent value="checkout-form" className="mt-6">
            {/* Form View Toggle */}
            <div className="mb-6 flex items-center gap-2 rounded-lg border bg-muted/30 p-1">
              <Button
                variant={formView === "general" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setFormView("general")}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                General Form
              </Button>
              <Button
                variant={formView === "events" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setFormView("events")}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Event-Specific Forms
              </Button>
            </div>

            {formView === "general" ? (
              /* General Form View */
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>General Checkout Form</CardTitle>
                      <CardDescription>
                        This form applies to all ticketed events by default. 
                        Individual events can override these settings with custom forms.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      Default for All Events
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {formFields.map((field) => {
                      const Icon = fieldIcons[field.type] || User
                      return (
                        <div
                          key={field.id}
                          className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                            field.enabled ? "bg-background" : "bg-muted/50 opacity-60"
                          }`}
                        >
                          <GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" />
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{field.name}</span>
                              {field.required && field.enabled && (
                                <Badge variant="secondary" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground capitalize">{field.type} field</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`required-${field.id}`} className="text-xs text-muted-foreground">
                                Required
                              </Label>
                              <Switch
                                id={`required-${field.id}`}
                                checked={field.required}
                                onCheckedChange={() => toggleFieldRequired(field.id)}
                                disabled={!field.enabled}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFieldEnabled(field.id)}
                            >
                              {field.enabled ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Button variant="outline" onClick={() => setShowAddField(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Field
                    </Button>
                    <Button>Save Changes</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Event-Specific Forms View */
              <div className="flex flex-col gap-4">
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardContent className="flex items-start gap-3 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Event-Specific Forms</p>
                      <p className="text-sm text-amber-700">
                        Events with custom forms enabled will use their own form configuration instead of the general form.
                        Custom attendee questions can be added to collect event-specific information.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Event Form Configurations</CardTitle>
                    <CardDescription>
                      Enable custom forms for specific events and add custom attendee questions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Form Type</TableHead>
                          <TableHead>Custom Questions</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventConfigs.map((config) => (
                          <TableRow key={config.id}>
                            <TableCell>
                              <span className="font-medium">{config.eventName}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {config.eventDate}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={config.useCustomForm}
                                  onCheckedChange={() => toggleEventCustomForm(config.eventId)}
                                />
                                <Badge
                                  variant="secondary"
                                  className={
                                    config.useCustomForm
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-muted text-muted-foreground"
                                  }
                                >
                                  {config.useCustomForm ? "Custom" : "General"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {config.useCustomForm && config.attendeeQuestions.length > 0 ? (
                                <Badge variant="outline">
                                  {config.attendeeQuestions.length} question{config.attendeeQuestions.length !== 1 ? "s" : ""}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEventFormEditor(config)}
                                disabled={!config.useCustomForm}
                              >
                                <Pencil className="mr-1 h-4 w-4" />
                                Configure
                                <ChevronRight className="ml-1 h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Check-In App Users Tab */}
          <TabsContent value="check-in-users" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Check-In App Users</CardTitle>
                  <CardDescription>
                    Manage users who can access the check-in app to scan and check-in attendees at your events.
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddUser(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Active</TableHead>
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

          {/* Discount Codes Tab */}
          <TabsContent value="discount-codes" className="mt-6">
            {/* Discount View Toggle */}
            <div className="mb-6 flex items-center gap-2 rounded-lg border bg-muted/30 p-1">
              <Button
                variant={discountView === "general" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setDiscountView("general")}
              >
                <Tag className="mr-2 h-4 w-4" />
                General Codes
              </Button>
              <Button
                variant={discountView === "event-specific" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setDiscountView("event-specific")}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Event-Specific Codes
              </Button>
            </div>

            {discountView === "general" ? (
              /* General Discount Codes */
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>General Discount Codes</CardTitle>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        All Events
                      </Badge>
                    </div>
                    <CardDescription>
                      These discount codes can be used at checkout for any ticketed event.
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setDiscountScope("general")
                    setShowCreateDiscount(true)
                  }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create General Code
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        <SelectItem value="march-2026">March 2026</SelectItem>
                        <SelectItem value="april-2026">April 2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Code & Label</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Usage</TableHead>
                          <TableHead>Valid Period</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generalDiscountCodes.map((code) => (
                          <TableRow key={code.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold text-primary">
                                  {code.code}
                                </span>
                                {code.label && (
                                  <span className="text-xs text-muted-foreground">
                                    {code.label}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {code.type === "Percentage" ? "%" : "$"} {code.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {code.type === "Percentage" ? `${code.discount}%` : `$${code.discount}`}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {code.usageCount} / {code.usageLimit || "∞"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs text-muted-foreground">
                                <span>{code.activeFrom}</span>
                                <span>to {code.activeTo}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={code.status} />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            ) : (
              /* Event-Specific Discount Codes */
              <div className="flex flex-col gap-4">
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardContent className="flex items-start gap-3 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Event-Specific Discount Codes</p>
                      <p className="text-sm text-amber-700">
                        These codes only work for their assigned event and cannot be used at checkout for other events.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Event-Specific Codes</CardTitle>
                      <CardDescription>
                        Discount codes that are valid only for specific events.
                      </CardDescription>
                    </div>
                    <Button onClick={() => {
                      setDiscountScope("event-specific")
                      setShowCreateDiscount(true)
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Event Code
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <Select value={eventFilter} onValueChange={setEventFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="All Events" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Events</SelectItem>
                          <SelectItem value="evt-001">Eid Bazaar 2026</SelectItem>
                          <SelectItem value="evt-002">Spring Fundraiser Gala</SelectItem>
                          <SelectItem value="evt-003">Youth Summer Camp</SelectItem>
                          <SelectItem value="evt-004">Community Iftar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Months</SelectItem>
                          <SelectItem value="march-2026">March 2026</SelectItem>
                          <SelectItem value="april-2026">April 2026</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Code & Label</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Usage</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-12">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eventSpecificDiscountCodes
                            .filter((code) => eventFilter === "all" || code.eventId === eventFilter)
                            .map((code) => (
                              <TableRow key={code.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-primary">
                                      {code.code}
                                    </span>
                                    {code.label && (
                                      <span className="text-xs text-muted-foreground">
                                        {code.label}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-muted">
                                    <CalendarDays className="mr-1 h-3 w-3" />
                                    {code.eventName}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {code.type === "Percentage" ? "%" : "$"} {code.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {code.type === "Percentage" ? `${code.discount}%` : `$${code.discount}`}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">
                                    {code.usageCount} / {code.usageLimit || "∞"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={code.status} />
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Discount Dialog */}
        <Dialog open={showCreateDiscount} onOpenChange={setShowCreateDiscount}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {discountScope === "general" ? (
                  <>
                    <Tag className="h-5 w-5" />
                    Create General Discount Code
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-5 w-5" />
                    Create Event-Specific Code
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {discountScope === "general"
                  ? "This code will be valid for all ticketed events."
                  : "This code will only be valid for the selected event."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              {/* Scope Indicator */}
              <div className={`rounded-lg border p-3 ${
                discountScope === "general" 
                  ? "border-blue-200 bg-blue-50" 
                  : "border-amber-200 bg-amber-50"
              }`}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    discountScope === "general"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }>
                    {discountScope === "general" ? "All Events" : "Specific Event"}
                  </Badge>
                  <span className={`text-sm ${
                    discountScope === "general" ? "text-blue-700" : "text-amber-700"
                  }`}>
                    {discountScope === "general"
                      ? "Applies to all ticketed events"
                      : "Select an event below"}
                  </span>
                </div>
              </div>

              {/* Event Selection (only for event-specific) */}
              {discountScope === "event-specific" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="discount-event">Select Event</Label>
                  <Select>
                    <SelectTrigger id="discount-event">
                      <SelectValue placeholder="Choose an event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evt-001">Eid Bazaar 2026</SelectItem>
                      <SelectItem value="evt-002">Spring Fundraiser Gala</SelectItem>
                      <SelectItem value="evt-003">Youth Summer Camp</SelectItem>
                      <SelectItem value="evt-004">Community Iftar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="discount-code">Code</Label>
                <Input id="discount-code" placeholder="SPRING50" className="uppercase" />
                <p className="text-xs text-muted-foreground">
                  Customers will enter this code at checkout
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="discount-label">
                  Label <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input id="discount-label" placeholder="Spring Special" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="discount-value">Discount Value</Label>
                  <Input id="discount-value" type="number" placeholder="50" />
                </div>
                <div className="w-28 pt-5">
                  <Select defaultValue="percent">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">% Off</SelectItem>
                      <SelectItem value="fixed">$ Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="usage-limit">Usage Limit</Label>
                <Select defaultValue="unlimited">
                  <SelectTrigger id="usage-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                    <SelectItem value="25">25 uses</SelectItem>
                    <SelectItem value="50">50 uses</SelectItem>
                    <SelectItem value="100">100 uses</SelectItem>
                    <SelectItem value="500">500 uses</SelectItem>
                    <SelectItem value="custom">Custom limit...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valid Period</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" className="flex-1" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="date" className="flex-1" />
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="min-order" className="text-sm">Minimum Order Amount</Label>
                    <p className="text-xs text-muted-foreground">Only apply if order meets minimum</p>
                  </div>
                  <Switch id="min-order" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="single-use" className="text-sm">One Per Customer</Label>
                    <p className="text-xs text-muted-foreground">Each customer can only use once</p>
                  </div>
                  <Switch id="single-use" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDiscount(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowCreateDiscount(false)}>
                Create Discount
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add User Dialog */}
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Check-In App User</DialogTitle>
              <DialogDescription>
                Add a new user who can access the check-in app
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="user-name">Full Name</Label>
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
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-700">
                  An invitation email will be sent to this user with instructions to download and access the check-in app.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddUser(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowAddUser(false)}>
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Event Form Editor Dialog */}
        <Dialog open={showEventFormEditor} onOpenChange={(open) => {
          if (!open) {
            setShowEventFormEditor(false)
            setSelectedEventConfig(null)
          }
        }}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            {selectedEventConfig && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5" />
                    {selectedEventConfig.eventName}
                  </DialogTitle>
                  <DialogDescription>
                    Configure the custom checkout form and attendee questions for this event
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-6 py-4">
                  {/* Form Fields Section */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Checkout Form Fields</h4>
                        <p className="text-sm text-muted-foreground">
                          Select which fields to show during checkout
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy from General
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {selectedEventConfig.fields.map((field) => {
                        const Icon = fieldIcons[field.type] || User
                        return (
                          <div
                            key={field.id}
                            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                              field.enabled ? "bg-background" : "bg-muted/50 opacity-60"
                            }`}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium">{field.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`evt-required-${field.id}`} className="text-xs text-muted-foreground">
                                  Required
                                </Label>
                                <Switch
                                  id={`evt-required-${field.id}`}
                                  checked={field.required}
                                  onCheckedChange={() => toggleEventFieldRequired(field.id)}
                                  disabled={!field.enabled}
                                />
                              </div>
                              <Switch
                                checked={field.enabled}
                                onCheckedChange={() => toggleEventFieldEnabled(field.id)}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Custom Attendee Questions Section */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Custom Attendee Questions</h4>
                        <p className="text-sm text-muted-foreground">
                          Add custom questions to collect event-specific information from attendees
                        </p>
                      </div>
                      <Button size="sm" onClick={() => setShowAddQuestion(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Question
                      </Button>
                    </div>

                    {selectedEventConfig.attendeeQuestions.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No custom questions yet. Add questions to collect event-specific information.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {selectedEventConfig.attendeeQuestions.map((question) => {
                          const QuestionIcon = fieldIcons[question.type] || User
                          return (
                            <div
                              key={question.id}
                              className="flex items-center gap-3 rounded-lg border p-3"
                            >
                              <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100">
                                <QuestionIcon className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{question.question}</span>
                                  {question.required && (
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground capitalize">{question.type}</span>
                                  {question.perAttendee ? (
                                    <Badge variant="outline" className="text-xs">Per Attendee</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Per Order</Badge>
                                  )}
                                  {question.options && question.options.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      {question.options.length} options
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAttendeeQuestion(question.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowEventFormEditor(false)
                    setSelectedEventConfig(null)
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={saveEventFormConfig}>
                    Save Configuration
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Question Dialog */}
        <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Custom Question</DialogTitle>
              <DialogDescription>
                Create a custom question for attendees to answer during checkout
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="question-text">Question</Label>
                <Input
                  id="question-text"
                  placeholder="e.g., What is your t-shirt size?"
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="question-type">Answer Type</Label>
                <Select
                  value={newQuestion.type}
                  onValueChange={(value) => setNewQuestion({ 
                    ...newQuestion, 
                    type: value as AttendeeQuestion["type"],
                    options: value === "select" || value === "checkbox" ? [] : undefined
                  })}
                >
                  <SelectTrigger id="question-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Short Text</SelectItem>
                    <SelectItem value="textarea">Long Text</SelectItem>
                    <SelectItem value="select">Dropdown Selection</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(newQuestion.type === "select") && (
                <div className="flex flex-col gap-2">
                  <Label>Options</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an option"
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addOptionToQuestion()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addOptionToQuestion}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {newQuestion.options && newQuestion.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newQuestion.options.map((option, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {option}
                          <button
                            type="button"
                            onClick={() => removeOptionFromQuestion(index)}
                            className="ml-1 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="question-required" className="text-sm">Required</Label>
                    <p className="text-xs text-muted-foreground">Attendees must answer this question</p>
                  </div>
                  <Switch
                    id="question-required"
                    checked={newQuestion.required}
                    onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, required: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="question-per-attendee" className="text-sm">Per Attendee</Label>
                    <p className="text-xs text-muted-foreground">Ask this question for each ticket/attendee</p>
                  </div>
                  <Switch
                    id="question-per-attendee"
                    checked={newQuestion.perAttendee}
                    onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, perAttendee: checked })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddQuestion(false)
                setNewQuestion({
                  question: "",
                  type: "text",
                  required: false,
                  perAttendee: true,
                  options: [],
                })
              }}>
                Cancel
              </Button>
              <Button
                onClick={addAttendeeQuestion}
                disabled={!newQuestion.question}
              >
                Add Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
