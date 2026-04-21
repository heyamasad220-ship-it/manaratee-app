"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Search, FileText, Clock, CheckCircle, XCircle, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock vendor applications
const vendorApplications = [
  {
    id: "va-1",
    businessName: "Halal Delights Catering",
    contactName: "Ahmed Hassan",
    email: "ahmed@halaldelights.com",
    phone: "(555) 123-4567",
    vendorType: "Food",
    boothPreference: "Premium",
    event: "Spring Bazaar 2025",
    submittedAt: "2025-02-15",
    status: "pending",
    documents: ["Business License", "Food Handler Certificate", "Insurance"],
  },
  {
    id: "va-2",
    businessName: "Islamic Art Gallery",
    contactName: "Fatima Ali",
    email: "fatima@islamicart.com",
    phone: "(555) 234-5678",
    vendorType: "Art & Crafts",
    boothPreference: "Standard",
    event: "Spring Bazaar 2025",
    submittedAt: "2025-02-14",
    status: "approved",
    documents: ["Business License", "Portfolio"],
  },
  {
    id: "va-3",
    businessName: "Modest Fashion Boutique",
    contactName: "Sarah Khan",
    email: "sarah@modestfashion.com",
    phone: "(555) 345-6789",
    vendorType: "Clothing",
    boothPreference: "Corner",
    event: "Spring Bazaar 2025",
    submittedAt: "2025-02-13",
    status: "pending",
    documents: ["Business License", "Product Catalog"],
  },
  {
    id: "va-4",
    businessName: "Henna by Amira",
    contactName: "Amira Patel",
    email: "amira@hennabyamira.com",
    phone: "(555) 456-7890",
    vendorType: "Services",
    boothPreference: "Standard",
    event: "Spring Bazaar 2025",
    submittedAt: "2025-02-12",
    status: "rejected",
    documents: ["Portfolio", "Insurance"],
    rejectionReason: "Incomplete documentation - missing business license",
  },
  {
    id: "va-5",
    businessName: "Middle Eastern Spices",
    contactName: "Omar Rashid",
    email: "omar@mespices.com",
    phone: "(555) 567-8901",
    vendorType: "Food",
    boothPreference: "Double",
    event: "Spring Bazaar 2025",
    submittedAt: "2025-02-11",
    status: "approved",
    documents: ["Business License", "Health Certificate", "Insurance"],
  },
]

const statusConfig = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
}

export default function BazaarApplicationsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selectedApplication, setSelectedApplication] = useState<typeof vendorApplications[0] | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")

  const filteredApplications = vendorApplications.filter((app) => {
    const matchesSearch =
      app.businessName.toLowerCase().includes(search.toLowerCase()) ||
      app.contactName.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    const matchesType = typeFilter === "all" || app.vendorType === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const stats = {
    total: vendorApplications.length,
    pending: vendorApplications.filter((a) => a.status === "pending").length,
    approved: vendorApplications.filter((a) => a.status === "approved").length,
    rejected: vendorApplications.filter((a) => a.status === "rejected").length,
  }

  const vendorTypes = [...new Set(vendorApplications.map((a) => a.vendorType))]

  return (
    <>
      <Header title="Vendor Applications" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Applications</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search applications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Vendor Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {vendorTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendor Applications</CardTitle>
            <CardDescription>Review and manage vendor applications for bazaar events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Booth</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => {
                  const status = statusConfig[app.status as keyof typeof statusConfig]
                  return (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.businessName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{app.contactName}</span>
                          <span className="text-xs text-muted-foreground">{app.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{app.vendorType}</TableCell>
                      <TableCell>{app.boothPreference}</TableCell>
                      <TableCell>{app.event}</TableCell>
                      <TableCell>{new Date(app.submittedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1", status.color)}>
                          <status.icon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedApplication(app)
                            setShowReviewDialog(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              Review vendor application details and take action
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Business Name</Label>
                  <p className="font-medium">{selectedApplication.businessName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact Name</Label>
                  <p className="font-medium">{selectedApplication.contactName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedApplication.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedApplication.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor Type</Label>
                  <p className="font-medium">{selectedApplication.vendorType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Booth Preference</Label>
                  <p className="font-medium">{selectedApplication.boothPreference}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Documents Submitted</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedApplication.documents.map((doc) => (
                    <Badge key={doc} variant="outline">{doc}</Badge>
                  ))}
                </div>
              </div>
              {selectedApplication.status === "pending" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="review-notes">Review Notes</Label>
                  <Textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this application..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedApplication?.status === "pending" ? (
              <>
                <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive">Reject</Button>
                <Button>Approve</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
