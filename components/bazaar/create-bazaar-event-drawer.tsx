"use client"

import { useEffect, useState } from "react"
import {
  fetchInternalEventsForLinking,
  upsertBazaarEvent,
  type InternalEventLinkOption,
} from "@/lib/vendor-hub/vendor-hub-event-actions"
import {
  applyBoothSetupTemplate,
  fetchActiveBoothSetupTemplatesForPicker,
} from "@/lib/vendor-hub/booth-template-actions"
import type { VendorHubBoothSetupTemplate } from "@/lib/vendor-hub/booth-catalog-types"
import {
  BAZAAR_CALENDAR_VISIBILITY_OPTIONS,
  visibilityFromCalendarStatus,
  type BazaarCalendarVisibility,
} from "@/lib/vendor-hub/calendar-visibility"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  User,
  Building2,
  Calendar,
  Store,
  CreditCard,
  Globe,
  FileText,
  Link2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CreateBazaarEventDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventData?: {
    id: string
    name?: string | null
    event_type?: string | null
    event_date?: string | null
    start_time?: string | null
    end_time?: string | null
    location?: string | null
    description?: string | null
    calendar_status?: string | null
    internal_event_id?: string | null
  }
}

function parseSupabaseTime(time: string | null | undefined) {
  if (!time) {
    return { hour: "", minute: "", period: "AM" as const }
  }

  const [hourPart, minutePart] = time.split(":")
  let hourNumber = Number(hourPart)
  const minute = minutePart?.slice(0, 2) ?? "00"
  const period = hourNumber >= 12 ? "PM" : "AM"

  if (hourNumber === 0) {
    hourNumber = 12
  } else if (hourNumber > 12) {
    hourNumber -= 12
  }

  return {
    hour: String(hourNumber).padStart(2, "0"),
    minute,
    period: period as "AM" | "PM",
  }
}

// Mock data for dropdowns
const mockSpaces = [
  { id: "s-1", name: "Main Hall" },
  { id: "s-2", name: "Outdoor Courtyard" },
  { id: "s-3", name: "Conference Room A" },
  { id: "s-4", name: "Full Campus" },
]

const mockContacts = [
  { id: "c-1", name: "Ahmed Hassan", email: "ahmed@example.com", phone: "(555) 123-4567" },
  { id: "c-2", name: "Fatima Ali", email: "fatima@example.com", phone: "(555) 234-5678" },
  { id: "c-3", name: "Omar Khalid", email: "omar@example.com", phone: "(555) 345-6789" },
]

const vendorCategories = ["Food", "Retail", "Crafts", "Services", "Other"]
const paymentMethods = ["Cash", "Zelle", "Stripe", "Check", "Other"]

interface BoothType {
  id: string
  name: string
  price: string
  quantity: string
}
export function CreateBazaarEventDrawer({
  open,
  onOpenChange,
  eventData,
}: CreateBazaarEventDrawerProps) {
  const isEditing = !!eventData
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [internalEvents, setInternalEvents] = useState<InternalEventLinkOption[]>([])
  const [loadingInternalEvents, setLoadingInternalEvents] = useState(false)
  const [boothTemplates, setBoothTemplates] = useState<VendorHubBoothSetupTemplate[]>([])
  const [selectedBoothTemplateId, setSelectedBoothTemplateId] = useState("none")
  const [loadingBoothTemplates, setLoadingBoothTemplates] = useState(false)
  // Section collapse states
  const [vendorAppSection, setVendorAppSection] = useState(false)
  const [boothSetupSection, setBoothSetupSection] = useState(false)
  const [paymentsSection, setPaymentsSection] = useState(false)
  const [publicInfoSection, setPublicInfoSection] = useState(false)
  const [calendarSection, setCalendarSection] = useState(false)
  const [internalNotesSection, setInternalNotesSection] = useState(false)
  const [integrationsSection, setIntegrationsSection] = useState(false)

  // Toggle states for features
  const [enableVendorApps, setEnableVendorApps] = useState(false)
  const [configureBooths, setConfigureBooths] = useState(false)
  const [collectVendorFees, setCollectVendorFees] = useState(false)
  const [calendarVisibility, setCalendarVisibility] = useState<BazaarCalendarVisibility>("private")
  const [autoApprove, setAutoApprove] = useState(false)
  const [customPricing, setCustomPricing] = useState(false)
  const [requirePaymentBeforeApproval, setRequirePaymentBeforeApproval] = useState(false)
  const [autoAssignBooths, setAutoAssignBooths] = useState(false)
  const [enableTicketing, setEnableTicketing] = useState(false)

  // Form data
  const [eventName, setEventName] = useState("")
  const [eventType, setEventType] = useState("")
  const [startDate, setStartDate] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [internalEventId, setInternalEventId] = useState<string>("none")
  const [endDate, setEndDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [startHour, setStartHour] = useState("")
  const [startMinute, setStartMinute] = useState("")
  const [startPeriod, setStartPeriod] = useState("AM")

  const [endHour, setEndHour] = useState("")
  const [endMinute, setEndMinute] = useState("")
  const [endPeriod, setEndPeriod] = useState("PM")
  const [linkedSpace, setLinkedSpace] = useState("")
  const [organizerName, setOrganizerName] = useState("")
  const [primaryContact, setPrimaryContact] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([])
  const [boothTypes, setBoothTypes] = useState<BoothType[]>([
    { id: "bt-1", name: "10x10 Tent", price: "100", quantity: "20" },
  ])

  useEffect(() => {
    if (!open) {
      return
    }

    setSaveError(null)
    setLoadingInternalEvents(true)
    setLoadingBoothTemplates(true)
    void fetchInternalEventsForLinking()
      .then(setInternalEvents)
      .finally(() => setLoadingInternalEvents(false))
    void fetchActiveBoothSetupTemplatesForPicker()
      .then(setBoothTemplates)
      .catch(() => setBoothTemplates([]))
      .finally(() => setLoadingBoothTemplates(false))
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    if (eventData) {
      setEventName(eventData.name ?? "")
      setEventType(eventData.event_type ?? "")
      setStartDate(eventData.event_date ?? "")
      setLocation(eventData.location ?? "")
      setDescription(eventData.description ?? "")
      setCalendarVisibility(visibilityFromCalendarStatus(eventData.calendar_status))
      setInternalEventId(eventData.internal_event_id ?? "none")

      const start = parseSupabaseTime(eventData.start_time)
      setStartHour(start.hour)
      setStartMinute(start.minute)
      setStartPeriod(start.period)

      const end = parseSupabaseTime(eventData.end_time)
      setEndHour(end.hour)
      setEndMinute(end.minute)
      setEndPeriod(end.period)
      return
    }

    setEventName("")
    setEventType("")
    setStartDate("")
    setLocation("")
    setDescription("")
    setCalendarVisibility("private")
    setInternalEventId("none")
    setStartHour("")
    setStartMinute("")
    setStartPeriod("AM")
    setEndHour("")
    setEndMinute("")
    setEndPeriod("PM")
    setSelectedBoothTemplateId("none")
  }, [open, eventData])

  const handleContactSelect = (contactId: string) => {
    const contact = mockContacts.find((c) => c.id === contactId)
    if (contact) {
      setPrimaryContact(contactId)
      setContactEmail(contact.email)
      setContactPhone(contact.phone)
    }
  }

  const addBoothType = () => {
    setBoothTypes([...boothTypes, { id: `bt-${Date.now()}`, name: "", price: "", quantity: "" }])
  }

  const removeBoothType = (id: string) => {
    setBoothTypes(boothTypes.filter((bt) => bt.id !== id))
  }

  const updateBoothType = (id: string, field: keyof BoothType, value: string) => {
    setBoothTypes(boothTypes.map((bt) => (bt.id === id ? { ...bt, [field]: value } : bt)))
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  const togglePaymentMethod = (method: string) => {
    setSelectedPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    )
  }
function formatTimeForSupabase(hour: string, minute: string, period: string) {
  if (!hour || !minute) return null

  let hourNumber = Number(hour)

  if (period === "PM" && hourNumber !== 12) {
    hourNumber += 12
  }

  if (period === "AM" && hourNumber === 12) {
    hourNumber = 0
  }

  return `${String(hourNumber).padStart(2, "0")}:${minute}:00`
}
  const handleSave = async () => {
    if (!eventName.trim()) {
      setSaveError("Please enter an event name.")
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const useTemplate =
        !isEditing && selectedBoothTemplateId && selectedBoothTemplateId !== "none"

      const result = await upsertBazaarEvent({
        id: eventData?.id,
        name: eventName.trim(),
        event_type: eventType || null,
        event_date: startDate || null,
        start_time: formatTimeForSupabase(startHour, startMinute, startPeriod),
        end_time: formatTimeForSupabase(endHour, endMinute, endPeriod),
        location: location || null,
        description: description || null,
        expected_attendees: 0,
        total_booths: useTemplate
          ? 0
          : boothTypes.reduce((total, booth) => total + Number(booth.quantity || 0), 0),
        calendar_visibility: calendarVisibility,
        internal_event_id: internalEventId,
      })

      if (useTemplate) {
        await applyBoothSetupTemplate({
          eventId: result.id,
          templateId: selectedBoothTemplateId,
          generateBoothInventory: true,
        })
      }

      onOpenChange(false)
      window.location.reload()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save bazaar event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-lg">
            {isEditing ? "Edit Bazaar Event" : "Create Bazaar Event"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update bazaar event details, visibility, and Event Management link"
              : "Set up a new bazaar, festival, or community event"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            {/* SECTION 1: Core Event Details */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Core Details
              </h3>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="eventName">Event Name</Label>
                  <Input
                    id="eventName"
                    placeholder="e.g., Annual Community Bazaar 2026"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="eventType">Event Type</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bazaar">Bazaar</SelectItem>
                      <SelectItem value="festival">Festival</SelectItem>
                      <SelectItem value="carnival">Carnival</SelectItem>
                      <SelectItem value="fundraiser">Fundraiser</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
  <Label>Start Time</Label>
  <div className="mt-1.5 grid grid-cols-3 gap-2">
    <Select value={startHour} onValueChange={setStartHour}>
      <SelectTrigger>
        <SelectValue placeholder="Hour" />
      </SelectTrigger>
      <SelectContent>
        {["01","02","03","04","05","06","07","08","09","10","11","12"].map((hour) => (
          <SelectItem key={hour} value={hour}>{hour}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={startMinute} onValueChange={setStartMinute}>
      <SelectTrigger>
        <SelectValue placeholder="Min" />
      </SelectTrigger>
      <SelectContent>
        {["00","15","30","45"].map((minute) => (
          <SelectItem key={minute} value={minute}>{minute}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={startPeriod} onValueChange={setStartPeriod}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="AM">AM</SelectItem>
        <SelectItem value="PM">PM</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
                  <div>
  <Label>End Time</Label>

  <div className="mt-1.5 grid grid-cols-3 gap-2">
    <Select value={endHour} onValueChange={setEndHour}>
      <SelectTrigger>
        <SelectValue placeholder="Hour" />
      </SelectTrigger>

      <SelectContent>
        {[
          "01",
          "02",
          "03",
          "04",
          "05",
          "06",
          "07",
          "08",
          "09",
          "10",
          "11",
          "12",
        ].map((hour) => (
          <SelectItem key={hour} value={hour}>
            {hour}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={endMinute} onValueChange={setEndMinute}>
      <SelectTrigger>
        <SelectValue placeholder="Min" />
      </SelectTrigger>

      <SelectContent>
        {["00", "15", "30", "45"].map((minute) => (
          <SelectItem key={minute} value={minute}>
            {minute}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={endPeriod} onValueChange={setEndPeriod}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="AM">AM</SelectItem>
        <SelectItem value="PM">PM</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Main Hall & Outdoor Area"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description for staff and calendar listings..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1.5"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="linkedSpace">Link to Space (optional)</Label>
                  <Select value={linkedSpace} onValueChange={setLinkedSpace}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select a space" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockSpaces.map((space) => (
                        <SelectItem key={space.id} value={space.id}>
                          {space.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* SECTION 2: Organizer Info */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                Organizer
              </h3>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="organizerName">Organizer Name</Label>
                  <Input
                    id="organizerName"
                    placeholder="e.g., Community Events Committee"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="primaryContact">Primary Contact</Label>
                  <Select value={primaryContact} onValueChange={handleContactSelect}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select or create new" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockContacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">+ Create New Contact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="email@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: Vendor Applications */}
            <Collapsible open={vendorAppSection} onOpenChange={setVendorAppSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    Vendor Applications
                    {enableVendorApps && (
                      <Badge variant="outline" className="ml-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                        Enabled
                      </Badge>
                    )}
                  </h3>
                  {vendorAppSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enableVendorApps" className="cursor-pointer">
                      Enable Vendor Applications
                    </Label>
                    <Switch
                      id="enableVendorApps"
                      checked={enableVendorApps}
                      onCheckedChange={setEnableVendorApps}
                    />
                  </div>

                  {enableVendorApps && (
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="appOpenDate">Application Open Date</Label>
                          <Input id="appOpenDate" type="date" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="appDeadline">Application Deadline</Label>
                          <Input id="appDeadline" type="date" className="mt-1.5" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="maxVendors">Max Vendors</Label>
                        <Input
                          id="maxVendors"
                          type="number"
                          placeholder="50"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Vendor Categories</Label>
                        <div className="flex flex-wrap gap-2">
                          {vendorCategories.map((category) => (
                            <Badge
                              key={category}
                              variant="outline"
                              className={cn(
                                "cursor-pointer transition-colors",
                                selectedCategories.includes(category) &&
                                  "border-primary bg-primary/10 text-primary"
                              )}
                              onClick={() => toggleCategory(category)}
                            >
                              {category}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Booth Types */}
                      <div>
                        <Label className="mb-2 block">Booth Types</Label>
                        <div className="flex flex-col gap-2">
                          {boothTypes.map((bt) => (
                            <div key={bt.id} className="flex items-center gap-2">
                              <Input
                                placeholder="Name (e.g., 10x10 Tent)"
                                value={bt.name}
                                onChange={(e) => updateBoothType(bt.id, "name", e.target.value)}
                                className="flex-1"
                              />
                              <Input
                                placeholder="Price"
                                value={bt.price}
                                onChange={(e) => updateBoothType(bt.id, "price", e.target.value)}
                                className="w-24"
                                type="number"
                              />
                              <Input
                                placeholder="Qty"
                                value={bt.quantity}
                                onChange={(e) => updateBoothType(bt.id, "quantity", e.target.value)}
                                className="w-20"
                                type="number"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBoothType(bt.id)}
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={addBoothType} className="mt-1 w-fit">
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Booth Type
                          </Button>
                        </div>
                      </div>

                      {/* Approval Workflow */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="autoApprove" className="cursor-pointer">
                            Auto-approve applications
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Otherwise require manual approval
                          </p>
                        </div>
                        <Switch id="autoApprove" checked={autoApprove} onCheckedChange={setAutoApprove} />
                      </div>

                      <div>
                        <Label htmlFor="applicantNotes">Notes / Instructions for Applicants</Label>
                        <Textarea
                          id="applicantNotes"
                          placeholder="Add any instructions or requirements for vendors..."
                          className="mt-1.5"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* SECTION 4: Booth Setup */}
            <Collapsible open={boothSetupSection} onOpenChange={setBoothSetupSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Booth Setup
                    {configureBooths && (
                      <Badge variant="outline" className="ml-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                        Configured
                      </Badge>
                    )}
                  </h3>
                  {boothSetupSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  {!isEditing ? (
                    <div>
                      <Label htmlFor="boothTemplate">Apply Booth Template (optional)</Label>
                      <Select
                        value={selectedBoothTemplateId}
                        onValueChange={(value) => {
                          setSelectedBoothTemplateId(value)
                          if (value !== "none") {
                            setConfigureBooths(true)
                          }
                        }}
                        disabled={loadingBoothTemplates}
                      >
                        <SelectTrigger id="boothTemplate" className="mt-1.5">
                          <SelectValue
                            placeholder={
                              loadingBoothTemplates ? "Loading templates..." : "Select a template"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None — configure booths later</SelectItem>
                          {boothTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Copies booth types and numbered inventory from your organization template
                        library. Manage templates in Vendor Hub Settings → Booths.
                      </p>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <Label htmlFor="configureBooths" className="cursor-pointer">
                      Configure Booth Layout
                    </Label>
                    <Switch
                      id="configureBooths"
                      checked={configureBooths}
                      onCheckedChange={setConfigureBooths}
                    />
                  </div>

                  {configureBooths && (
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="totalBooths">Total Booths</Label>
                          <Input id="totalBooths" type="number" placeholder="50" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="numberingScheme">Numbering Scheme</Label>
                          <Select>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Select scheme" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="numeric">Numeric (1, 2, 3...)</SelectItem>
                              <SelectItem value="alpha">Alphanumeric (A-01, A-02...)</SelectItem>
                              <SelectItem value="row">By Row (Row A, Row B...)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="autoAssign" className="cursor-pointer">
                            Auto-assign booths
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Otherwise assign manually
                          </p>
                        </div>
                        <Switch
                          id="autoAssign"
                          checked={autoAssignBooths}
                          onCheckedChange={setAutoAssignBooths}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* SECTION 5: Vendor Payments */}
            <Collapsible open={paymentsSection} onOpenChange={setPaymentsSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Payments
                    {collectVendorFees && (
                      <Badge variant="outline" className="ml-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                        Enabled
                      </Badge>
                    )}
                  </h3>
                  {paymentsSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="collectFees" className="cursor-pointer">
                      Collect Vendor Fees
                    </Label>
                    <Switch
                      id="collectFees"
                      checked={collectVendorFees}
                      onCheckedChange={setCollectVendorFees}
                    />
                  </div>

                  {collectVendorFees && (
                    <div className="flex flex-col gap-4">
                      <div>
                        <Label htmlFor="defaultFee">Default Booth Fee</Label>
                        <Input
                          id="defaultFee"
                          type="number"
                          placeholder="100"
                          className="mt-1.5"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="customPricing" className="cursor-pointer">
                          Allow custom pricing per booth type
                        </Label>
                        <Switch
                          id="customPricing"
                          checked={customPricing}
                          onCheckedChange={setCustomPricing}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Payment Methods</Label>
                        <div className="flex flex-wrap gap-2">
                          {paymentMethods.map((method) => (
                            <Badge
                              key={method}
                              variant="outline"
                              className={cn(
                                "cursor-pointer transition-colors",
                                selectedPaymentMethods.includes(method) &&
                                  "border-primary bg-primary/10 text-primary"
                              )}
                              onClick={() => togglePaymentMethod(method)}
                            >
                              {method}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="paymentDeadline">Payment Deadline</Label>
                        <Input id="paymentDeadline" type="date" className="mt-1.5" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="requirePayment" className="cursor-pointer">
                            Require payment before approval
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Vendors must pay before their application is approved
                          </p>
                        </div>
                        <Switch
                          id="requirePayment"
                          checked={requirePaymentBeforeApproval}
                          onCheckedChange={setRequirePaymentBeforeApproval}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* SECTION 6: Public Event Info */}
            <Collapsible open={publicInfoSection} onOpenChange={setPublicInfoSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Public Info
                  </h3>
                  {publicInfoSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  <div>
                    <Label htmlFor="publicDescription">Public Description</Label>
                    <Textarea
                      id="publicDescription"
                      placeholder="Describe your event for the public..."
                      className="mt-1.5"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expectedAttendance">Expected Attendance</Label>
                    <Input
                      id="expectedAttendance"
                      type="number"
                      placeholder="2500"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="publicAddress">Public Address (optional override)</Label>
                    <Input
                      id="publicAddress"
                      placeholder="Leave blank to use event location"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventTags">Event Tags</Label>
                    <Input
                      id="eventTags"
                      placeholder="family-friendly, food, shopping"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* SECTION 7: Community Calendar */}
            <Collapsible open={calendarSection} onOpenChange={setCalendarSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Community Calendar
                    {calendarVisibility !== "private" ? (
                      <Badge variant="outline" className="ml-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                        {calendarVisibility === "published" ? "Public" : "Community Visible"}
                      </Badge>
                    ) : null}
                  </h3>
                  {calendarSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  <div>
                    <Label htmlFor="calendarVisibility">Calendar Visibility</Label>
                    <Select
                      value={calendarVisibility}
                      onValueChange={(value) =>
                        setCalendarVisibility(value as BazaarCalendarVisibility)
                      }
                    >
                      <SelectTrigger id="calendarVisibility" className="mt-1.5">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        {BAZAAR_CALENDAR_VISIBILITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {
                        BAZAAR_CALENDAR_VISIBILITY_OPTIONS.find(
                          (option) => option.value === calendarVisibility
                        )?.description
                      }
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* SECTION 8: Internal Notes */}
            <Collapsible open={internalNotesSection} onOpenChange={setInternalNotesSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Internal Notes
                  </h3>
                  {internalNotesSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  <div>
                    <Label htmlFor="internalNotes">Internal Notes</Label>
                    <Textarea
                      id="internalNotes"
                      placeholder="Notes visible only to staff..."
                      className="mt-1.5"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="staffInstructions">Staff Instructions</Label>
                    <Textarea
                      id="staffInstructions"
                      placeholder="Instructions for event staff..."
                      className="mt-1.5"
                      rows={3}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* SECTION 9: Integrations */}
            <Collapsible open={integrationsSection} onOpenChange={setIntegrationsSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Integrations
                  </h3>
                  {integrationsSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  <div>
                    <Label htmlFor="linkInternalEvent">Link to Event Management (optional)</Label>
                    <Select
                      value={internalEventId}
                      onValueChange={setInternalEventId}
                      disabled={loadingInternalEvents}
                    >
                      <SelectTrigger id="linkInternalEvent" className="mt-1.5">
                        <SelectValue
                          placeholder={
                            loadingInternalEvents ? "Loading events..." : "Select internal event"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {internalEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name}
                            {event.start_at
                              ? ` — ${new Date(event.start_at).toLocaleDateString()}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Connect this bazaar to an Event Management record without duplicating event
                      data.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="linkBooking">Link to Booking</Label>
                    <Select>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select existing or create later" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="create">Create New Booking</SelectItem>
                        <SelectItem value="existing">Link to Existing...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableTicketing" className="cursor-pointer">
                        Enable Ticketing
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Sell tickets for this event
                      </p>
                    </div>
                    <Switch
                      id="enableTicketing"
                      checked={enableTicketing}
                      onCheckedChange={setEnableTicketing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkProgram">Link to Program (optional)</Label>
                    <Select>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Sticky Footer */}
        <SheetFooter className="flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-between">
          {saveError ? (
            <p className="w-full text-sm text-destructive sm:order-first sm:w-auto">{saveError}</p>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
  {saving
    ? isEditing
      ? "Saving..."
      : "Creating..."
    : isEditing
      ? "Save Changes"
      : "Create Event"}
</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
