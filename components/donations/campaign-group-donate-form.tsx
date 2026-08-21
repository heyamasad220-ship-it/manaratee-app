"use client"

import { useEffect, useState, useTransition } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  createPublicCampaignGroupDonationCheckoutAction,
  getPublicCampaignGroupCheckoutStatusAction,
  type PublicCampaignGroupDonateInfo,
} from "@/lib/donations/campaign-group-public-actions"

type CampaignGroupDonateFormProps = {
  info: PublicCampaignGroupDonateInfo
}

export function CampaignGroupDonateForm({ info }: CampaignGroupDonateFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [amount, setAmount] = useState("")
  const [donorName, setDonorName] = useState("")
  const [donorEmail, setDonorEmail] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [successAmount, setSuccessAmount] = useState<number | null>(null)
  const [polling, setPolling] = useState(false)

  const checkoutFlag = searchParams.get("checkout")
  const sessionId = searchParams.get("session_id")

  useEffect(() => {
    if (checkoutFlag !== "success" || !sessionId || successAmount != null) return

    let cancelled = false
    let attempts = 0
    setPolling(true)

    const poll = async () => {
      attempts += 1
      const result = await getPublicCampaignGroupCheckoutStatusAction({
        token: info.token,
        stripeCheckoutSessionId: sessionId,
      })
      if (cancelled) return

      if (result.success && result.status === "complete") {
        setSuccessAmount(result.amount)
        setPolling(false)
        router.replace(`/donate/g/${info.token}?checkout=success`)
        return
      }

      if (attempts < 12) {
        window.setTimeout(() => {
          void poll()
        }, 1500)
        return
      }

      setPolling(false)
      setErrorMessage(
        "Payment may still be processing. You will receive a confirmation email if it succeeded."
      )
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [checkoutFlag, sessionId, info.token, router, successAmount])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrorMessage(null)

    startTransition(async () => {
      const result = await createPublicCampaignGroupDonationCheckoutAction({
        token: info.token,
        amount: Number(amount),
        donorName,
        donorEmail,
      })
      if (!result.success) {
        setErrorMessage(result.error)
        return
      }
      window.location.href = result.checkoutUrl
    })
  }

  if (checkoutFlag === "success" || successAmount != null) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        {polling && successAmount == null ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Confirming your donation…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <h2 className="text-xl font-semibold">Thank you</h2>
            <p className="text-sm text-muted-foreground">
              Your gift
              {successAmount != null ? ` of ${formatDonationCurrency(successAmount)}` : ""}{" "}
              supporting <span className="font-medium text-foreground">{info.groupName}</span> is
              recorded.
            </p>
          </div>
        )}
        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {checkoutFlag === "cancelled" ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
          Checkout was cancelled. You can try again below.
        </p>
      ) : null}
      {info.publicProgressEnabled ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Collected</span>
            <span className="font-semibold tabular-nums">
              {formatDonationCurrency(info.collected || 0)}
              {info.goalAmount != null
                ? ` of ${formatDonationCurrency(info.goalAmount)}`
                : ""}
            </span>
          </div>
          {info.progressPercent != null ? (
            <CampaignProgressBar progressPercent={info.progressPercent} />
          ) : null}
        </div>
      ) : null}

      {!info.onlineDonationsReady ? (
        <div className="rounded-lg border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Online giving is not available for this organization yet. Please contact them to donate
            another way.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="donate-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="donate-amount"
                type="number"
                min="0.50"
                step="0.01"
                required
                className="pl-7"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="donate-name">Full name</Label>
            <Input
              id="donate-name"
              required
              value={donorName}
              onChange={(event) => setDonorName(event.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="donate-email">Email</Label>
            <Input
              id="donate-email"
              type="email"
              required
              value={donorEmail}
              onChange={(event) => setDonorEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Starting checkout…" : "Donate with card"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You will complete payment securely on Stripe. Your gift is attributed to{" "}
            {info.groupName}.
          </p>
        </form>
      )}
    </div>
  )
}
