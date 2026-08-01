"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileText, Loader2 } from "lucide-react"

import { agreeVenueRentalPolicies } from "@/lib/bookings/venue-rental-actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type CustomerRentalPoliciesAgreementProps = {
  venueRentalId: string
  policiesDocumentUrl: string | null
  pricingGuideUrl: string | null
  policiesAgreedAt: string | null
  canAgree: boolean
}

export function CustomerRentalPoliciesAgreement({
  venueRentalId,
  policiesDocumentUrl,
  pricingGuideUrl,
  policiesAgreedAt,
  canAgree,
}: CustomerRentalPoliciesAgreementProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  if (!policiesDocumentUrl && !pricingGuideUrl && !policiesAgreedAt) {
    return null
  }

  if (policiesAgreedAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies & pricing</CardTitle>
          <CardDescription>
            You agreed on {new Date(policiesAgreedAt).toLocaleString()}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {policiesDocumentUrl ? (
            <a
              href={policiesDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
            >
              <FileText className="h-4 w-4" />
              Policies & procedures
            </a>
          ) : null}
          {pricingGuideUrl ? (
            <a
              href={pricingGuideUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
            >
              <FileText className="h-4 w-4" />
              Pricing guide
            </a>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  if (!canAgree) {
    return null
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="text-base">Review and agree</CardTitle>
        <CardDescription>
          Please open the documents below, then confirm you agree. Your request
          cannot be approved until you do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 text-sm">
          {policiesDocumentUrl ? (
            <a
              href={policiesDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
            >
              <FileText className="h-4 w-4" />
              Policies & procedures (PDF)
            </a>
          ) : null}
          {pricingGuideUrl ? (
            <a
              href={pricingGuideUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
            >
              <FileText className="h-4 w-4" />
              Pricing guide (PDF)
            </a>
          ) : null}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>
            I have read and agree to the policies and procedures
            {pricingGuideUrl ? " and pricing guide" : ""}.
          </span>
        </label>

        <Button
          type="button"
          disabled={!confirmed || isPending}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              try {
                const result = await agreeVenueRentalPolicies({ venueRentalId })
                router.refresh()
                if (result.autoApproved) {
                  // Status moves to Approved — refresh shows payment next steps.
                }
              } catch (agreeError) {
                setError(
                  agreeError instanceof Error
                    ? agreeError.message
                    : "Could not record your agreement."
                )
              }
            })
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              I agree
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
