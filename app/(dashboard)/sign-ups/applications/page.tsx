"use client"

import { useState } from "react"
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
import { Search, Heart, Clock, CheckCircle, XCircle, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock volunteer applications
const volunteerApplications = [
  {
    id: "vol-1",
    name: "Michael Johnson",
    email: "michael.j@email.com",
    phone: "(555) 123-4567",
    interests: ["Event Setup", "Registration Desk", "Food Distribution"],
    availability: "Weekends",
    experience: "2 years volunteering at local food bank",
    submittedAt: "2025-02-20",
    status: "pending",
    backgroundCheck: "pending",
  },
  {
    id: "vol-2",
    name: "Emily Davis",
    email: "emily.d@email.com",
    phone: "(555) 234-5678",
    interests: ["Youth Programs", "Teaching", "Mentoring"],
    availability: "Evenings & Weekends",
    experience: "Former teacher, 5 years experience with children",
    submittedAt: "2025-02-19",
    status: "approved",
    backgroundCheck: "cleared",
  },
  {
    id: "vol-3",
    name: "David Lee",
    email: "david.lee@email.com",
    phone: "(555) 345-6789",
    interests: ["Administrative", "Data Entry", "Phone Calls"],
    availability: "Weekday Mornings",
    experience: "Retired office administrator",
    submittedAt: "2025-02-18",
    status: "approved",
    backgroundCheck: "cleared",
  },
  {
    id: "vol-4",
    name: "Sarah Miller",
    email: "sarah.m@email.com",
    phone: "(555) 456-7890",
    interests: ["Event Photography", "Social Media"],
    availability: "Flexible",
    experience: "Amateur photographer, active on social media",
    submittedAt: "2025-02-17",
    status: "pending",
    backgroundCheck: "pending",
  },
  {
    id: "vol-5",
    name: "James Wilson",
    email: "james.w@email.com",
    phone: "(555) 567-8901",
    interests: ["Security", "Parking", "Traffic Control"],
    availability: "Weekends Only",
    experience: "Former security guard",
    submittedAt: "2025-02-16",
    status: "rejected",
    backgroundCheck: "failed",
    rejectionReason: "Background check did not clear",
  },
]

const statusConfig = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
}

export default function VolunteerApplicationsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedApplication, setSelectedApplication] = useState<typeof volunteerApplications[0] | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")

  const filteredApplications = volunteerApplications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: volunteerApplications.length,
    pending: volunteerApplications.filter((a) => a.status === "pending").length,
    approved: volunteerApplications.filter((a) => a.status === "approved").length,
    rejected: volunteerApplications.filter((a) => a.status === "rejected").length,
  }

  return (
    <>
      <Header title="Volunteer Applications" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Heart className="h-5 w-5 text-blue-600" />
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
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volunteer Applications</CardTitle>
            <CardDescription>Review and manage volunteer applications</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Interests</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Background Check</TableHead>
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
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">{app.email}</span>
                          <span className="text-xs text-muted-foreground">{app.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {app.interests.slice(0, 2).map((interest) => (
                            <Badge key={interest} variant="outline" className="text-xs">
                              {interest}
                            </Badge>
                          ))}
                          {app.interests.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{app.interests.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{app.availability}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            app.backgroundCheck === "cleared" && "bg-emerald-50 text-emerald-700",
                            app.backgroundCheck === "pending" && "bg-amber-50 text-amber-700",
                            app.backgroundCheck === "failed" && "bg-red-50 text-red-700"
                          )}
                        >
                          {app.backgroundCheck}
                        </Badge>
                      </TableCell>
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
              Review volunteer application details and take action
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="flex flex-col gap-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedApplication.name}</p>
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
                  <Label className="text-muted-foreground">Availability</Label>
                  <p className="font-medium">{selectedApplication.availability}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Areas of Interest</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedApplication.interests.map((interest) => (
                    <Badge key={interest} variant="outline">{interest}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Experience</Label>
                <p className="text-sm">{selectedApplication.experience}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Background Check Status</Label>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1",
                    selectedApplication.backgroundCheck === "cleared" && "bg-emerald-50 text-emerald-700",
                    selectedApplication.backgroundCheck === "pending" && "bg-amber-50 text-amber-700",
                    selectedApplication.backgroundCheck === "failed" && "bg-red-50 text-red-700"
                  )}
                >
                  {selectedApplication.backgroundCheck}
                </Badge>
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
