"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  User,
  X,
} from "lucide-react"

// Mock organization data
const organizations: Record<string, {
  id: string
  name: string
  type: string
  contact: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  totalBookings: number
  totalSpent: number
  status: string
  notes: string
  createdAt: string
  taxExempt: boolean
  taxId: string
}> = {
  "org-1": {
    id: "org-1",
    name: "Springfield Community Center",
    type: "Non-Profit",
    contact: "Robert Williams",
    email: "rwilliams@springfieldcc.org",
    phone: "+1 (555) 111-2222",
    address: "100 Community Drive",
    city: "Springfield",
    state: "IL",
    zip: "62702",
    totalBookings: 12,
    totalSpent: 18500,
    status: "Active",
    notes: "Long-term partner. Hosts monthly community events. 15% discount applied.",
    createdAt: "2022-03-15",
    taxExempt: true,
    taxId: "XX-XXXXXXX",
  },
  "org-2": {
    id: "org-2",
    name: "Tech Innovators Inc.",
    type: "Corporate",
    contact: "Amanda Foster",
    email: "afoster@techinnovators.com",
    phone: "+1 (555) 222-3333",
    address: "500 Innovation Blvd",
    city: "Chicago",
    state: "IL",
    zip: "60606",
    totalBookings: 8,
    totalSpent: 24000,
    status: "VIP",
    notes: "Premium corporate client. Quarterly team events and annual conference.",
    createdAt: "2023-01-20",
    taxExempt: false,
    taxId: "",
  },
  "org-4": {
    id: "org-4",
    name: "Harmony Wedding Planners",
    type: "Corporate",
    contact: "Lisa Chang",
    email: "lisa@harmonyweddings.com",
    phone: "+1 (555) 444-5555",
    address: "75 Bridal Way",
    city: "Naperville",
    state: "IL",
    zip: "60563",
    totalBookings: 15,
    totalSpent: 32000,
    status: "VIP",
    notes: "Top referring partner. Brings multiple wedding bookings monthly. VIP pricing.",
    createdAt: "2022-08-10",
    taxExempt: false,
    taxId: "",
  },
}

// Mock booking history
const bookingHistory = [
  {
    id: "bk-1",
    date: "2024-01-18",
    space: "Main Hall",
    eventType: "Corporate Meeting",
    duration: "8 hours",
    amount: 2400,
    status: "Completed",
  },
  {
    id: "bk-2",
    date: "2024-01-05",
    space: "Main Hall + Garden",
    eventType: "Annual Gala",
    duration: "Full Day",
    amount: 4500,
    status: "Completed",
  },
  {
    id: "bk-3",
    date: "2023-12-15",
    space: "Conference Room A",
    eventType: "Board Meeting",
    duration: "4 hours",
    amount: 600,
    status: "Completed",
  },
  {
    id: "bk-4",
    date: "2024-02-20",
    space: "Main Hall",
    eventType: "Team Building",
    duration: "6 hours",
    amount: 1800,
    status: "Upcoming",
  },
  {
    id: "bk-5",
    date: "2024-03-15",
    space: "Full Venue",
    eventType: "Conference",
    duration: "Full Day",
    amount: 5500,
    status: "Upcoming",
  },
  {
    id: "bk-6",
    date: "2023-11-10",
    space: "Classroom B",
    eventType: "Training Session",
    duration: "3 hours",
    amount: 450,
    status: "Completed",
  },
]

export default function OrganizationDetailPage() {
  const params = useParams()
  const customerId = params.id as string
  const customer = organizations[customerId] || organizations["org-1"]

  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <>
      <Header title="Organization Details" />
      <div className="p-6">
        {/* Back link */}
        <Link
          href="/events/external/customers"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{customer.name}</h1>
                <Badge
                  variant={customer.status === "VIP" ? "default" : "secondary"}
                  className={customer.status === "VIP" ? "bg-amber-500" : ""}
                >
                  {customer.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">{customer.type} - Customer since {new Date(customer.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={() => setIsEditing(false)}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-semibold">{customer.totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-semibold">${customer.totalSpent.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg. per Booking</p>
                  <p className="text-2xl font-semibold">
                    ${Math.round(customer.totalSpent / customer.totalBookings).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tax Exempt</p>
                  <p className="text-2xl font-semibold">{customer.taxExempt ? "Yes" : "No"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bookings">Booking History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Organization Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization Details</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {isEditing ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Organization Name</Label>
                        <Input defaultValue={customer.name} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label>Type</Label>
                          <Select defaultValue={customer.type}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                              <SelectItem value="Corporate">Corporate</SelectItem>
                              <SelectItem value="Educational">Educational</SelectItem>
                              <SelectItem value="Religious">Religious</SelectItem>
                              <SelectItem value="Government">Government</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Status</Label>
                          <Select defaultValue={customer.status}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="VIP">VIP</SelectItem>
                              <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label>Tax Exempt</Label>
                          <Select defaultValue={customer.taxExempt ? "yes" : "no"}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Tax ID</Label>
                          <Input defaultValue={customer.taxId} placeholder="XX-XXXXXXX" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between border-b pb-3">
                        <span className="text-muted-foreground">Organization Type</span>
                        <span className="font-medium">{customer.type}</span>
                      </div>
                      {customer.taxExempt && (
                        <div className="flex items-center justify-between border-b pb-3">
                          <span className="text-muted-foreground">Tax ID</span>
                          <span className="font-medium">{customer.taxId}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Primary Contact */}
              <Card>
                <CardHeader>
                  <CardTitle>Primary Contact</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {isEditing ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Contact Name</Label>
                        <Input defaultValue={customer.contact} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Email</Label>
                        <Input type="email" defaultValue={customer.email} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Phone</Label>
                        <Input defaultValue={customer.phone} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.contact}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.phone}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Address */}
              <Card>
                <CardHeader>
                  <CardTitle>Address</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {isEditing ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Street Address</Label>
                        <Input defaultValue={customer.address} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-2">
                          <Label>City</Label>
                          <Input defaultValue={customer.city} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>State</Label>
                          <Input defaultValue={customer.state} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>ZIP</Label>
                          <Input defaultValue={customer.zip} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p>{customer.address}</p>
                        <p>{customer.city}, {customer.state} {customer.zip}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <Textarea defaultValue={customer.notes} rows={3} />
                  ) : (
                    <p className="text-muted-foreground">{customer.notes || "No notes added."}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Booking History</CardTitle>
                <CardDescription>All venue bookings by this organization</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Space</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingHistory.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>{new Date(booking.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{booking.space}</TableCell>
                        <TableCell>{booking.eventType}</TableCell>
                        <TableCell>{booking.duration}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${booking.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={booking.status === "Upcoming" ? "default" : "secondary"}
                          >
                            {booking.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
