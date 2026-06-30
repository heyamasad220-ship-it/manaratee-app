"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ExternalLink, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  createOrganizationStripeConnectDashboardLinkAction,
  getOrganizationStripeConnectStatusAction,
  startOrganizationStripeConnectOnboardingAction,
  syncOrganizationStripeConnectStatusAction,
} from "@/lib/stripe/stripe-connect-actions"
import type { OrganizationStripeConnectStatus } from "@/lib/stripe/stripe-connect-types"

function formatConnectStatus(status: OrganizationStripeConnectStatus, ready: boolean) {
  if (ready) {
    return { label: "Connected", variant: "default" as const }
  }
  if (status.stripeConnectAccountId) {
    return { label: "Setup incomplete", variant: "secondary" as const }
  }
  return { label: "Not connected", variant: "outline" as const }
}

export function DonationStripeConnectPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platformConfigured, setPlatformConfigured] = useState(false)
  const [status, setStatus] = useState<OrganizationStripeConnectStatus | null>(null)
  const [ready, setReady] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getOrganizationStripeConnectStatusAction()
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setPlatformConfigured(result.platformConfigured)
    setStatus(result.status)
    setReady(result.ready)
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const connectParam = searchParams.get("connect")
    if (connectParam !== "return" && connectParam !== "refresh") {
      return
    }

    void (async () => {
      setBusy(true)
      const result = await syncOrganizationStripeConnectStatusAction()
      setBusy(false)

      if (!result.success) {
        setError(result.error)
        return
      }

      setStatus(result.status)
      setReady(result.ready)
      router.replace("/donations/settings?tab=online-payments")
    })()
  }, [router, searchParams])

  async function handleConnect() {
    setBusy(true)
    setError(null)
    const result = await startOrganizationStripeConnectOnboardingAction()
    setBusy(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    window.location.href = result.onboardingUrl
  }

  async function handleRefresh() {
    setBusy(true)
    setError(null)
    const result = await syncOrganizationStripeConnectStatusAction()
    setBusy(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setStatus(result.status)
    setReady(result.ready)
  }

  async function handleOpenDashboard() {
    setBusy(true)
    setError(null)
    const result = await createOrganizationStripeConnectDashboardLinkAction()
    setBusy(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    window.open(result.dashboardUrl, "_blank", "noopener,noreferrer")
  }

  const statusBadge = status ? formatConnectStatus(status, ready) : null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Stripe Connect</CardTitle>
            <CardDescription>
              Connect your organization&apos;s Stripe account so online donations go directly to
              you. Manaratee does not take a fee on donations.
            </CardDescription>
          </div>
          {statusBadge ? <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!platformConfigured ? (
          <p className="text-sm text-muted-foreground">
            Stripe is not configured on this environment yet. Contact Manaratee support to enable
            online donations.
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading Stripe Connect status...</p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {status && !loading ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Card payments</dt>
              <dd className="font-medium">
                {status.stripeConnectChargesEnabled ? "Enabled" : "Not enabled"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Payouts</dt>
              <dd className="font-medium">
                {status.stripeConnectPayoutsEnabled ? "Enabled" : "Not enabled"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Onboarding details</dt>
              <dd className="font-medium">
                {status.stripeConnectDetailsSubmitted ? "Submitted" : "Incomplete"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Connected since</dt>
              <dd className="font-medium">
                {status.stripeConnectOnboardedAt
                  ? new Date(status.stripeConnectOnboardedAt).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!ready ? (
            <Button onClick={handleConnect} disabled={busy || !platformConfigured}>
              {status?.stripeConnectAccountId ? "Continue Stripe setup" : "Connect Stripe"}
            </Button>
          ) : (
            <Button variant="outline" onClick={handleOpenDashboard} disabled={busy}>
              Open Stripe dashboard
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}

          <Button variant="outline" onClick={handleRefresh} disabled={busy || loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh status
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          After connecting, enable a payment method named &quot;Credit Card&quot; under Payment
          Methods so donors can pay online. In Stripe Dashboard → Developers → Webhooks, ensure your
          Manaratee webhook listens to events on connected accounts.
        </p>
      </CardContent>
    </Card>
  )
}
