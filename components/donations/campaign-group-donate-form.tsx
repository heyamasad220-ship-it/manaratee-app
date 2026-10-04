"use client"

import { useEffect, useState, useTransition } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  createPublicCampaignGroupDonationCheckoutAction,
  getPublicCampaignGroupCheckoutStatusAction,
  type PublicCampaignGroupDonateInfo,
} from "@/lib/donations/campaign-group-public-actions"
import { cn } from "@/lib/utils"

type CampaignGroupDonateFormProps = {
  info: PublicCampaignGroupDonateInfo
}

export function CampaignGroupDonateForm({ info }: CampaignGroupDonateFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [groupId, setGroupId] = useState("")
  const [amount, setAmount] = useState("")
  const [donorName, setDonorName] = useState("")
  const [donorEmail, setDonorEmail] = useState("")
  const [mode, setMode] = useState<"one_time" | "recurring" | "pledge_pay" | "pledge_only">(
    "one_time"
  )
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "annually">("monthly")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [successAmount, setSuccessAmount] = useState<number | null>(null)
  const [successGroupName, setSuccessGroupName] = useState<string | null>(null)
  const [pledgeOnlySuccess, setPledgeOnlySuccess] = useState(false)
  const [polling, setPolling] = useState(false)

  const checkoutFlag = searchParams.get("checkout")
  const sessionId = searchParams.get("session_id")
  const selectedGroup = info.groups.find((group) => group.id === groupId) || null

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
        setSuccessGroupName(result.groupName)
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

    if (!selectedGroup) {
      setErrorMessage("Choose a group")
      return
    }

    startTransition(async () => {
      const result = await createPublicCampaignGroupDonationCheckoutAction({
        token: info.token,
        groupId: selectedGroup.id,
        amount: Number(amount),
        donorName,
        donorEmail,
        mode,
        frequency: mode === "recurring" ? frequency : undefined,
      })
      if (!result.success) {
        setErrorMessage(result.error)
        return
      }
      if (result.mode === "pledge_only") {
        setPledgeOnlySuccess(true)
        setSuccessAmount(Number(amount))
        setSuccessGroupName(selectedGroup.name)
        return
      }
      if (!result.checkoutUrl) {
        setErrorMessage("Checkout URL was not returned")
        return
      }
      window.location.href = result.checkoutUrl
    })
  }

  if (info.groups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">No groups are open for donations yet.</p>
      </div>
    )
  }

  if (checkoutFlag === "success" || successAmount != null || pledgeOnlySuccess) {
    const groupLabel = successGroupName || selectedGroup?.name || "this group"
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
              {pledgeOnlySuccess
                ? `Your pledge${successAmount != null ? ` of ${formatDonationCurrency(successAmount)}` : ""} supporting `
                : `Your gift${successAmount != null ? ` of ${formatDonationCurrency(successAmount)}` : ""} supporting `}
              <span className="font-medium text-foreground">{groupLabel}</span> is recorded.
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

      <div className="flex flex-col gap-2">
        <Label>Choose a group</Label>
        <div className="flex flex-col gap-2">
          {info.groups.map((group) => {
            const selected = group.id === groupId
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setGroupId(group.id)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left shadow-sm",
                  selected ? "border-primary ring-1 ring-primary" : "border-border"
                )}
                aria-pressed={selected}
              >
                <span className="font-medium">{group.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {formatDonationCurrency(group.received)} received
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {!info.onlineDonationsReady && mode !== "pledge_only" ? (
        <div className="rounded-lg border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Online card payments are not available for this organization yet. You can still record a
            pledge below, or contact them to donate another way.
          </p>
          <div className="mt-4">
            <Button type="button" variant="outline" onClick={() => setMode("pledge_only")}>
              Record a pledge instead
            </Button>
          </div>
        </div>
      ) : null}

      {info.onlineDonationsReady || mode === "pledge_only" ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex flex-col gap-2">
            <Label>Gift type</Label>
            <Select
              value={mode}
              onValueChange={(value: "one_time" | "recurring" | "pledge_pay" | "pledge_only") =>
                setMode(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">Donate now</SelectItem>
                <SelectItem value="recurring">Give monthly / recurring</SelectItem>
                <SelectItem value="pledge_pay">Pledge and pay now</SelectItem>
                <SelectItem value="pledge_only">Pledge only (pay later)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "recurring" ? (
            <div className="flex flex-col gap-2">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value: "monthly" | "quarterly" | "annually") =>
                  setFrequency(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

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

          <Button type="submit" disabled={pending || !selectedGroup} className="w-full">
            {pending
              ? mode === "pledge_only"
                ? "Recording pledge…"
                : "Starting checkout…"
              : mode === "pledge_only"
                ? "Record pledge"
                : mode === "pledge_pay"
                  ? "Pledge and pay with card"
                  : mode === "recurring"
                    ? `Start ${frequency} gift`
                    : "Donate with card"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {selectedGroup
              ? mode === "pledge_only"
                ? `Your pledge will be attributed to ${selectedGroup.name}. Staff can collect payment later. A confirmation email will be sent.`
                : mode === "recurring"
                  ? `You will set up a ${frequency} gift on Stripe. Renewals are attributed to ${selectedGroup.name}.`
                  : `You will complete payment securely on Stripe. Your gift is attributed to ${selectedGroup.name}.`
              : "Choose a group above. Received totals are money already collected."}
          </p>
        </form>
      ) : null}
    </div>
  )
}
