"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Link2 } from "lucide-react"
import { toast } from "sonner"

import { VendorApplicationForm } from "@/components/customer/vendor-application-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { submitApplication } from "@/lib/applications/application-actions"
import { APPLICATION_STATUS_LABELS } from "@/lib/applications/application-types"
import type { ApplicationRecord } from "@/lib/applications/application-types"
import { CUSTOMER_VENDOR_APPLY_PATH } from "@/lib/applications/application-routes"
import {
  buildVendorApplicationFormData,
  type VendorApplicationFormValues,
} from "@/lib/vendor-hub/vendor-application-fields"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" ") || "",
  }
}

export function VendorApplyClient({
  applicantName,
  applicantEmail,
  applicantPhone,
  vendorTypes,
  existingApplications,
}: {
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  vendorTypes: VendorHubVendorType[]
  existingApplications: ApplicationRecord[]
}) {
  const router = useRouter()
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

  const nameParts = splitFullName(applicantName)

  async function handleSubmit(values: VendorApplicationFormValues) {
    setIsSubmitting(true)
    setError(null)

    try {
      const vendorTypeName =
        vendorTypes.find((type) => type.id === values.vendor_type_id)?.name ?? null
      const formData = buildVendorApplicationFormData(values, vendorTypeName)
      const fullName = `${values.first_name.trim()} ${values.last_name.trim()}`.trim()

      const application = await submitApplication({
        applicationType: VENDOR_ORG_APPLICATION_TYPE,
        moduleOwner: VENDOR_ORG_APPLICATION_MODULE,
        applicantName: fullName,
        applicantEmail: values.email.trim(),
        applicantPhone: values.phone.trim() || null,
        formData,
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

  async function copyApplyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${CUSTOMER_VENDOR_APPLY_PATH}`)
      toast.success("Apply link copied")
    } catch {
      toast.error("Could not copy link")
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
            Thanks — your vendor application is under review. Once approved, you can join bazaars
            and markets with this organization.
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
          <h1 className="text-2xl font-semibold tracking-tight">Become a vendor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apply once to join this organization&apos;s Vendor Network. After approval, you can
            participate in bazaars and community markets.
          </p>
        </div>
      </div>

      {blockingApplications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application already on file</CardTitle>
            <CardDescription>
              You already have a vendor application for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockingApplications.map((app) => (
              <div
                key={app.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  Status:{" "}
                  <span className="font-medium">
                    {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
                  </span>
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/customer/profile/applications">View status</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {rejectedOnly && !showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previous application was not approved</CardTitle>
            <CardDescription>You can submit a new vendor application.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => setShowForm(true)}>
              Apply again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Vendor application</CardTitle>
              <CardDescription>
                Tell us about your business. Required fields are marked with *.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyApplyLink()}>
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Copy link
            </Button>
          </CardHeader>
          <CardContent>
            {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
            <VendorApplicationForm
              vendorTypes={vendorTypes}
              isSubmitting={isSubmitting}
              initialValues={{
                first_name: nameParts.first_name,
                last_name: nameParts.last_name,
                email: applicantEmail,
                phone: applicantPhone,
              }}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
