"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Search,
  Plus,
  Building2,
  User,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  Heart,
  TrendingUp,
} from "lucide-react"

const tabs = ["Individuals", "Organizations"] as const
type Tab = (typeof tabs)[number]




export default function DonorsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Individuals")
  const [searchIndividuals, setSearchIndividuals] = useState("")
  const [searchOrganizations, setSearchOrganizations] = useState("")
  const [statusFilterInd, setStatusFilterInd] = useState("all")
  const [statusFilterOrg, setStatusFilterOrg] = useState("all")
  const [showAddIndividualDialog, setShowAddIndividualDialog] = useState(false)
  const [showAddOrganizationDialog, setShowAddOrganizationDialog] = useState(false)
  const [allDonors, setAllDonors] = useState<any[]>([])
const supabase = createClient()

useEffect(() => {
  const fetchDonors = async () => {
    const { data, error } = await supabase
      .from("donors") // Make sure this matches your actual table name
      .select("*")

    if (error) {
      console.error("Error fetching donors:", error)
    } else {
      setAllDonors(
  (data || []).map((d) => ({
    id: d.id,
    donor_type: d.donor_type,
    name: d.full_name, // adjust if needed
    email: d.email,
    phone: d.phone,
    totalDonations: d.total_donations || 0,
    donationCount: d.donation_count || 0,
    lastDonation: d.last_donation || "",
    preferredCategory: d.preferred_category || "",
    status: d.status || "Active",
    hasPledge: d.has_pledge || false,
    contact: d.contact_person || "",
    type: d.organization_type || "",
  }))
)
    }
  }

  fetchDonors()

}, [])
  
 const individuals = allDonors.filter(
  (d) => (d.donor_type || "").toLowerCase() === "individual"
)

const organizations = allDonors.filter(
  (d) => (d.donor_type || "").toLowerCase() === "organization"
)

  const filteredIndividuals = individuals.filter((ind) => {
    const matchesSearch = (ind.name || "").toLowerCase().includes(searchIndividuals.toLowerCase()) ||
    (ind.email || "").toLowerCase().includes(searchIndividuals.toLowerCase())
    const matchesStatus = statusFilterInd === "all" || ind.status === statusFilterInd
    return matchesSearch && matchesStatus
  })

  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch = (org.name || "").toLowerCase().includes(searchOrganizations.toLowerCase()) ||
      (org.email || "").toLowerCase().includes(searchOrganizations.toLowerCase()) ||
      (org.contact || "").toLowerCase().includes(searchOrganizations.toLowerCase())
    const matchesStatus = statusFilterOrg === "all" || org.status === statusFilterOrg
    return matchesSearch && matchesStatus
  })

  const totalIndividualDonations = individuals.reduce((sum, ind) => sum + ind.totalDonations, 0)
  const totalOrganizationDonations = organizations.reduce((sum, org) => sum + org.totalDonations, 0)

  return (
    <>
      <Header title="Donors" />
      <div className="p-6">
        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Individual Donors
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{individuals.length}</div>
              <p className="text-xs text-muted-foreground">
                ${totalIndividualDonations.toLocaleString()} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Organization Donors
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organizations.length}</div>
              <p className="text-xs text-muted-foreground">
                ${totalOrganizationDonations.toLocaleString()} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Pledges
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {individuals.filter(i => i.hasPledge).length + organizations.filter(o => o.hasPledge).length}
              </div>
              <p className="text-xs text-muted-foreground">Recurring commitments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Donations
              </CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(totalIndividualDonations + totalOrganizationDonations).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">All-time contributions</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-0 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              suppressHydrationWarning
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                {tab === "Individuals" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                {tab}
              </div>
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Individuals Tab */}
        {activeTab === "Individuals" && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Individual Donors</CardTitle>
                  <CardDescription>
                    Manage individual donors and their donation history
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddIndividualDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Individual
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchIndividuals}
                    onChange={(e) => setSearchIndividuals(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilterInd} onValueChange={setStatusFilterInd}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Major Donor">Major Donor</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Total Donations</TableHead>
                      <TableHead>Last Donation</TableHead>
                      <TableHead>Preferred Category</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIndividuals.map((donor) => (
                      <TableRow key={donor.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {donor.name.split(" ").map((n: string) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link
                                href={`/donations/donors/individuals/${donor.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {donor.name}
                              </Link>
                              {donor.hasPledge && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Pledge
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {donor.email}
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {donor.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">${donor.totalDonations.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {donor.donationCount} donations
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {donor.lastDonation}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{donor.preferredCategory}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              donor.status === "Major Donor"
                                ? "default"
                                : donor.status === "New"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {donor.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Organizations Tab */}
        {activeTab === "Organizations" && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Organization Donors</CardTitle>
                  <CardDescription>
                    Manage organization donors and their donation history
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddOrganizationDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Organization
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, contact, or email..."
                    value={searchOrganizations}
                    onChange={(e) => setSearchOrganizations(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilterOrg} onValueChange={setStatusFilterOrg}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Major Donor">Major Donor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Total Donations</TableHead>
                      <TableHead>Last Donation</TableHead>
                      <TableHead>Preferred Category</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.length === 0 && (
  <TableRow>
    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
      No organization donors found.
    </TableCell>
  </TableRow>
)}
                    {filteredOrganizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-blue-100 text-blue-600">
                                <Building2 className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link
                                href={`/donations/donors/organizations/${org.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {org.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{org.type}</div>
                              {org.hasPledge && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  Pledge
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{org.contact}</div>
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            <span>{org.email}</span>
                            <span>{org.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">${org.totalDonations.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {org.donationCount} donations
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {org.lastDonation}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{org.preferredCategory}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={org.status === "Major Donor" ? "default" : "secondary"}
                          >
                            {org.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Individual Dialog */}
      <Dialog open={showAddIndividualDialog} onOpenChange={setShowAddIndividualDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Individual Donor</DialogTitle>
            <DialogDescription>
              Add a new individual donor to your database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ind-name">Full Name</Label>
              <Input id="ind-name" placeholder="Enter full name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ind-email">Email</Label>
                <Input id="ind-email" type="email" placeholder="email@example.com" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ind-phone">Phone</Label>
                <Input id="ind-phone" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ind-address">Address</Label>
              <Input id="ind-address" placeholder="Full address" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ind-category">Preferred Category</Label>
              <Select>
                <SelectTrigger id="ind-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Programs">Programs</SelectItem>
                  <SelectItem value="Community Support">Community Support</SelectItem>
                  <SelectItem value="Zakat">Zakat</SelectItem>
                  <SelectItem value="Sadaqah">Sadaqah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ind-notes">Notes</Label>
              <Textarea id="ind-notes" placeholder="Additional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIndividualDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddIndividualDialog(false)}>
              Add Donor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Organization Dialog */}
      <Dialog open={showAddOrganizationDialog} onOpenChange={setShowAddOrganizationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Organization Donor</DialogTitle>
            <DialogDescription>
              Add a new organization donor to your database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" placeholder="Enter organization name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-type">Organization Type</Label>
                <Select>
                  <SelectTrigger id="org-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                    <SelectItem value="Educational">Educational</SelectItem>
                    <SelectItem value="Foundation">Foundation</SelectItem>
                    <SelectItem value="Government">Government</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-contact">Contact Person</Label>
                <Input id="org-contact" placeholder="Contact name" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-email">Email</Label>
                <Input id="org-email" type="email" placeholder="contact@org.com" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-phone">Phone</Label>
                <Input id="org-phone" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-address">Address</Label>
              <Input id="org-address" placeholder="Full address" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-category">Preferred Category</Label>
              <Select>
                <SelectTrigger id="org-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Programs">Programs</SelectItem>
                  <SelectItem value="Community Support">Community Support</SelectItem>
                  <SelectItem value="Special Campaigns">Special Campaigns</SelectItem>
                  <SelectItem value="Zakat">Zakat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOrganizationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddOrganizationDialog(false)}>
              Add Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
