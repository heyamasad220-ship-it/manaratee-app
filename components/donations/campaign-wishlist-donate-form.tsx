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
  createPublicWishlistDonationCheckoutAction,
  getPublicWishlistCheckoutStatusAction,
  type PublicWishlistDonateInfo,
} from "@/lib/donations/campaign-wishlist-public-actions"
import { WISHLIST_FUNDING_STATUS_LABELS, type WishlistFundingStatus } from "@/lib/donations/campaign-wishlist-types"

export function CampaignWishlistDonateForm({ info }: { info: PublicWishlistDonateInfo }) {
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
      const result = await getPublicWishlistCheckoutStatusAction({
        token: info.token,
        stripeCheckoutSessionId: sessionId,
      })
      if (cancelled) return
      if (result.success && result.status === "complete") {
        setSuccessAmount(result.amount)
        setPolling(false)
        router.replace(`/donate/w/${info.token}?checkout=success`)
        return
      }
      if (attempts < 12) {
        window.setTimeout(() => void poll(), 1500)
        return
      }
      setPolling(false)
      setErrorMessage("Payment may still be processing. You will receive a confirmation email if it succeeded.")
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
      const result = await createPublicWishlistDonationCheckoutAction({
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
              Your gift{successAmount != null ? ` of ${formatDonationCurrency(successAmount)}` : ""} supporting{" "}
              <span className="font-medium text-foreground">{info.itemName}</span> is recorded.
            </p>
          </div>
        )}
      </div>
    )
  }

  const fundingLabel =
    WISHLIST_FUNDING_STATUS_LABELS[info.fundingStatus as WishlistFundingStatus] || info.fundingStatus

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">{fundingLabel}</span>
          <span className="font-semibold tabular-nums">
            {formatDonationCurrency(info.collected)} of {formatDonationCurrency(info.targetAmount)}
          </span>
        </div>
        <CampaignProgressBar
          progressPercent={info.targetAmount > 0 ? Math.min((info.collected / info.targetAmount) * 100, 100) : 0}
        />
        {info.completed ? (
          <p className="mt-2 text-sm font-medium text-emerald-700">Completed</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Remaining {formatDonationCurrency(info.remaining)}
          </p>
        )}
      </div>

      {info.onlineDonationsReady ? (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1">
            <Label>Amount</Label>
            <Input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </div>
          <div className="grid gap-1">
            <Label>Full name</Label>
            <Input value={donorName} onChange={(event) => setDonorName(event.target.value)} required />
          </div>
          <div className="grid gap-1">
            <Label>Email</Label>
            <Input type="email" value={donorEmail} onChange={(event) => setDonorEmail(event.target.value)} required />
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Starting checkout…" : "Donate"}</Button>
        </form>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Online donations are not available yet.</p>
      )}
    </div>
  )
}
