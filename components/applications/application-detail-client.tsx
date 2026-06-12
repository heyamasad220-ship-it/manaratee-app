"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  User,
  XCircle,
} from "lucide-react"
import {
  addApplicationNote,
  fetchApplicationById,
  fetchApplicationDocuments,
  fetchApplicationHistory,
  fetchApplicationTypeDefinitions,
  updateApplicationStatus,
} from "@/lib/applications/application-actions"
import {
  APPLICATION_STATUS_LABELS,
  getTypeLabel,
  MODULE_OWNER_LABELS,
  type ApplicationDocumentRecord,
  type ApplicationHistoryRecord,
  type ApplicationRecord,
  type ApplicationTypeDefinition,
} from "@/lib/applications/application-types"
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge"

export function ApplicationDetailClient({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vendorHubEventId = searchParams.get("vendor_hub_event_id")
  const [application, setApplication] = useState<ApplicationRecord | null>(null)
  const [history, setHistory] = useState<ApplicationHistoryRecord[]>([])
  const [documents, setDocuments] = useState<ApplicationDocumentRecord[]>([])
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>({})
  const [reviewNotes, setReviewNotes] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadApplication = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [app, historyRows, documentRows, registry] = await Promise.all([
        fetchApplicationById(applicationId),
        fetchApplicationHistory(applicationId),
        fetchApplicationDocuments(applicationId),
        fetchApplicationTypeDefinitions(),
      ])

      if (!app) {
        setError("Application not found")
        setApplication(null)
        return
      }

      setApplication(app)
      setHistory(historyRows)
      setDocuments(documentRows)
      setTypeRegistry(registry)
      setReviewNotes(app.review_notes ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load application")
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    void loadApplication()
  }, [loadApplication])

  async function handleStatusUpdate(status: ApplicationRecord["status"]) {
    if (!application) return
    setSaving(true)
    setError(null)
    try {
      await updateApplicationStatus({
        applicationId: application.id,
        status,
        reviewNotes,
        vendorHubEventId,
      })
      await loadApplication()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update application")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNote() {
    if (!application || !internalNote.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addApplicationNote(application.id, internalNote.trim())
      setInternalNote("")
      await loadApplication()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading application...
      </div>
    )
  }

  if (!application) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {error ?? "Application not found"}
          </CardContent>
        </Card>
      </div>
    )
  }

  const formSummary =
    typeof application.form_data.summary === "string"
      ? application.form_data.summary
      : Object.keys(application.form_data).length > 0
        ? JSON.stringify(application.form_data, null, 2)
        : "No additional details provided."

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="text-lg font-semibold">
            {getTypeLabel(application.application_type, typeRegistry)}
          </h2>
          <p className="text-sm text-muted-foreground">Application profile and review workflow</p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
            <CardDescription>Applicant information and submission data</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Applicant</Label>
              <p className="font-medium">{application.applicant_name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{application.applicant_email}</p>
            </div>
            {application.applicant_phone && (
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <p className="font-medium">{application.applicant_phone}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Application Type</Label>
              <p className="font-medium">
                {getTypeLabel(application.application_type, typeRegistry)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Module Owner</Label>
              <p className="font-medium">{MODULE_OWNER_LABELS[application.module_owner]}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">
                <ApplicationStatusBadge status={application.status} />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Submitted</Label>
              <p className="font-medium">
                {application.submitted_at
                  ? new Date(application.submitted_at).toLocaleString()
                  : "-"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Reviewed</Label>
              <p className="font-medium">
                {application.reviewed_at
                  ? new Date(application.reviewed_at).toLocaleString()
                  : "-"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground">Contact</Label>
              {application.contact_id ? (
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/contacts/${application.contact_id}`}>
                    <User className="mr-2 h-4 w-4" />
                    View contact profile
                  </Link>
                </Button>
              ) : (
                <p className="font-medium">Not linked</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground">Submission Details</Label>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                {formSummary}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Review Actions</CardTitle>
              <CardDescription>Approve, reject, or withdraw this application</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="review_notes">Review Notes</Label>
                <Textarea
                  id="review_notes"
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Notes visible to reviewers..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => void handleStatusUpdate("approved")}
                  disabled={saving || application.status === "approved"}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleStatusUpdate("rejected")}
                  disabled={saving || application.status === "rejected"}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleStatusUpdate("withdrawn")}
                  disabled={saving || application.status === "withdrawn"}
                >
                  Withdraw
                </Button>
                {(application.status === "draft" || application.status === "submitted") && (
                  <Button
                    variant="secondary"
                    onClick={() => void handleStatusUpdate("pending_review")}
                    disabled={saving}
                  >
                    Mark Pending Review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {application.notes || "No internal notes yet."}
              </p>
              <Textarea
                rows={3}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Add an internal note..."
              />
              <Button
                variant="outline"
                onClick={() => void handleAddNote()}
                disabled={saving || !internalNote.trim()}
              >
                Add Note
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Review History</CardTitle>
            <CardDescription>Audit trail of workflow actions</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">No history recorded yet.</p>
            )}
            {history.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{entry.action.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                {(entry.previous_status || entry.new_status) && (
                  <p className="mt-2 text-sm">
                    {entry.previous_status
                      ? APPLICATION_STATUS_LABELS[entry.previous_status as keyof typeof APPLICATION_STATUS_LABELS]
                      : "—"}{" "}
                    →{" "}
                    {entry.new_status
                      ? APPLICATION_STATUS_LABELS[entry.new_status as keyof typeof APPLICATION_STATUS_LABELS]
                      : "—"}
                  </p>
                )}
                {entry.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">{entry.notes}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Files attached to this application</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {documents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <FileText className="mb-2 h-8 w-8" />
                <p className="text-sm">No documents uploaded yet.</p>
              </div>
            )}
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
