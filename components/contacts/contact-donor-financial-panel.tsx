"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DonorProfileMetrics } from "@/components/donations/donor-profile-metrics"
import { DonorGivingSummary } from "@/components/donations/donor-giving-summary"
import { DonorRecurringPanel } from "@/components/donations/donor-recurring-panel"
import { DonorDonationHistoryTable } from "@/components/donations/donor-donation-history-table"
import { DonorPledgesTab } from "@/components/donations/donor-pledges-tab"
import { ContactPaymentMethodsPanel } from "@/components/contacts/contact-payment-methods-panel"
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities"
import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"
import { Loader2 } from "lucide-react"

type ContactDonorFinancialPanelProps = {
  donorId: string
  donorName: string
  contactId?: string
  paymentMethods?: ContactPaymentMethodRow[]
  paymentMethodsLoading?: boolean
  showPaymentMethods?: boolean
}

type DonorSummaryState = {
  totalDonations: number
  donationCount: number
  lastDonation: string | null
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function ContactDonorFinancialPanel({
  donorId,
  donorName,
  contactId,
  paymentMethods = [],
  paymentMethodsLoading = false,
  showPaymentMethods = false,
}: ContactDonorFinancialPanelProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<DonorSummaryState | null>(null)
  const [donationHistory, setDonationHistory] = useState<
    ReturnType<typeof mapPaymentToDonationHistoryRow>[]
  >([])

  const loadDonorData = useCallback(async () => {
    setLoading(true)

    const [{ data: donorRow, error: donorError }, { data: payments, error: paymentsError }] =
      await Promise.all([
        supabase.from("donor_summary_view").select("*").eq("id", donorId).maybeSingle(),
        supabase
          .from("payments")
          .select(
            `
            id,
            amount,
            refunded_amount,
            payment_date,
            source,
            source_type,
            memo,
            status,
            pledge_id,
            import_batch_id,
            stripe_payment_intent_id,
            stripe_charge_id,
            category_id,
            donation_categories ( name )
          `
          )
          .eq("donor_id", donorId)
          .order("payment_date", { ascending: false })
          .limit(100),
      ])

    if (donorError) {
      console.error("Error loading donor summary:", donorError)
    }

    if (paymentsError) {
      console.error("Error loading donor payments:", paymentsError)
    }

    setSummary({
      totalDonations: Number(donorRow?.total_donations || 0),
      donationCount: Number(donorRow?.donation_count || 0),
      lastDonation: donorRow?.last_donation_date || null,
    })
    setDonationHistory((payments || []).map((payment) => mapPaymentToDonationHistoryRow(payment)))
    setLoading(false)
  }, [donorId, supabase])

  useEffect(() => {
    void loadDonorData()
  }, [loadDonorData])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading giving details...</p>
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Could not load donor details for this contact.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <DonorProfileMetrics
        donorId={donorId}
        totalDonations={summary.totalDonations}
        donationCount={summary.donationCount}
        lastDonation={summary.lastDonation}
        onDonationCountClick={() => scrollToSection("contact-donor-donation-history")}
        onPledgesClick={() => scrollToSection("contact-donor-pledges")}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card id="contact-donor-donation-history">
            <CardHeader>
              <CardTitle>Donation History</CardTitle>
              <CardDescription>All gifts from {donorName}</CardDescription>
            </CardHeader>
            <CardContent>
              <DonorDonationHistoryTable
                donorId={donorId}
                donations={donationHistory}
                onUpdated={() => void loadDonorData()}
              />
            </CardContent>
          </Card>

          <Card id="contact-donor-pledges">
            <CardHeader>
              <CardTitle>Pledges</CardTitle>
              <CardDescription>
                Commitments, fulfillment, and reminders for {donorName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonorPledgesTab
                donorId={donorId}
                donorName={donorName}
                contactId={contactId}
                embedded
                onUpdated={() => void loadDonorData()}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {showPaymentMethods && contactId ? (
            paymentMethodsLoading ? (
              <Card>
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading payment methods...
                </CardContent>
              </Card>
            ) : (
              <ContactPaymentMethodsPanel
                contactId={contactId}
                paymentMethods={paymentMethods}
                compact
              />
            )
          ) : null}

          <DonorGivingSummary donorId={donorId} donorName={donorName} statementOnly />
        </div>
      </div>

      <DonorRecurringPanel donorId={donorId} />
    </div>
  )
}
