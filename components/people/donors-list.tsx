"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Search, ChevronUp, ChevronDown, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

type DonorType = "Organization" | "Individual"

interface DonationCategory {
  category: string
  subcategory: string
}

interface PledgeInfo {
  amount: number
  frequency: "Monthly" | "Quarterly" | "Annually"
  nextPayment: string
  remaining: number
}

interface Donor {
  id: string
  name: string
  type: DonorType
  lastDonationAmount: number
  lastDonationDate: string
  lastDonationYear: number
  lastDonationCategory: DonationCategory
  totalDonations: number
  activePledge: boolean
  pledgeInfo?: PledgeInfo
}

const mockDonors: Donor[] = [
  {
    id: "dnr-001",
    name: "Al-Noor Foundation",
    type: "Organization",
    lastDonationAmount: 25000,
    lastDonationDate: "Jan 15, 2026",
    lastDonationYear: 2026,
    lastDonationCategory: { category: "Special Campaigns", subcategory: "Capital Campaign" },
    totalDonations: 87500,
    activePledge: true,
    pledgeInfo: { amount: 100000, frequency: "Annually", nextPayment: "Jan 15, 2027", remaining: 75000 },
  },
  {
    id: "dnr-002",
    name: "Ahmed Hassan",
    type: "Individual",
    lastDonationAmount: 500,
    lastDonationDate: "Feb 3, 2026",
    lastDonationYear: 2026,
    lastDonationCategory: { category: "Operations", subcategory: "General Fund" },
    totalDonations: 3200,
    activePledge: false,
  },
  {
    id: "dnr-003",
    name: "Crescent Community Trust",
    type: "Organization",
    lastDonationAmount: 10000,
    lastDonationDate: "Nov 20, 2025",
    lastDonationYear: 2025,
    lastDonationCategory: { category: "Programs", subcategory: "Youth Programs" },
    totalDonations: 45000,
    activePledge: true,
    pledgeInfo: { amount: 5000, frequency: "Monthly", nextPayment: "Mar 1, 2026", remaining: 50000 },
  },
  {
    id: "dnr-004",
    name: "Fatima Al-Rashid",
    type: "Individual",
    lastDonationAmount: 1200,
    lastDonationDate: "Sep 8, 2025",
    lastDonationYear: 2025,
    lastDonationCategory: { category: "Community Support", subcategory: "Scholarship Fund" },
    totalDonations: 6800,
    activePledge: true,
    pledgeInfo: { amount: 100, frequency: "Monthly", nextPayment: "Mar 1, 2026", remaining: 1000 },
  },
  {
    id: "dnr-005",
    name: "Barakah Enterprises",
    type: "Organization",
    lastDonationAmount: 5000,
    lastDonationDate: "Jun 12, 2024",
    lastDonationYear: 2024,
    lastDonationCategory: { category: "Operations", subcategory: "Building & Maintenance" },
    totalDonations: 15000,
    activePledge: false,
  },
  {
    id: "dnr-006",
    name: "Omar Syed",
    type: "Individual",
    lastDonationAmount: 250,
    lastDonationDate: "Feb 18, 2026",
    lastDonationYear: 2026,
    lastDonationCategory: { category: "Community Support", subcategory: "Food Assistance" },
    totalDonations: 1750,
    activePledge: false,
  },
  {
    id: "dnr-007",
    name: "Salam Medical Group",
    type: "Organization",
    lastDonationAmount: 15000,
    lastDonationDate: "Mar 5, 2024",
    lastDonationYear: 2024,
    lastDonationCategory: { category: "Community Support", subcategory: "Emergency Relief" },
    totalDonations: 60000,
    activePledge: false,
  },
  {
    id: "dnr-008",
    name: "Layla Mahmoud",
    type: "Individual",
    lastDonationAmount: 100,
    lastDonationDate: "Aug 22, 2023",
    lastDonationYear: 2023,
    lastDonationCategory: { category: "Operations", subcategory: "General Fund" },
    totalDonations: 400,
    activePledge: false,
  },
  {
    id: "dnr-009",
    name: "Ibrahim Khan",
    type: "Individual",
    lastDonationAmount: 2000,
    lastDonationDate: "Jan 30, 2026",
    lastDonationYear: 2026,
    lastDonationCategory: { category: "Special Campaigns", subcategory: "Endowment Fund" },
    totalDonations: 12000,
    activePledge: true,
    pledgeInfo: { amount: 500, frequency: "Quarterly", nextPayment: "Apr 1, 2026", remaining: 4500 },
  },
  {
    id: "dnr-010",
    name: "Unity Charitable Fund",
    type: "Organization",
    lastDonationAmount: 50000,
    lastDonationDate: "Dec 1, 2025",
    lastDonationYear: 2025,
    lastDonationCategory: { category: "Programs", subcategory: "Education & Training" },
    totalDonations: 150000,
    activePledge: true,
    pledgeInfo: { amount: 25000, frequency: "Annually", nextPayment: "Dec 1, 2026", remaining: 50000 },
  },
]

const donationYears = [2026, 2025, 2024, 2023]

type SortField = "name" | "type" | "activePledge" | "lastDonationAmount" | "lastDonationDate" | "totalDonations"
type SortDirection = "asc" | "desc"

function SortIcon({
  field,
  currentField,
  direction,
}: {
  field: SortField
  currentField: SortField
  direction: SortDirection
}) {
  if (field !== currentField) {
    return <ChevronUp className="ml-1 inline size-3.5 text-muted-foreground/40" />
  }
  return direction === "asc" ? (
    <ChevronUp className="ml-1 inline size-3.5" />
  ) : (
    <ChevronDown className="ml-1 inline size-3.5" />
  )
}

const typeStyles: Record<DonorType, string> = {
  Organization: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Individual: "bg-violet-100 text-violet-700 hover:bg-violet-100",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function DonorsList() {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [pledgeFilter, setPledgeFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [donorType, setDonorType] = useState<"Individual" | "Organization">("Individual")

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...mockDonors]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((d) => d.name.toLowerCase().includes(q))
    }

    if (typeFilter !== "all") {
      result = result.filter((d) => d.type === typeFilter)
    }

    if (yearFilter !== "all") {
      const year = parseInt(yearFilter, 10)
      result = result.filter((d) => d.lastDonationYear === year)
    }

    if (pledgeFilter !== "all") {
      const hasPledge = pledgeFilter === "yes"
      result = result.filter((d) => d.activePledge === hasPledge)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name":
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          break
        case "type":
          cmp = a.type.localeCompare(b.type)
          break
        case "lastDonationAmount":
          cmp = a.lastDonationAmount - b.lastDonationAmount
          break
        case "lastDonationDate":
          cmp = new Date(a.lastDonationDate).getTime() - new Date(b.lastDonationDate).getTime()
          break
        case "totalDonations":
          cmp = a.totalDonations - b.totalDonations
          break
        case "activePledge":
          cmp = Number(a.activePledge) - Number(b.activePledge)
          break
      }
      return sortDirection === "asc" ? cmp : -cmp
    })

    return result
  }, [search, typeFilter, yearFilter, pledgeFilter, sortField, sortDirection])

  const totalDonationsSum = filtered.reduce((sum, d) => sum + d.totalDonations, 0)

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full max-w-sm animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Donors</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {mockDonors.length}{" "}
            {mockDonors.length !== 1 ? "donors" : "donor"}{" "}
            &middot; {formatCurrency(totalDonationsSum)} total
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Donor
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Organization">Organization</SelectItem>
            <SelectItem value="Individual">Individual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {donationYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pledgeFilter} onValueChange={setPledgeFilter}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Active Pledges" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pledges</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>

      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("type")}
                  >
                    Type
                    <SortIcon field="type" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("activePledge")}
                  >
                    Pledge
                    <SortIcon field="activePledge" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("lastDonationAmount")}
                  >
                    Last Donation
                    <SortIcon field="lastDonationAmount" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("lastDonationDate")}
                  >
                    Date
                    <SortIcon field="lastDonationDate" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("totalDonations")}
                  >
                    Total Donations
                    <SortIcon field="totalDonations" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No donors found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((donor) => (
                  <TableRow key={donor.id}>
                    <TableCell>
                      <Link
                        href={`/people/donors/${donor.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {donor.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={typeStyles[donor.type]}>
                        {donor.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="w-fit text-xs font-normal">
                          {donor.lastDonationCategory.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {donor.lastDonationCategory.subcategory}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {donor.activePledge && donor.pledgeInfo ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="secondary"
                            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          >
                            {formatCurrency(donor.pledgeInfo.amount)}/{donor.pledgeInfo.frequency === "Monthly" ? "mo" : donor.pledgeInfo.frequency === "Quarterly" ? "qtr" : "yr"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Next: {donor.pledgeInfo.nextPayment}
                          </span>
                        </div>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground hover:bg-muted"
                        >
                          None
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(donor.lastDonationAmount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {donor.lastDonationDate}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {formatCurrency(donor.totalDonations)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Donor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Donor</DialogTitle>
            <DialogDescription>
              Add a new donor to your database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Donor Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={donorType === "Individual" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setDonorType("Individual")}
                >
                  Individual
                </Button>
                <Button
                  variant={donorType === "Organization" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setDonorType("Organization")}
                >
                  Organization
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="donor-name">
                {donorType === "Individual" ? "Full Name" : "Organization Name"}
              </Label>
              <Input
                id="donor-name"
                placeholder={donorType === "Individual" ? "Enter full name" : "Enter organization name"}
              />
            </div>
            {donorType === "Organization" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-person">Contact Person</Label>
                <Input id="contact-person" placeholder="Primary contact name" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="donor-email">Email</Label>
                <Input id="donor-email" type="email" placeholder="email@example.com" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="donor-phone">Phone Number</Label>
                <Input id="donor-phone" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="donor-address">Address</Label>
              <Input id="donor-address" placeholder="Street address" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="donor-city">City</Label>
                <Input id="donor-city" placeholder="City" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="donor-state">State</Label>
                <Input id="donor-state" placeholder="State" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="donor-zip">ZIP</Label>
                <Input id="donor-zip" placeholder="ZIP code" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="preferred-category">Preferred Giving Category</Label>
              <Select>
                <SelectTrigger id="preferred-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Programs">Programs</SelectItem>
                  <SelectItem value="Community Support">Community Support</SelectItem>
                  <SelectItem value="Special Campaigns">Special Campaigns</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Donor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
