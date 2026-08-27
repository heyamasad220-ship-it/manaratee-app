"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PhoneText } from "@/components/ui/phone-text"
import { Input } from "@/components/ui/input"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Mail,
  Phone,
  FileText,
  Users,
  Store,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type VendorApplication = {
  id: string
  businessName: string
  contactName: string
  email: string
  phone: string
  type: string
  boothType: string
  status: "approved" | "pending" | "rejected"
  appliedDate: string
  products: string
  booth: string | null
  rejectionReason?: string
}

/** Legacy stub page — no sample rows; use Vendor Hub for real applications. */
const vendors: VendorApplication[] = []

export default function BazaarVendorsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selectedVendor, setSelectedVendor] = useState<VendorApplication | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve")

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch =
      vendor.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.contactName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter
    const matchesType = typeFilter === "all" || vendor.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const stats = {
    total: vendors.length,
    approved: vendors.filter((v) => v.status === "approved").length,
    pending: vendors.filter((v) => v.status === "pending").length,
    rejected: vendors.filter((v) => v.status === "rejected").length,
  }

  const vendorTypes = [...new Set(vendors.map((v) => v.type))]

  return (
    <>
      <Header title="Vendor Applications" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Applications</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[280px] pl-9"
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
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {vendorTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </div>

          {/* Vendors Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No vendor applications yet. Use Vendor Hub for live applications.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/events/vendors/${vendor.id}`}
                          className="text-primary hover:underline"
                        >
                          {vendor.businessName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{vendor.contactName}</span>
                          <span className="text-xs text-muted-foreground">{vendor.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{vendor.type}</TableCell>
                      <TableCell className="text-muted-foreground">{vendor.appliedDate}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1",
                            vendor.status === "approved" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                            vendor.status === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
                            vendor.status === "rejected" && "border-red-200 bg-red-50 text-red-700"
                          )}
                        >
                          {vendor.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {vendor.status === "pending" && <Clock className="h-3 w-3" />}
                          {vendor.status === "rejected" && <XCircle className="h-3 w-3" />}
                          {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedVendor(vendor)
                                setShowDetailsDialog(true)
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Email
                            </DropdownMenuItem>
                            {vendor.status === "pending" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedVendor(vendor)
                                    setApprovalAction("approve")
                                    setShowApprovalDialog(true)
                                  }}
                                  className="text-emerald-600"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedVendor(vendor)
                                    setApprovalAction("reject")
                                    setShowApprovalDialog(true)
                                  }}
                                  className="text-red-600"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {vendor.status === "approved" && !vendor.booth && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Store className="mr-2 h-4 w-4" />
                                  Assign Booth
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedVendor?.businessName}</DialogTitle>
            <DialogDescription>Vendor application details</DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1",
                    selectedVendor.status === "approved" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                    selectedVendor.status === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
                    selectedVendor.status === "rejected" && "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {selectedVendor.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                  {selectedVendor.status === "pending" && <Clock className="h-3 w-3" />}
                  {selectedVendor.status === "rejected" && <XCircle className="h-3 w-3" />}
                  {selectedVendor.status.charAt(0).toUpperCase() + selectedVendor.status.slice(1)}
                </Badge>
                <span className="text-sm text-muted-foreground">Applied: {selectedVendor.appliedDate}</span>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">Contact Information</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedVendor.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedVendor.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span><PhoneText value={selectedVendor.phone} empty="" /></span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">Booth Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium">{selectedVendor.type}</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Assigned Booth</p>
                    <p className="font-medium">{selectedVendor.booth || "Not assigned"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">Products/Services</h4>
                <p className="text-sm">{selectedVendor.products}</p>
              </div>

              {selectedVendor.status === "rejected" && selectedVendor.rejectionReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
                    <div>
                      <h4 className="text-sm font-medium text-red-700">Rejection Reason</h4>
                      <p className="text-sm text-red-600">{selectedVendor.rejectionReason}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            {selectedVendor?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setShowDetailsDialog(false)
                    setApprovalAction("reject")
                    setShowApprovalDialog(true)
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    setShowDetailsDialog(false)
                    setApprovalAction("approve")
                    setShowApprovalDialog(true)
                  }}
                >
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval/Rejection Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" ? "Approve Vendor" : "Reject Vendor"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve"
                ? `Approve ${selectedVendor?.businessName} for the bazaar?`
                : `Reject ${selectedVendor?.businessName}'s application?`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {approvalAction === "approve" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="assign-booth">Assign Booth (Optional)</Label>
                <Select>
                  <SelectTrigger id="assign-booth">
                    <SelectValue placeholder="Select a booth" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Assign Later</SelectItem>
                    <SelectItem value="A-04">A-04 (Standard)</SelectItem>
                    <SelectItem value="B-03">B-03 (Food Booth)</SelectItem>
                    <SelectItem value="D-02">D-02 (Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {approvalAction === "reject" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rejection-reason">Rejection Reason</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Provide a reason for rejection..."
                  rows={3}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" placeholder="Add any internal notes..." rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="send-email" className="h-4 w-4" defaultChecked />
              <Label htmlFor="send-email" className="text-sm font-normal">
                Send email notification to vendor
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setShowApprovalDialog(false)}
              className={approvalAction === "reject" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {approvalAction === "approve" ? "Approve Vendor" : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
