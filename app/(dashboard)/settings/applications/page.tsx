"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Search, FileText, CheckCircle, XCircle, Clock, Eye, Users, Briefcase, Store, Heart } from "lucide-react"
import { cn } from "@/lib/utils"

const applicationTabs = ["All", "Volunteer", "Vendor", "Employment", "Childcare Provider", "Financial Aid", "Committee Member"] as const
type ApplicationTab = (typeof applicationTabs)[number]

const applications = [
  // Volunteer Applications
  { id: "app-1", type: "Volunteer", name: "Ahmed Hassan", email: "ahmed.h@email.com", submittedDate: "2026-02-28", status: "Pending", details: "Interested in weekend events" },
  { id: "app-2", type: "Volunteer", name: "Sarah Miller", email: "sarah.m@email.com", submittedDate: "2026-02-25", status: "Approved", details: "Experience with youth programs" },
  { id: "app-3", type: "Volunteer", name: "Omar Khan", email: "omar.k@email.com", submittedDate: "2026-02-20", status: "Pending", details: "Available weekends only" },
  // Vendor Applications
  { id: "app-4", type: "Vendor", name: "Halal Delights", email: "info@halaldelights.com", submittedDate: "2026-02-27", status: "Pending", details: "Food vendor - Middle Eastern cuisine" },
  { id: "app-5", type: "Vendor", name: "Islamic Bookstore", email: "books@islamicstore.com", submittedDate: "2026-02-22", status: "Approved", details: "Books and educational materials" },
  { id: "app-6", type: "Vendor", name: "Modest Fashion Co", email: "contact@modestfashion.com", submittedDate: "2026-02-18", status: "Rejected", details: "Clothing and accessories" },
  // Employment Applications
  { id: "app-7", type: "Employment", name: "Fatima Ali", email: "fatima.ali@email.com", submittedDate: "2026-02-26", status: "Pending", details: "Applying for Admin Assistant position" },
  { id: "app-8", type: "Employment", name: "Yusuf Ahmed", email: "yusuf.a@email.com", submittedDate: "2026-02-24", status: "Approved", details: "Youth Program Coordinator" },
  // Childcare Provider Applications
  { id: "app-9", type: "Childcare Provider", name: "Maria Santos", email: "maria.s@email.com", submittedDate: "2026-02-23", status: "Pending", details: "CPR certified, 5 years experience" },
  { id: "app-10", type: "Childcare Provider", name: "Aisha Johnson", email: "aisha.j@email.com", submittedDate: "2026-02-19", status: "Approved", details: "Early childhood education degree" },
  // Financial Aid Applications
  { id: "app-11", type: "Financial Aid", name: "Ibrahim Mohamed", email: "ibrahim.m@email.com", submittedDate: "2026-02-21", status: "Pending", details: "Requesting tuition assistance" },
  { id: "app-12", type: "Financial Aid", name: "Khadija Omar", email: "khadija.o@email.com", submittedDate: "2026-02-15", status: "Approved", details: "Program fee assistance" },
  // Committee Member Applications
  { id: "app-13", type: "Committee Member", name: "Hassan Ali", email: "hassan.ali@email.com", submittedDate: "2026-02-17", status: "Pending", details: "Interested in Education Committee" },
  { id: "app-14", type: "Committee Member", name: "Noor Ahmed", email: "noor.a@email.com", submittedDate: "2026-02-14", status: "Approved", details: "Youth Committee member" },
]

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
    case "Rejected":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>
    default:
      return <Badge variant="secondary">Pending</Badge>
  }
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "Volunteer":
      return <Users className="h-4 w-4" />
    case "Vendor":
      return <Store className="h-4 w-4" />
    case "Employment":
    case "Childcare Provider":
    case "Committee Member":
      return <Briefcase className="h-4 w-4" />
    case "Financial Aid":
      return <Heart className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

export default function SettingsApplicationsPage() {
  const [activeTab, setActiveTab] = useState<ApplicationTab>("All")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [selectedApp, setSelectedApp] = useState<typeof applications[0] | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)

  const filteredApplications = applications.filter((app) => {
    const matchesTab = activeTab === "All" || app.type === activeTab
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "All" || app.status === statusFilter
    return matchesTab && matchesSearch && matchesStatus
  })

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "Pending").length,
    approved: applications.filter((a) => a.status === "Approved").length,
    rejected: applications.filter((a) => a.status === "Rejected").length,
  }

  return (
    <>
      <Header title="Applications" />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {applicationTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>
              {activeTab === "All" ? "All application types" : `${activeTab} applications`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(app.type)}
                        <span className="text-sm">{app.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell className="text-muted-foreground">{app.email}</TableCell>
                    <TableCell>{new Date(app.submittedDate).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app)
                          setShowReviewDialog(true)
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredApplications.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No applications found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              {selectedApp?.type} application from {selectedApp?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Applicant</Label>
                  <p className="font-medium">{selectedApp.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedApp.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedApp.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">{new Date(selectedApp.submittedDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Details</Label>
                <p className="font-medium">{selectedApp.details}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Current Status</Label>
                <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" placeholder="Add review notes..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowReviewDialog(false)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={() => setShowReviewDialog(false)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
