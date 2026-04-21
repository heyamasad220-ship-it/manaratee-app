"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CloudUpload,
  Info,
  Plus,
  Pencil,
  X,
  ArrowUpDown,
  CheckSquare,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { allEvents, bookingSpaces } from "@/lib/mock-data"

type LocationType = "internal" | "external" | "virtual"

interface VolunteerSlot {
  id: string
  name: string
  count: number
}

interface VolunteerDate {
  id: string
  date: string
  dayName: string
  startTime: string
  endTime: string
  slots: VolunteerSlot[]
}

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
  description?: string
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))
const MONTHLY_ORDINALS = [
  "1st day", "1st weekday", "1st weekend day",
  "1st Sunday", "1st Monday", "1st Tuesday", "1st Wednesday", "1st Thursday", "1st Friday", "1st Saturday",
  "2nd Sunday", "2nd Monday", "2nd Tuesday", "2nd Wednesday", "2nd Thursday", "2nd Friday", "2nd Saturday",
  "3rd Sunday", "3rd Monday", "3rd Tuesday", "3rd Wednesday", "3rd Thursday", "3rd Friday", "3rd Saturday",
  "4th Sunday", "4th Monday", "4th Tuesday", "4th Wednesday", "4th Thursday", "4th Friday", "4th Saturday",
  "Last day", "Last weekday", "Last weekend day",
  "Last Sunday", "Last Monday", "Last Tuesday", "Last Wednesday", "Last Thursday", "Last Friday", "Last Saturday",
]
const TIME_OPTIONS = [
  "12:00 AM","12:30 AM","1:00 AM","1:30 AM","2:00 AM","2:30 AM","3:00 AM","3:30 AM",
  "4:00 AM","4:30 AM","5:00 AM","5:30 AM","6:00 AM","6:30 AM","7:00 AM","7:30 AM",
  "8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
  "12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM",
  "4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM",
  "8:00 PM","8:30 PM","9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM",
]

interface AddEventFormProps {
  initialDate?: Date
  initialHour?: number
  onCancel?: () => void
  onSave?: () => void
}

export function AddEventForm({ initialDate, initialHour, onCancel, onSave }: AddEventFormProps = {}) {
  const router = useRouter()
  const [locationType, setLocationType] = useState<LocationType>("internal")
  const [sellTickets, setSellTickets] = useState(false)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [showAddTicketDialog, setShowAddTicketDialog] = useState(false)
  const [newTicketForm, setNewTicketForm] = useState({ name: "", price: "", quantity: "", description: "" })
  const [volunteerSignUps, setVolunteerSignUps] = useState(false)
  const [childcareEnabled, setChildcareEnabled] = useState(false)
  const [vendorsEnabled, setVendorsEnabled] = useState(false)
  const [volunteerDates, setVolunteerDates] = useState<VolunteerDate[]>([
    {
      id: "vd-1",
      date: "02/14/2026",
      dayName: "Sat",
      startTime: "11:00 am",
      endTime: "1:00 pm",
      slots: [
        { id: "vs-1", name: "Cotton Candy Sales", count: 1 },
        { id: "vs-2", name: "Popcorn Sales", count: 1 },
        { id: "vs-3", name: "Registration (adults only)", count: 1 },
      ],
    },
  ])
  const [showAddDateDialog, setShowAddDateDialog] = useState(false)
  const [showAddSlotDialog, setShowAddSlotDialog] = useState(false)
  const [editingDate, setEditingDate] = useState<VolunteerDate | null>(null)
  const [editingSlot, setEditingSlot] = useState<{ dateId: string; slot: VolunteerSlot } | null>(null)
  const [newDateForm, setNewDateForm] = useState({ date: "", startTime: "9:00 AM", endTime: "11:00 AM" })
  const [newSlotForm, setNewSlotForm] = useState({ name: "", count: 1 })
  const [isRecurring, setIsRecurring] = useState(false)
  const [repeatFreq, setRepeatFreq] = useState("weekly")
  const [weekInterval, setWeekInterval] = useState("1")
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [dailyRule, setDailyRule] = useState("mon-fri")
  const [dailyInterval, setDailyInterval] = useState("1")
  const [monthlyRule, setMonthlyRule] = useState("the")
  const [monthlyDay, setMonthlyDay] = useState("1")
  const [monthlyDayInterval, setMonthlyDayInterval] = useState("1")
  const [monthlyOrdinal, setMonthlyOrdinal] = useState("1st Friday")
  const [monthlyOrdinalInterval, setMonthlyOrdinalInterval] = useState("1")
  const [endType, setEndType] = useState("end-by")

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Event Details */}
      <div className="flex flex-col gap-5">
        <h3 className="text-base font-semibold text-foreground">Event Details</h3>
        <Separator />

        <div className="flex flex-col gap-1.5">
          <Label>Event Type</Label>
          <Select>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jummah">Jummah Prayer</SelectItem>
              <SelectItem value="lecture">Lecture/Talk</SelectItem>
              <SelectItem value="class">Class/Workshop</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="community">Community Event</SelectItem>
              <SelectItem value="fundraiser">Fundraiser</SelectItem>
              <SelectItem value="youth">Youth Program</SelectItem>
              <SelectItem value="sisters">Sisters Program</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Event Name</Label>
          <Input placeholder="Event's name" className="bg-card" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Description</Label>
          <Textarea
            placeholder="Enter event description..."
            className="min-h-24 bg-card"
          />
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <Label>Date</Label>
          <Select>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Thursday, February 19, 2026" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-02-19">Thursday, February 19, 2026</SelectItem>
              <SelectItem value="2026-02-20">Friday, February 20, 2026</SelectItem>
              <SelectItem value="2026-02-21">Saturday, February 21, 2026</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Time<span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <Select defaultValue="2:00 PM">
              <SelectTrigger className="w-full bg-card">
                <SelectValue placeholder="From" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={`from-${t}`} value={t}>
                    From {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="2:30 PM">
              <SelectTrigger className="w-full bg-card">
                <SelectValue placeholder="To" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={`to-${t}`} value={t}>
                    to {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recurring toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="recurring"
            checked={isRecurring}
            onCheckedChange={(checked) => setIsRecurring(checked === true)}
          />
          <Label htmlFor="recurring" className="font-normal">Recurring Event?</Label>
        </div>

        {/* Recurring Options */}
        {isRecurring && (
          <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
            {/* Repeat + Weekly Rule */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Repeat<span className="text-destructive">*</span>
                </Label>
                <Select value={repeatFreq} onValueChange={setRepeatFreq}>
                  <SelectTrigger className="w-36 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {repeatFreq === "daily" && (
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Daily rule<span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup value={dailyRule} onValueChange={setDailyRule} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <RadioGroupItem value="mon-fri" id="daily-mon-fri" />
                      <Label htmlFor="daily-mon-fri" className="font-normal">Monday to Friday</Label>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <RadioGroupItem value="sat-sun" id="daily-sat-sun" />
                      <Label htmlFor="daily-sat-sun" className="font-normal">Saturday & Sunday</Label>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <RadioGroupItem value="every" id="daily-every" />
                      <Label htmlFor="daily-every" className="font-normal whitespace-nowrap">Every</Label>
                      <Input
                        type="number"
                        min={1}
                        value={dailyInterval}
                        onChange={(e) => setDailyInterval(e.target.value)}
                        className="w-16 bg-background text-center"
                        disabled={dailyRule !== "every"}
                      />
                      <span className="text-sm text-muted-foreground">day(s)</span>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {repeatFreq === "weekly" && (
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Weekly rule<span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Every</span>
                    <Input
                      type="number"
                      min={1}
                      value={weekInterval}
                      onChange={(e) => setWeekInterval(e.target.value)}
                      className="w-16 bg-background text-center"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">week(s) on</span>
                    <Select value="__multi__">
                      <SelectTrigger className="w-40 bg-background">
                        <span className="truncate text-sm">
                          {selectedDays.length > 0
                            ? selectedDays.map((d) => d.slice(0, 3)).join(", ")
                            : "Select days"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <div
                            key={day}
                            className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-sm hover:bg-accent rounded-sm"
                            onClick={(e) => {
                              e.preventDefault()
                              setSelectedDays((prev) =>
                                prev.includes(day)
                                  ? prev.filter((d) => d !== day)
                                  : [...prev, day]
                              )
                            }}
                          >
                            <Checkbox
                              checked={selectedDays.includes(day)}
                              onCheckedChange={(checked) => {
                                setSelectedDays((prev) =>
                                  checked
                                    ? [...prev, day]
                                    : prev.filter((d) => d !== day)
                                )
                              }}
                              className="h-4 w-4"
                            />
                            <span>{day}</span>
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {repeatFreq === "monthly" && (
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Monthly rule<span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup value={monthlyRule} onValueChange={setMonthlyRule} className="flex flex-col gap-3">
                    {/* Option 1: Day N of every M month(s) */}
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="day" id="monthly-day" />
                      <Label htmlFor="monthly-day" className="font-normal">Day</Label>
                      <Select value={monthlyDay} onValueChange={setMonthlyDay} disabled={monthlyRule !== "day"}>
                        <SelectTrigger className="w-20 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_DAYS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">of every</span>
                      <Input
                        type="number"
                        min={1}
                        value={monthlyDayInterval}
                        onChange={(e) => setMonthlyDayInterval(e.target.value)}
                        className="w-16 bg-background text-center"
                        disabled={monthlyRule !== "day"}
                      />
                      <span className="text-sm text-muted-foreground">month(s)</span>
                    </div>

                    {/* Option 2: The [ordinal] of every M month(s) */}
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="the" id="monthly-the" />
                      <Label htmlFor="monthly-the" className="font-normal">The</Label>
                      <Select value={monthlyOrdinal} onValueChange={setMonthlyOrdinal} disabled={monthlyRule !== "the"}>
                        <SelectTrigger className="w-44 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHLY_ORDINALS.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">of every</span>
                      <Input
                        type="number"
                        min={1}
                        value={monthlyOrdinalInterval}
                        onChange={(e) => setMonthlyOrdinalInterval(e.target.value)}
                        className="w-16 bg-background text-center"
                        disabled={monthlyRule !== "the"}
                      />
                      <span className="text-sm text-muted-foreground">month(s)</span>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            {/* End */}
            <div className="flex flex-col gap-3">
              <Label>
                End<span className="text-destructive">*</span>
              </Label>
              <RadioGroup value={endType} onValueChange={setEndType} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="end-by" id="end-by" />
                  <Label htmlFor="end-by" className="font-normal whitespace-nowrap">End by</Label>
                  <Select>
                    <SelectTrigger className="w-56 bg-background">
                      <SelectValue placeholder="Sunday, March 1, 2026" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026-03-01">Sunday, March 1, 2026</SelectItem>
                      <SelectItem value="2026-04-01">Wednesday, April 1, 2026</SelectItem>
                      <SelectItem value="2026-06-01">Monday, June 1, 2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="end-after" id="end-after" />
                  <Label htmlFor="end-after" className="font-normal whitespace-nowrap">End after</Label>
                  <Input
                    type="number"
                    min={1}
                    defaultValue={2}
                    className="w-20 bg-background text-center"
                    disabled={endType !== "end-after"}
                  />
                  <span className="text-sm text-muted-foreground">occurrence(s)</span>
                </div>
              </RadioGroup>
            </div>

            {/* Exceptions */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Exceptions<span className="text-destructive">*</span>
              </Label>
              <Select>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="No exceptions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No exceptions</SelectItem>
                  <SelectItem value="holidays">Skip holidays</SelectItem>
                  <SelectItem value="custom">Custom exceptions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Location */}
      <div className="flex flex-col gap-5">
        <h3 className="text-base font-semibold text-foreground">Location</h3>
        <Separator />

        <RadioGroup
          value={locationType}
          onValueChange={(val) => setLocationType(val as LocationType)}
          className="flex items-center gap-8"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="internal" id="loc-internal" />
            <Label htmlFor="loc-internal" className="font-normal">Internal</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="external" id="loc-external" />
            <Label htmlFor="loc-external" className="font-normal">External</Label>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="virtual" id="loc-virtual" />
            <Label htmlFor="loc-virtual" className="font-normal">Virtual</Label>
          </div>
        </RadioGroup>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Left column - shows for external */}
          {locationType === "external" && (
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-1.5">
                <Label className="font-semibold">Venue Name</Label>
                <Input placeholder="Enter venue name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="font-semibold">Address</Label>
                <Textarea placeholder="Enter venue address" className="min-h-20" />
              </div>
            </div>
          )}
        </div>

        {/* Internal location - full width */}
        {locationType === "internal" && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            {/* Row 1: Select Space & Setup Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="font-semibold">Select Space</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select space" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingSpaces.map((space) => (
                      <SelectItem key={space.id} value={space.id}>
                        {space.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="font-semibold">Setup Style</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select setup style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round-tables">Round Tables</SelectItem>
                    <SelectItem value="u-shape">U-Shape Rectangular Tables</SelectItem>
                    <SelectItem value="theater">Theater Style</SelectItem>
                    <SelectItem value="classroom">Classroom Style</SelectItem>
                    <SelectItem value="boardroom">Boardroom Style</SelectItem>
                    <SelectItem value="banquet">Banquet Style</SelectItem>
                    <SelectItem value="hollow-square">Hollow Square</SelectItem>
                    <SelectItem value="reception">Reception / Standing</SelectItem>
                    <SelectItem value="custom">Custom Layout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="font-semibold">AV Needs</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select AV requirements" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="projector">Projector Only</SelectItem>
                    <SelectItem value="screen">Screen Only</SelectItem>
                    <SelectItem value="projector-screen">Projector + Screen</SelectItem>
                    <SelectItem value="microphone">Microphone</SelectItem>
                    <SelectItem value="sound-system">Sound System</SelectItem>
                    <SelectItem value="full-av">Full AV Setup (Projector, Screen, Mic, Sound)</SelectItem>
                    <SelectItem value="video-conf">Video Conferencing Equipment</SelectItem>
                    <SelectItem value="live-stream">Live Streaming Setup</SelectItem>
                    <SelectItem value="custom">Custom AV Requirements</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="font-semibold">Number of Attendees</Label>
                <Input type="number" placeholder="Enter attendees" min={1} />
              </div>
            </div>
            {/* Row 2: Additional Setup Notes (full width) */}
            <div className="flex flex-col gap-1.5">
              <Label className="font-semibold">Additional Setup Notes</Label>
              <Textarea 
                placeholder="Enter any additional setup requirements or special instructions..."
                className="min-h-20"
              />
            </div>
          </div>
        )}

        {/* Virtual location */}
        {locationType === "virtual" && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-1.5">
              <Label className="font-semibold">Platform</Label>
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="meet">Google Meet</SelectItem>
                  <SelectItem value="webex">Webex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="font-semibold">Meeting Link</Label>
              <Input placeholder="https://..." />
            </div>
          </div>
        )}
      </div>

      {/* Event Flyer */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-foreground">Event Flyer</h3>
        <Separator />
        <div className="flex h-36 w-52 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card transition-colors hover:border-primary/40 hover:bg-accent">
          <CloudUpload className="h-8 w-8 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <CloudUpload className="h-4 w-4" />
            Upload Flyer
          </span>
        </div>
      </div>

      {/* Additional Options */}
      <div className="flex flex-col gap-5">
        <h3 className="text-base font-semibold text-foreground">Additional Options</h3>
        <Separator />

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          {/* Sell Tickets Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-medium">Sell Tickets</Label>
              <p className="text-xs text-muted-foreground">
                Sell tickets for this event
              </p>
            </div>
            <Switch
              checked={sellTickets}
              onCheckedChange={setSellTickets}
            />
          </div>

          {/* Ticket Settings - shown when toggle is on */}
          {sellTickets && (
            <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-background p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">Ticket Types</Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    className="gap-1.5 text-primary"
                    onClick={() => setShowAddTicketDialog(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Ticket Type
                  </Button>
                </div>

                {/* Ticket Types List */}
                {ticketTypes.length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ticketTypes.map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">{ticket.name}</TableCell>
                            <TableCell>${ticket.price.toFixed(2)}</TableCell>
                            <TableCell>{ticket.quantity}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setTicketTypes(prev => prev.filter(t => t.id !== ticket.id))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {ticketTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No ticket types added yet.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Ticket Unavailability Date</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" className="bg-card" />
                  <Input type="time" className="bg-card" />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Volunteer Sign-ups Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-medium">Volunteer Sign-ups</Label>
              <p className="text-xs text-muted-foreground">
                Allow volunteers to sign up for this event
              </p>
            </div>
            <Switch
              checked={volunteerSignUps}
              onCheckedChange={setVolunteerSignUps}
            />
          </div>

          {/* Volunteer Slots Management - shown when toggle is on */}
          {volunteerSignUps && (
            <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-background p-4">
              {/* Header with buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Sort by Time</span>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddDateDialog(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Time
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddSlotDialog(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Slots
                  </Button>
                </div>
              </div>

              {/* Slots Table */}
              <div className="overflow-hidden rounded-lg border border-border">
                {/* Table Header */}
                <div className="grid grid-cols-2 bg-muted">
                  <div className="flex items-center justify-between border-r border-border px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Time Slots
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Available Positions
                    </span>
                  </div>
                </div>

                {/* Table Body */}
                {volunteerDates.map((dateRow, dateIndex) => (
                  <div key={dateRow.id} className="grid grid-cols-2">
                    {/* Time Cell */}
                    <div className={`flex items-start justify-between border-r border-border bg-card px-4 py-3 ${dateIndex > 0 ? "border-t" : ""}`}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {dateRow.startTime} - {dateRow.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingDate(dateRow)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive"
                          onClick={() => setVolunteerDates(prev => prev.filter(d => d.id !== dateRow.id))}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Slots Cell */}
                    <div className={`flex flex-col bg-background ${dateIndex > 0 ? "border-t border-border" : ""}`}>
                      {dateRow.slots.map((slot, slotIndex) => (
                        <div
                          key={slot.id}
                          className={`flex items-center justify-between px-4 py-2.5 ${slotIndex > 0 ? "border-t border-border" : ""}`}
                        >
                          <span className="text-sm text-foreground">
                            {slot.name} ({slot.count})
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingSlot({ dateId: dateRow.id, slot })}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setVolunteerDates(prev =>
                                  prev.map(d =>
                                    d.id === dateRow.id
                                      ? { ...d, slots: d.slots.filter(s => s.id !== slot.id) }
                                      : d
                                  )
                                )
                              }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {volunteerDates.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                    No time slots added yet. Click &quot;Add Time&quot; to get started.
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Childcare Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-medium">Childcare</Label>
              <p className="text-xs text-muted-foreground">
                Offer childcare services for this event
              </p>
            </div>
            <Switch
              checked={childcareEnabled}
              onCheckedChange={setChildcareEnabled}
            />
          </div>

          {/* Childcare Settings - shown when toggle is on */}
          {childcareEnabled && (
            <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">Childcare Settings</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Capacity</Label>
                  <Input type="number" placeholder="20" className="bg-card" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Age Range</Label>
                  <Select>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select age range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-2">0-2 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="6-10">6-10 years</SelectItem>
                      <SelectItem value="0-10">All ages (0-10)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Registration Deadline</Label>
                <Input type="date" className="bg-card" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="require-allergy" />
                <Label htmlFor="require-allergy" className="font-normal text-sm">
                  Require allergy/dietary information
                </Label>
              </div>
            </div>
          )}

          <Separator />

          {/* Vendors Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-medium">Vendors</Label>
              <p className="text-xs text-muted-foreground">
                Allow vendors to participate in this event
              </p>
            </div>
            <Switch
              checked={vendorsEnabled}
              onCheckedChange={setVendorsEnabled}
            />
          </div>

          {/* Vendor Settings - shown when toggle is on */}
          {vendorsEnabled && (
            <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">Vendor Settings</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Max Vendors</Label>
                  <Input type="number" placeholder="10" className="bg-card" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Application Deadline</Label>
                  <Input type="date" className="bg-card" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Vendor Fee</Label>
                <Input type="number" placeholder="0.00" className="bg-card" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="require-approval" />
                <Label htmlFor="require-approval" className="font-normal text-sm">
                  Require approval for vendor applications
                </Label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" size="lg" onClick={() => onCancel ? onCancel() : router.back()}>
          Cancel
        </Button>
        <Button size="lg" className="px-8" onClick={() => onSave?.()}>
          Submit Request
        </Button>
      </div>

      {/* Add Ticket Type Dialog */}
      <Dialog open={showAddTicketDialog} onOpenChange={setShowAddTicketDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ticket Type</DialogTitle>
            <DialogDescription>
              Create a new ticket type for this event
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>Ticket Name</Label>
              <Input
                placeholder="e.g., General Admission, VIP"
                value={newTicketForm.name}
                onChange={(e) => setNewTicketForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={newTicketForm.price}
                  onChange={(e) => setNewTicketForm(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Quantity Available</Label>
                <Input
                  type="number"
                  placeholder="100"
                  min="1"
                  value={newTicketForm.quantity}
                  onChange={(e) => setNewTicketForm(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Describe what's included with this ticket"
                value={newTicketForm.description}
                onChange={(e) => setNewTicketForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTicketDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newTicketForm.name && newTicketForm.price && newTicketForm.quantity) {
                  setTicketTypes(prev => [
                    ...prev,
                    {
                      id: `ticket-${Date.now()}`,
                      name: newTicketForm.name,
                      price: parseFloat(newTicketForm.price),
                      quantity: parseInt(newTicketForm.quantity),
                      description: newTicketForm.description || undefined,
                    },
                  ])
                  setNewTicketForm({ name: "", price: "", quantity: "", description: "" })
                  setShowAddTicketDialog(false)
                }
              }}
            >
              Add Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Time Dialog */}
      <Dialog open={showAddDateDialog} onOpenChange={setShowAddDateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Time Slot</DialogTitle>
            <DialogDescription>
              Add a new time slot for volunteer sign-ups
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Start Time</Label>
                <Select
                  value={newDateForm.startTime}
                  onValueChange={(val) => setNewDateForm(prev => ({ ...prev, startTime: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>End Time</Label>
                <Select
                  value={newDateForm.endTime}
                  onValueChange={(val) => setNewDateForm(prev => ({ ...prev, endTime: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setVolunteerDates(prev => [
                  ...prev,
                  {
                    id: `vd-${Date.now()}`,
                    date: "",
                    dayName: "",
                    startTime: newDateForm.startTime.toLowerCase(),
                    endTime: newDateForm.endTime.toLowerCase(),
                    slots: [],
                  },
                ])
                setNewDateForm({ date: "", startTime: "9:00 AM", endTime: "11:00 AM" })
                setShowAddDateDialog(false)
              }}
            >
              Add Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Slot Dialog */}
      <Dialog open={showAddSlotDialog} onOpenChange={setShowAddSlotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Slot</DialogTitle>
            <DialogDescription>
              Add a new volunteer slot to all dates
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>Slot Name</Label>
              <Input
                placeholder="e.g., Registration, Food Service"
                value={newSlotForm.name}
                onChange={(e) => setNewSlotForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Number of Volunteers Needed</Label>
              <Input
                type="number"
                min={1}
                value={newSlotForm.count}
                onChange={(e) => setNewSlotForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSlotDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newSlotForm.name) {
                  setVolunteerDates(prev =>
                    prev.map(d => ({
                      ...d,
                      slots: [
                        ...d.slots,
                        {
                          id: `vs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          name: newSlotForm.name,
                          count: newSlotForm.count,
                        },
                      ],
                    }))
                  )
                  setNewSlotForm({ name: "", count: 1 })
                  setShowAddSlotDialog(false)
                }
              }}
            >
              Add Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Time Dialog */}
      <Dialog open={!!editingDate} onOpenChange={(open) => !open && setEditingDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Time Slot</DialogTitle>
            <DialogDescription>
              Update the time for this slot
            </DialogDescription>
          </DialogHeader>
          {editingDate && (
            <div className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Start Time</Label>
                  <Select
                    value={editingDate.startTime.toUpperCase().replace(" ", " ")}
                    onValueChange={(val) => setEditingDate(prev => prev ? { ...prev, startTime: val.toLowerCase() } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>End Time</Label>
                  <Select
                    value={editingDate.endTime.toUpperCase().replace(" ", " ")}
                    onValueChange={(val) => setEditingDate(prev => prev ? { ...prev, endTime: val.toLowerCase() } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingDate) {
                  setVolunteerDates(prev =>
                    prev.map(d => d.id === editingDate.id ? editingDate : d)
                  )
                  setEditingDate(null)
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Slot Dialog */}
      <Dialog open={!!editingSlot} onOpenChange={(open) => !open && setEditingSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Slot</DialogTitle>
            <DialogDescription>
              Update the slot details
            </DialogDescription>
          </DialogHeader>
          {editingSlot && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Label>Slot Name</Label>
                <Input
                  value={editingSlot.slot.name}
                  onChange={(e) => setEditingSlot(prev => prev ? { ...prev, slot: { ...prev.slot, name: e.target.value } } : null)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Number of Volunteers Needed</Label>
                <Input
                  type="number"
                  min={1}
                  value={editingSlot.slot.count}
                  onChange={(e) => setEditingSlot(prev => prev ? { ...prev, slot: { ...prev.slot, count: parseInt(e.target.value) || 1 } } : null)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSlot(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingSlot) {
                  setVolunteerDates(prev =>
                    prev.map(d =>
                      d.id === editingSlot.dateId
                        ? { ...d, slots: d.slots.map(s => s.id === editingSlot.slot.id ? editingSlot.slot : s) }
                        : d
                    )
                  )
                  setEditingSlot(null)
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
