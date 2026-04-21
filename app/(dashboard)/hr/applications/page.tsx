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
import { Search, Briefcase, Baby, Users, HandCoins, Clock, CheckCircle, XCircle, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

type ApplicationType = "Employment" | "Childcare Provider" | "Financial Aid" | "Committee Member"

// Mock HR applications
const hrApplications = [
  {
    id: "hr-1",
    name: "Jennifer Martinez",
    email: "jennifer.m@email.com",
    phone: "(555) 111-2222",
    type: "Employment" as ApplicationType,
    position: "Program Coordinator",
    submittedAt: "2025-02-22",
    status: "pending",
    documents: ["Resume", "Cover Letter", "References"],
    experience: "5 years in non-profit program management",
  },
  {
    id: "hr-2",
    name: "Robert Chen",
    email: "robert.c@email.com",
    phone: "(555) 222-3333",
    type: "Employment" as ApplicationType,
    position: "Administrative Assistant",
    submittedAt: "2025-02-21",
    status: "approved",
    documents: ["Resume", "Cover Letter"],
    experience: "3 years administrative experience",
  },
  {
    id: "hr-3",
    name: "Maria Garcia",
    email: "maria.g@email.com",
    phone: "(555) 333-4444",
    type: "Childcare Provider" as ApplicationType,
    submittedAt: "2025-02-20",
    status: "pending",
    documents: ["CPR Certification", "Background Check Consent", "References"],
    experience: "Licensed childcare provider, 8 years experience",
    certifications: ["CPR Certified", "First Aid", "Early Childhood Education"],
  },
  {
    id: "hr-4",
    name: "Ahmed Patel",
    email: "ahmed.p@email.com",
    phone: "(555) 444-5555",
    type: "Financial Aid" as ApplicationType,
    submittedAt: "2025-02-19",
    status: "approved",
    documents: ["Income Documentation", "Financial Aid Form"],
    requestedAmount: "$500",
    purpose: "Youth Summer Program registration fees",
  },
  {
    id: "hr-5",
    name: "Lisa Thompson",
    email: "lisa.t@email.com",
    phone: "(555) 555-6666",
    type: "Committee Member" as ApplicationType,
    committee: "Education Committee",
    submittedAt: "2025-02-18",
    status: "pending",
    documents: ["Statement of Interest"],
    experience: "Former school principal, 15 years in education",
  },
  {
    id: "hr-6",
    name: "Kevin Brown",
    email: "kevin.b@email.com",
    phone: "(555) 666-7777",
    type: "Childcare Provider" as ApplicationType,
    submittedAt: "2025-02-17",
    status: "rejected",
    documents: ["CPR Certification"],
    experience: "2 years babysitting experience",
    rejectionReason: "Missing required certifications",
  },
  {
    id: "hr-7",
    name: "Susan Williams",
    email: "susan.w@email.com",
    phone: "(555) 777-8888",
    type: "Financial Aid" as ApplicationType,
    submittedAt: "2025-02-16",
    status: "pending",
    documents: ["Income Documentation", "Financial Aid Form"],
    requestedAmount: "$750",
    purpose: "Membership fees and program registration",
  },
  {
    id: "hr-8",
    name: "Daniel Kim",
    email: "daniel.k@email.com",
    phone: "(555) 888-9999",
    type: "Committee Member" as ApplicationType,
    committee: "Finance Committee",
    submittedAt: "2025-02-15",
    status: "approved",
    documents: ["Statement of Interest", "Resume"],
    experience: "CPA with 10 years experience in non-profit accounting",
  },
]

const statusConfig = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
}

const typeConfig = {
  "Employment": { icon: Briefcase, color: "bg-blue-100 text-blue-700" },
  "Childcare Provider": { icon: Baby, color: "bg-pink-100 text-pink-700" },
  "Financial Aid": { icon: HandCoins, color: "bg-emerald-100 text-emerald-700" },
  "Committee Member": { icon: Users, color: "bg-purple-100 text-purple-700" },
}

const tabs = ["All", "Employment", "Childcare Provider", "Financial Aid", "Committee Member"] as const

export default function HRApplicationsPage() {
  const [activeTab, setActiveTab] = useState<string>("All")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedApplication, setSelectedApplication] = useState<typeof hrApplications[0] | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")

  const filteredApplications = hrApplications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    const matchesTab = activeTab === "All" || app.type === activeTab
    return matchesSearch && matchesStatus && matchesTab
  })

  const stats = {
    total: hrApplications.length,
    employment: hrApplications.filter((a) => a.type === "Employment").length,
    childcare: hrApplications.filter((a) => a.type === "Childcare Provider").length,
    financialAid: hrApplications.filter((a) => a.type === "Financial Aid").length,
    committee: hrApplications.filter((a) => a.type === "Committee Member").length,
  }

  return (
    <>
      <Header title="HR Applications" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Briefcase className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Briefcase className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.employment}</p>
                <p className="text-xs text-muted-foreground">Employment</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100">
                <Baby className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.childcare}</p>
                <p className="text-xs text-muted-foreground">Childcare</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <HandCoins className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.financialAid}</p>
                <p className="text-xs text-muted-foreground">Financial Aid</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.committee}</p>
                <p className="text-xs text-muted-foreground">Committee</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          ))}
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
            <CardTitle className="text-base">Applications</CardTitle>
            <CardDescription>Review and manage HR-related applications</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => {
                  const status = statusConfig[app.status as keyof typeof statusConfig]
                  const typeInfo = typeConfig[app.type]
                  const TypeIcon = typeInfo.icon
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
                        <Badge className={cn("gap-1", typeInfo.color)}>
                          <TypeIcon className="h-3 w-3" />
                          {app.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {app.type === "Employment" && (app as any).position}
                          {app.type === "Childcare Provider" && "Childcare services"}
                          {app.type === "Financial Aid" && (app as any).requestedAmount}
                          {app.type === "Committee Member" && (app as any).committee}
                        </span>
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
              Review application details and take action
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
                  <Label className="text-muted-foreground">Application Type</Label>
                  <Badge className={cn("mt-1", typeConfig[selectedApplication.type].color)}>
                    {selectedApplication.type}
                  </Badge>
                </div>
              </div>
              
              {/* Type-specific details */}
              {selectedApplication.type === "Employment" && (
                <div>
                  <Label className="text-muted-foreground">Position Applied For</Label>
                  <p className="font-medium">{(selectedApplication as any).position}</p>
                </div>
              )}
              {selectedApplication.type === "Committee Member" && (
                <div>
                  <Label className="text-muted-foreground">Committee</Label>
                  <p className="font-medium">{(selectedApplication as any).committee}</p>
                </div>
              )}
              {selectedApplication.type === "Financial Aid" && (
                <>
                  <div>
                    <Label className="text-muted-foreground">Requested Amount</Label>
                    <p className="font-medium">{(selectedApplication as any).requestedAmount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Purpose</Label>
                    <p className="text-sm">{(selectedApplication as any).purpose}</p>
                  </div>
                </>
              )}
              {selectedApplication.type === "Childcare Provider" && (selectedApplication as any).certifications && (
                <div>
                  <Label className="text-muted-foreground">Certifications</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(selectedApplication as any).certifications.map((cert: string) => (
                      <Badge key={cert} variant="outline">{cert}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedApplication.experience && (
                <div>
                  <Label className="text-muted-foreground">Experience</Label>
                  <p className="text-sm">{selectedApplication.experience}</p>
                </div>
              )}
              
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
