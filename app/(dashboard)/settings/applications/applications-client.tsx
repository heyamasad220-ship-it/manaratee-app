"use client"

import { useEffect, useMemo, useState } from "react"
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
import {
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Users,
  Briefcase,
  Store,
  Heart,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const applicationTabs = [
  "All",
  "Volunteer",
  "Vendor",
  "Employment",
  "Childcare Provider",
  "Financial Aid",
  "Committee Member",
] as const

type ApplicationTab = (typeof applicationTabs)[number]

type ApplicationStatus = "pending" | "approved" | "rejected"

type ApplicationType =
  | "volunteer"
  | "vendor"
  | "employment"
  | "childcare_provider"
  | "financial_aid"
  | "committee_member"

type Application = {
  id: string
  organization_id: string
  application_type: ApplicationType
  applicant_name: string
  email: string
  phone: string | null
  details: string | null
  status: ApplicationStatus
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  submitted_at: string
  created_at: string
  updated_at: string
}

const tabToType: Record<Exclude<ApplicationTab, "All">, ApplicationType> = {
  Volunteer: "volunteer",
  Vendor: "vendor",
  Employment: "employment",
  "Childcare Provider": "childcare_provider",
  "Financial Aid": "financial_aid",
  "Committee Member": "committee_member",
}

const typeLabels: Record<ApplicationType, string> = {
  volunteer: "Volunteer",
  vendor: "Vendor",
  employment: "Employment",
  childcare_provider: "Childcare Provider",
  financial_aid: "Financial Aid",
  committee_member: "Committee Member",
}

const statusLabels: Record<ApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

function getStatusBadge(status: ApplicationStatus) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>
    default:
      return <Badge variant="secondary">Pending</Badge>
  }
}

function getTypeIcon(type: ApplicationType) {
  switch (type) {
    case "volunteer":
      return <Users className="h-4 w-4" />
    case "vendor":
      return <Store className="h-4 w-4" />
    case "employment":
    case "childcare_provider":
    case "committee_member":
      return <Briefcase className="h-4 w-4" />
    case "financial_aid":
      return <Heart className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

export function ApplicationsClient({
  organizationId,
}: {
  organizationId: string
}) {
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<ApplicationTab>("All")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | ApplicationStatus>("All")
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadApplications() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("organization_id", organizationId)
      .order("submitted_at", { ascending: false })

    if (error) {
      setError(error.message)
      setApplications([])
    } else {
      setApplications((data ?? []) as Application[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadApplications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const activeType = activeTab === "All" ? null : tabToType[activeTab]
      const matchesTab = !activeType || app.application_type === activeType

      const searchText = search.toLowerCase().trim()
      const matchesSearch =
        !searchText ||
        app.applicant_name.toLowerCase().includes(searchText) ||
        app.email.toLowerCase().includes(searchText) ||
        (app.details ?? "").toLowerCase().includes(searchText)

      const matchesStatus = statusFilter === "All" || app.status === statusFilter

      return matchesTab && matchesSearch && matchesStatus
    })
  }, [applications, activeTab, search, statusFilter])

  const stats = useMemo(() => {
    return {
      total: applications.length,
      pending: applications.filter((a) => a.status === "pending").length,
      approved: applications.filter((a) => a.status === "approved").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
    }
  }, [applications])

  function openReviewDialog(app: Application) {
    setSelectedApp(app)
    setReviewNotes(app.review_notes ?? "")
    setShowReviewDialog(true)
  }

  async function updateApplicationStatus(status: ApplicationStatus) {
    if (!selectedApp) return

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("applications")
      .update({
        status,
        review_notes: reviewNotes.trim() || null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", selectedApp.id)
      .eq("organization_id", organizationId)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setShowReviewDialog(false)
    setSelectedApp(null)
    setReviewNotes("")
    await loadApplications()
    setSaving(false)
  }

  return (
    <>
      <Header title="Applications" />

      <div className="flex flex-1 flex-col gap-5 p-6">
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">
              <strong>Error:</strong> {error}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Applications
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rejected
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {applicationTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "All" | ApplicationStatus)}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading applications...
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!loading &&
                  filteredApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(app.application_type)}
                          <span className="text-sm">{typeLabels[app.application_type]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{app.applicant_name}</TableCell>
                      <TableCell className="text-muted-foreground">{app.email}</TableCell>
                      <TableCell>{new Date(app.submitted_at).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(app.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openReviewDialog(app)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                {!loading && filteredApplications.length === 0 && (
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

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              {selectedApp
                ? `${typeLabels[selectedApp.application_type]} application from ${selectedApp.applicant_name}`
                : "Review application"}
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Applicant</Label>
                  <p className="font-medium">{selectedApp.applicant_name}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedApp.email}</p>
                </div>

                {selectedApp.phone && (
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedApp.phone}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{typeLabels[selectedApp.application_type]}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">
                    {new Date(selectedApp.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Details</Label>
                <p className="font-medium">{selectedApp.details || "No details provided."}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Current Status</Label>
                <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="review_notes">Review Notes</Label>
                <Textarea
                  id="review_notes"
                  placeholder="Add review notes..."
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)} disabled={saving}>
              Close
            </Button>

            <Button
              variant="destructive"
              onClick={() => updateApplicationStatus("rejected")}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Reject
            </Button>

            <Button onClick={() => updateApplicationStatus("approved")} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
