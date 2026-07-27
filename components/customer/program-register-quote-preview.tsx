"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { readParticipantSelections } from "@/lib/programs/registration-form-parsing"
import { mergeRegistrationQuotes } from "@/lib/programs/merge-registration-quotes"
import { quoteProgramRegistration } from "@/lib/programs/program-quote-actions"
import {
  mapQuoteErrorMessage,
  type ProgramRegistrationQuote,
} from "@/lib/programs/program-quote-types"

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
}

export function ProgramRegisterQuotePreview({
  organizationId,
  programId,
  offeringId,
  formId,
}: {
  organizationId: string
  programId: string
  offeringId: string
  formId: string
}) {
  const [quote, setQuote] = React.useState<ProgramRegistrationQuote | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refreshQuote = React.useCallback(async () => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return

    const formData = new FormData(form)
    const registrationOptionId = String(formData.get("registration_option_id") || "")
    if (!registrationOptionId) {
      setQuote(null)
      return
    }

    const participants = readParticipantSelections(formData)
    if (participants.length === 0) {
      setQuote(null)
      setError(null)
      return
    }

    const sessionIds = formData
      .getAll("session_ids")
      .map((value) => String(value))
      .filter(Boolean)

    setLoading(true)
    setError(null)

    try {
      const quotes = await Promise.all(
        participants.map((participant) =>
          quoteProgramRegistration({
            organizationId,
            programId,
            offeringId,
            registrationOptionId,
            participantContactId: participant.participantContactId,
            participantPersonId: participant.participantPersonId,
            sessionIds,
            addons: {
              before_care: participant.beforeCare,
              after_care: participant.afterCare,
              lunch_option_id: participant.lunchOptionId,
            },
          })
        )
      )

      setQuote(mergeRegistrationQuotes(quotes))
    } catch (err) {
      setQuote(null)
      const raw = err instanceof Error ? err.message : ""
      setError(mapQuoteErrorMessage(raw))
    } finally {
      setLoading(false)
    }
  }, [formId, offeringId, organizationId, programId])

  React.useEffect(() => {
    const form = document.getElementById(formId)
    if (!form) return

    const handleChange = () => {
      window.clearTimeout((handleChange as { timer?: number }).timer)
      ;(handleChange as { timer?: number }).timer = window.setTimeout(() => {
        void refreshQuote()
      }, 300)
    }

    form.addEventListener("change", handleChange)
    form.addEventListener("input", handleChange)

    void refreshQuote()

    return () => {
      form.removeEventListener("change", handleChange)
      form.removeEventListener("input", handleChange)
    }
  }, [formId, refreshQuote])

  return (
    <div className="rounded-lg border bg-emerald-50 px-4 py-4 text-emerald-950">
      <p className="mb-3 text-sm font-semibold">Registration Quote</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculating...
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : quote ? (
        <div className="space-y-3 text-sm">
          <ul className="space-y-1">
            {quote.line_items.map((item, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span>{item.label}</span>
                <span>{formatMoney(item.amount, quote.currency)}</span>
              </li>
            ))}
          </ul>

          {quote.discounts.length > 0 ? (
            <ul className="space-y-1 border-t border-emerald-200 pt-2">
              {quote.discounts.map((discount, index) => (
                <li key={index} className="flex justify-between gap-3 text-emerald-800">
                  <span>{discount.label}</span>
                  <span>-{formatMoney(discount.amount, quote.currency)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1 border-t border-emerald-200 pt-2">
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{formatMoney(quote.total, quote.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>Due today</span>
              <span>{formatMoney(quote.due_today, quote.currency)}</span>
            </div>
          </div>

          {quote.scheduled_payments.length > 0 ? (
            <div className="space-y-1 border-t border-emerald-200 pt-2 text-xs">
              <p className="font-medium">Future payments</p>
              {quote.scheduled_payments.map((payment, index) => (
                <div key={index} className="flex justify-between gap-3">
                  <span>{payment.label}</span>
                  <span>
                    {formatMoney(payment.amount, quote.currency)} · {payment.due_date}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm">Select participants to see pricing.</p>
      )}
    </div>
  )
}
