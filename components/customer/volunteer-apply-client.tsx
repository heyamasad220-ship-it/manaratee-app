"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

import { VolunteerApplicationForm } from "@/components/customer/volunteer-application-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitApplication } from "@/lib/applications/application-actions"
import { APPLICATION_STATUS_LABELS } from "@/lib/applications/application-types"
import type { ApplicationRecord } from "@/lib/applications/application-types"
import type { VolunteerApplicationData } from "@/lib/volunteers/volunteer-application-types"

export function VolunteerApplyClient({
  applicantName,
  applicantEmail,
  applicantPhone,
  applicantAddress,
  existingApplications,
}: {
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  applicantAddress: string
  existingApplications: ApplicationRecord[]
}) {
  const router = useRouter()
  const [email, setEmail] = React.useState(applicantEmail)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submittedId, setSubmittedId] = React.useState<string | null>(null)
  const blockingApplications = existingApplications.filter((app) =>
    ["submitted", "pending_review", "approved"].includes(app.status)
  )
  const rejectedOnly =
    existingApplications.length > 0 &&
    existingApplications.every((app) => app.status === "rejected")
  const [showForm, setShowForm] = React.useState(blockingApplications.length === 0)

  async function handleSubmit(data: VolunteerApplicationData) {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Email is required so we can contact you about this application.")
      return
    }
    if (!data.fullName.trim()) {
      setError("Full name is required.")
      return
    }
    if (!data.backgroundCheckConsent) {
      setError("Background check consent is required to submit.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const application = await submitApplication({
        applicationType: "volunteer",
        moduleOwner: "workforce",
        applicantName: data.fullName.trim(),
        applicantEmail: trimmedEmail,
        applicantPhone: data.phone.trim() || applicantPhone || null,
        formData: data as unknown as Record<string, unknown>,
        status: "pending_review",
      })
      setSubmittedId(application.id)
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Application submitted
          </CardTitle>
          <CardDescription>
            Thanks — your volunteer application is under review. You can track it from your
            profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/customer/profile/applications">View my applications</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/customer/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
          <Link href="/customer/profile/applications">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Applications
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Volunteer Application</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your interests and availability. Staff will review your application before
            adding you to the volunteer roster.
          </p>
        </div>
      </div>

      {existingApplications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your volunteer applications</CardTitle>
            <CardDescription>
              {blockingApplications.length > 0
                ? "You already have an application on file. Staff will contact you after review."
                : "Your previous application was not approved. You can submit a new one."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {existingApplications.map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <span>
                  Submitted{" "}
                  {app.submitted_at
                    ? new Date(app.submitted_at).toLocaleDateString()
                    : "—"}
                </span>
                <span className="text-muted-foreground">
                  {APPLICATION_STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
            ))}
            {!showForm && rejectedOnly ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setShowForm(true)}
              >
                Start a new application
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application form</CardTitle>
            <CardDescription>
              Use the email we should use for updates about this application.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="flex max-w-md flex-col gap-2">
              <Label htmlFor="volunteer-applicant-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="volunteer-applicant-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
            </div>
            <VolunteerApplicationForm
              onSubmit={handleSubmit}
              onCancel={() => router.push("/customer/profile/applications")}
              isSubmitting={isSubmitting}
              initialData={{
                fullName: applicantName,
                phone: applicantPhone,
                address: applicantAddress,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
